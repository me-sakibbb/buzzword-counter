import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// POST - Create a new market (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { room_id, type, buzzword_id, buzzword_label, time_window_minutes, baseline_count } = body

    if (!room_id || !type || !buzzword_id || !buzzword_label) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const marketData: any = {
      room_id,
      type,
      buzzword_id,
      buzzword_label,
      status: "open",
    }

    // For timed bets, set the time window
    if (type === "timed_yes_no") {
      if (!time_window_minutes || baseline_count === undefined) {
        return NextResponse.json({ error: "Timed bets require time_window_minutes and baseline_count" }, { status: 400 })
      }
      const now = new Date()
      const end = new Date(now.getTime() + time_window_minutes * 60 * 1000)
      marketData.time_window_minutes = time_window_minutes
      marketData.time_window_start = now.toISOString()
      marketData.time_window_end = end.toISOString()
      marketData.baseline_count = baseline_count
    }

    const { data: market, error } = await supabase
      .from("betting_markets")
      .insert(marketData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(market)
  } catch (error) {
    console.error("Create market error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update market status (lock/close)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const { market_id, status } = await request.json()

    const { error } = await supabase
      .from("betting_markets")
      .update({ status })
      .eq("id", market_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update market error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
