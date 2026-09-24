import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// POST - Place a bet
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { market_id, prediction, side, wager } = await request.json()

    if (!market_id || !wager || wager < 1) {
      return NextResponse.json({ error: "Missing market_id or invalid wager" }, { status: 400 })
    }

    // Get the market
    const { data: market } = await supabase
      .from("betting_markets")
      .select("*")
      .eq("id", market_id)
      .single()

    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 })
    if (market.status !== "open") return NextResponse.json({ error: "Market is not open" }, { status: 400 })

    // Validate bet type
    if (market.type === "total_count" && prediction === undefined) {
      return NextResponse.json({ error: "Total count bet requires a prediction" }, { status: 400 })
    }
    if (market.type === "timed_yes_no" && !side) {
      return NextResponse.json({ error: "Timed bet requires a side (yes/no)" }, { status: 400 })
    }

    // Check timed bet hasn't expired
    if (market.type === "timed_yes_no" && market.time_window_end) {
      if (new Date(market.time_window_end) <= new Date()) {
        return NextResponse.json({ error: "Timed bet has expired" }, { status: 400 })
      }
    }

    // Check user hasn't already bet on this market (for total_count)
    // For timed bets, users can only bet once too
    const { data: existingBet } = await supabase
      .from("bets")
      .select("id")
      .eq("market_id", market_id)
      .eq("user_id", user.id)
      .single()

    if (existingBet) {
      return NextResponse.json({ error: "You already placed a bet on this market" }, { status: 400 })
    }

    // Get user balance
    const { data: balance } = await supabase
      .from("betting_balances")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!balance || balance.balance < wager) {
      return NextResponse.json({ error: "Insufficient BuzzCoins" }, { status: 400 })
    }

    // Place the bet and deduct balance atomically
    const { error: betError } = await supabase.from("bets").insert({
      market_id,
      user_id: user.id,
      prediction: market.type === "total_count" ? prediction : null,
      side: market.type === "timed_yes_no" ? side : null,
      wager,
      payout: 0,
    })

    if (betError) return NextResponse.json({ error: betError.message }, { status: 500 })

    // Deduct wager from balance
    const { error: balanceError } = await supabase
      .from("betting_balances")
      .update({
        balance: balance.balance - wager,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    if (balanceError) return NextResponse.json({ error: balanceError.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      new_balance: balance.balance - wager,
    })
  } catch (error) {
    console.error("Place bet error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
