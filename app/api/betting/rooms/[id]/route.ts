import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Get room details by room ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const roomId = params.id

    const { data: room } = await supabase
      .from("betting_rooms")
      .select("*, session:sessions(*, teacher:teachers(*))")
      .eq("id", roomId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Get markets for this room
    const { data: markets } = await supabase
      .from("betting_markets")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })

    // Get all bets for these markets
    const marketIds = markets?.map((m) => m.id) || []
    const { data: bets } = marketIds.length > 0
      ? await supabase
          .from("bets")
          .select("*, user:users(id, name, photo_url)")
          .in("market_id", marketIds)
      : { data: [] }

    // Get participants
    const { data: participants } = await supabase
      .from("betting_room_participants")
      .select("*, user:users(id, name, photo_url)")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true })

    // Get leaderboard (all participants with balances)
    const participantUserIds = participants?.map((p) => p.user_id) || []
    const { data: balances } = participantUserIds.length > 0
      ? await supabase
          .from("betting_balances")
          .select("*, user:users(id, name, photo_url)")
          .in("user_id", participantUserIds)
          .order("balance", { ascending: false })
      : { data: [] }

    // Check if current user is a participant
    const isParticipant = participants?.some((p) => p.user_id === user.id) || false

    // Get current user's balance
    const { data: userBalance } = await supabase
      .from("betting_balances")
      .select("*")
      .eq("user_id", user.id)
      .single()

    return NextResponse.json({
      room,
      markets: markets || [],
      bets: bets || [],
      participants: participants || [],
      leaderboard: balances || [],
      isParticipant,
      userBalance: userBalance?.balance ?? null,
    })
  } catch (error) {
    console.error("Get room details error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update room (close room, update live counts)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const roomId = params.id

    // If updating live_counts, any authenticated user (tracker) can do it
    if (body.live_counts !== undefined) {
      const { error } = await supabase
        .from("betting_rooms")
        .update({ live_counts: body.live_counts })
        .eq("id", roomId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // For status changes, admin only
    const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const { error } = await supabase
      .from("betting_rooms")
      .update({ status: body.status })
      .eq("id", roomId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update room error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
