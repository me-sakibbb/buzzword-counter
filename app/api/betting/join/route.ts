import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// POST - Join a betting room
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { room_id } = await request.json()

    if (!room_id) {
      return NextResponse.json({ error: "Missing room_id" }, { status: 400 })
    }

    // Get the room
    const { data: room } = await supabase
      .from("betting_rooms")
      .select("*")
      .eq("id", room_id)
      .single()

    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })
    if (room.status !== "open") return NextResponse.json({ error: "Room is closed" }, { status: 400 })

    // Check if already a participant
    const { data: existing } = await supabase
      .from("betting_room_participants")
      .select("id")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .single()

    if (existing) {
      return NextResponse.json({ success: true, message: "Already joined" })
    }

    // Get or create user balance
    const { data: balance } = await supabase
      .from("betting_balances")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!balance) {
      // First time ever — create balance with initial amount
      await supabase.from("betting_balances").insert({
        user_id: user.id,
        balance: room.initial_balance,
        updated_at: new Date().toISOString(),
      })
    } else if (balance.balance <= 0) {
      // If user is broke, give them the initial balance for this room
      await supabase
        .from("betting_balances")
        .update({
          balance: balance.balance + room.initial_balance,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
    }

    // Get the (possibly just created) balance
    const { data: currentBalance } = await supabase
      .from("betting_balances")
      .select("balance")
      .eq("user_id", user.id)
      .single()

    // Add as participant
    const { error } = await supabase.from("betting_room_participants").insert({
      room_id,
      user_id: user.id,
      starting_balance: currentBalance?.balance ?? room.initial_balance,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      balance: currentBalance?.balance ?? room.initial_balance,
    })
  } catch (error) {
    console.error("Join room error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
