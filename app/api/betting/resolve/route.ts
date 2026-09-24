import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// POST - Resolve a market
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Admin check
    const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const { market_id, resolved_value } = await request.json()

    if (!market_id || resolved_value === undefined) {
      return NextResponse.json({ error: "Missing market_id or resolved_value" }, { status: 400 })
    }

    // Get the market
    const { data: market } = await supabase
      .from("betting_markets")
      .select("*")
      .eq("id", market_id)
      .single()

    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 })
    if (market.status === "resolved") return NextResponse.json({ error: "Already resolved" }, { status: 400 })

    // Get all bets for this market
    const { data: bets } = await supabase
      .from("bets")
      .select("*")
      .eq("market_id", market_id)

    if (!bets || bets.length === 0) {
      // No bets, just mark as resolved
      await supabase
        .from("betting_markets")
        .update({ status: "resolved", resolved_value, resolved_at: new Date().toISOString() })
        .eq("id", market_id)
      return NextResponse.json({ success: true, message: "No bets to resolve" })
    }

    const totalPot = bets.reduce((sum, bet) => sum + bet.wager, 0)

    if (market.type === "total_count") {
      // Rank by closeness to resolved_value
      const ranked = bets
        .map((bet) => ({
          ...bet,
          distance: Math.abs((bet.prediction ?? 0) - resolved_value),
        }))
        .sort((a, b) => a.distance - b.distance)

      // Group by distance for tie handling
      const groups: { distance: number; bets: typeof ranked }[] = []
      for (const bet of ranked) {
        const lastGroup = groups[groups.length - 1]
        if (lastGroup && lastGroup.distance === bet.distance) {
          lastGroup.bets.push(bet)
        } else {
          groups.push({ distance: bet.distance, bets: [bet] })
        }
      }

      // Assign payouts: 60% / 25% / 15% for top 3
      const payoutShares = [0.6, 0.25, 0.15]
      let currentRank = 1

      for (let i = 0; i < groups.length && currentRank <= 3; i++) {
        const group = groups[i]
        // Calculate combined share for tied positions
        let combinedShare = 0
        for (let r = currentRank; r <= Math.min(currentRank + group.bets.length - 1, 3); r++) {
          combinedShare += payoutShares[r - 1] || 0
        }

        const payoutPerBet = Math.floor((totalPot * combinedShare) / group.bets.length)

        for (const bet of group.bets) {
          const rank = currentRank
          await supabase
            .from("bets")
            .update({ payout: payoutPerBet, rank })
            .eq("id", bet.id)

          // Credit winnings to user balance
          await supabase.rpc("increment_balance", {
            p_user_id: bet.user_id,
            p_amount: payoutPerBet,
          }).then(() => {}).catch(async () => {
            // Fallback: manual update if RPC doesn't exist
            const { data: bal } = await supabase
              .from("betting_balances")
              .select("balance")
              .eq("user_id", bet.user_id)
              .single()
            if (bal) {
              await supabase
                .from("betting_balances")
                .update({
                  balance: bal.balance + payoutPerBet,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", bet.user_id)
            }
          })
        }

        currentRank += group.bets.length
      }

      // Non-winners get rank = null, payout = 0 (already default)

    } else if (market.type === "timed_yes_no") {
      // Binary resolution: did the count increase?
      const baselineCount = market.baseline_count ?? 0
      const wordWasSaid = resolved_value > baselineCount
      const winningSide = wordWasSaid ? "yes" : "no"

      const winners = bets.filter((b) => b.side === winningSide)
      const losers = bets.filter((b) => b.side !== winningSide)

      if (winners.length === 0) {
        // No winners — refund everyone
        for (const bet of bets) {
          await supabase.from("bets").update({ payout: bet.wager }).eq("id", bet.id)
          const { data: bal } = await supabase
            .from("betting_balances")
            .select("balance")
            .eq("user_id", bet.user_id)
            .single()
          if (bal) {
            await supabase
              .from("betting_balances")
              .update({
                balance: bal.balance + bet.wager,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", bet.user_id)
          }
        }
      } else {
        // Winners split the pot proportionally to their wager
        const winnersPool = winners.reduce((s, b) => s + b.wager, 0)

        for (const bet of winners) {
          const share = bet.wager / winnersPool
          const payout = Math.floor(totalPot * share)

          await supabase.from("bets").update({ payout, rank: 1 }).eq("id", bet.id)

          const { data: bal } = await supabase
            .from("betting_balances")
            .select("balance")
            .eq("user_id", bet.user_id)
            .single()
          if (bal) {
            await supabase
              .from("betting_balances")
              .update({
                balance: bal.balance + payout,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", bet.user_id)
          }
        }
      }
    }

    // Mark market as resolved
    await supabase
      .from("betting_markets")
      .update({
        status: "resolved",
        resolved_value,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", market_id)

    return NextResponse.json({ success: true, totalPot })
  } catch (error) {
    console.error("Resolve market error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
