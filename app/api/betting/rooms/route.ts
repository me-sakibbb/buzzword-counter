import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// POST - Create a betting room for a session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check admin
    const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const { session_id, initial_balance } = await request.json()

    if (!session_id || !initial_balance || initial_balance < 1) {
      return NextResponse.json({ error: "Missing session_id or invalid initial_balance" }, { status: 400 })
    }

    // Check if room already exists for this session
    const { data: existing } = await supabase
      .from("betting_rooms")
      .select("id")
      .eq("session_id", session_id)
      .eq("status", "open")
      .single()

    if (existing) {
      return NextResponse.json({ id: existing.id, existing: true })
    }

    // Get session buzzwords for auto-creating total_count markets
    const { data: session } = await supabase
      .from("sessions")
      .select("*, teacher:teachers(*)")
      .eq("id", session_id)
      .single()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { data: buzzwords } = await supabase
      .from("buzzwords")
      .select("*")
      .eq("teacher_id", session.teacher_id)

    // Create the betting room
    const { data: room, error: roomError } = await supabase
      .from("betting_rooms")
      .insert({
        session_id,
        created_by: user.id,
        initial_balance,
        status: "open",
        live_counts: {},
      })
      .select()
      .single()

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 })
    }

    // Auto-create total_count markets for each buzzword
    if (buzzwords && buzzwords.length > 0) {
      const markets = buzzwords.map((bw) => ({
        room_id: room.id,
        type: "total_count" as const,
        buzzword_id: bw.id,
        buzzword_label: bw.label,
        status: "open" as const,
      }))

      await supabase.from("betting_markets").insert(markets)
    }

    return NextResponse.json({ id: room.id, existing: false })
  } catch (error) {
    console.error("Create betting room error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET - Get a betting room by session_id
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
    }

    const { data: room } = await supabase
      .from("betting_rooms")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "open")
      .single()

    if (!room) {
      return NextResponse.json({ error: "No active betting room" }, { status: 404 })
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error("Get betting room error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
