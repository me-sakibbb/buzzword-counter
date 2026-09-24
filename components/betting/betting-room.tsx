"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { BettingRoom, BettingMarket, Bet, User } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Coins, TrendingUp, Clock, Eye, EyeOff, Loader2 } from "lucide-react"

interface BettingRoomViewProps {
  roomId: string
  user: User
}

interface RoomData {
  room: BettingRoom & { session: any }
  markets: BettingMarket[]
  bets: (Bet & { user?: any })[]
  participants: any[]
  leaderboard: any[]
  isParticipant: boolean
  userBalance: number | null
}

export function BettingRoomView({ roomId, user }: BettingRoomViewProps) {
  const [data, setData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/betting/rooms/${roomId}`)
      if (!res.ok) throw new Error("Failed to load room")
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError("Failed to load betting room")
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    fetchRoom()
  }, [fetchRoom])

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase.channel(`betting-room-${roomId}`)

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_markets", filter: `room_id=eq.${roomId}` }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_rooms", filter: `id=eq.${roomId}` }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_balances" }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_room_participants", filter: `room_id=eq.${roomId}` }, () => fetchRoom())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase, fetchRoom])

  const handleJoin = async () => {
    setJoining(true)
    try {
      const res = await fetch("/api/betting/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId }),
      })
      if (!res.ok) throw new Error("Failed to join")
      await fetchRoom()
    } catch {
      setError("Failed to join room")
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading betting room...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error || "Room not found"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not yet a participant — show join screen
  if (!data.isParticipant) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4">
                <Coins className="h-16 w-16 text-yellow-500" />
              </div>
              <CardTitle className="text-2xl">🎰 BuzzCoins Betting Room</CardTitle>
              <CardDescription className="text-base">
                {data.room.session?.title} — {data.room.session?.teacher?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Starting Balance</p>
                <p className="text-3xl font-bold text-yellow-500">🪙 {data.room.initial_balance}</p>
                <p className="text-xs text-muted-foreground mt-1">BuzzCoins</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>👥 {data.participants.length} players joined</p>
                <p>📊 {data.markets.filter((m) => m.status === "open").length} open markets</p>
              </div>
              <Button size="lg" className="w-full" onClick={handleJoin} disabled={joining}>
                {joining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Coins className="h-4 w-4 mr-2" />}
                {joining ? "Joining..." : "Join & Start Betting"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const myBets = data.bets.filter((b) => b.user_id === user.id)
  const myBetMarketIds = new Set(myBets.map((b) => b.market_id))
  const liveCounts = data.room.live_counts || {}

  const totalCountMarkets = data.markets.filter((m) => m.type === "total_count")
  const timedMarkets = data.markets.filter((m) => m.type === "timed_yes_no")

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                🎰 {data.room.session?.title}
              </CardTitle>
              <CardDescription>{data.room.session?.teacher?.name}</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-muted-foreground">Your Balance</p>
                <p className="text-xl font-bold text-yellow-500">🪙 {data.userBalance ?? 0}</p>
              </div>
              <Badge variant={data.room.status === "open" ? "default" : "secondary"}>
                {data.room.status === "open" ? "🔴 LIVE" : "Closed"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Markets */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="predictions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="predictions">
                <TrendingUp className="h-4 w-4 mr-2" />
                Predict Counts ({totalCountMarkets.length})
              </TabsTrigger>
              <TabsTrigger value="timed">
                <Clock className="h-4 w-4 mr-2" />
                Timed Bets ({timedMarkets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="predictions" className="space-y-4 mt-4">
              {totalCountMarkets.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No prediction markets available yet.
                  </CardContent>
                </Card>
              ) : (
                totalCountMarkets.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    bets={data.bets.filter((b) => b.market_id === market.id)}
                    myBet={myBets.find((b) => b.market_id === market.id)}
                    hasBet={myBetMarketIds.has(market.id)}
                    liveCount={liveCounts[market.buzzword_id]}
                    userBalance={data.userBalance ?? 0}
                    onBetPlaced={fetchRoom}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="timed" className="space-y-4 mt-4">
              {timedMarkets.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No timed bets available yet. The admin will create them during the session.
                  </CardContent>
                </Card>
              ) : (
                timedMarkets.map((market) => (
                  <TimedMarketCard
                    key={market.id}
                    market={market}
                    bets={data.bets.filter((b) => b.market_id === market.id)}
                    myBet={myBets.find((b) => b.market_id === market.id)}
                    hasBet={myBetMarketIds.has(market.id)}
                    liveCount={liveCounts[market.buzzword_id]}
                    userBalance={data.userBalance ?? 0}
                    onBetPlaced={fetchRoom}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Leaderboard */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.leaderboard.map((entry, idx) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      entry.user_id === user.id ? "bg-primary/10 border border-primary/20" : ""
                    }`}
                  >
                    <span className="text-lg font-bold w-6 text-center">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={entry.user?.photo_url || ""} />
                      <AvatarFallback className="text-xs">
                        {entry.user?.name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.user?.name || "Anonymous"}
                        {entry.user_id === user.id && " (You)"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-yellow-500">🪙 {entry.balance}</span>
                  </div>
                ))}
                {data.leaderboard.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No players yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* My Bets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">My Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myBets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No bets placed yet</p>
                ) : (
                  myBets.map((bet) => {
                    const market = data.markets.find((m) => m.id === bet.market_id)
                    return (
                      <div key={bet.id} className="p-2 rounded-lg bg-muted text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">{market?.buzzword_label}</span>
                          <Badge variant={market?.status === "resolved" ? (bet.payout > 0 ? "default" : "destructive") : "secondary"} className="text-xs">
                            {market?.status === "resolved" ? (bet.payout > 0 ? `Won 🪙${bet.payout}` : "Lost") : "Pending"}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>
                            {bet.prediction !== null && bet.prediction !== undefined ? `Predicted: ${bet.prediction}` : `Side: ${bet.side?.toUpperCase()}`}
                          </span>
                          <span>Wager: 🪙{bet.wager}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---- Market Card Component (Total Count) ----
function MarketCard({
  market,
  bets,
  myBet,
  hasBet,
  liveCount,
  userBalance,
  onBetPlaced,
}: {
  market: BettingMarket
  bets: (Bet & { user?: any })[]
  myBet?: Bet
  hasBet: boolean
  liveCount?: number
  userBalance: number
  onBetPlaced: () => void
}) {
  const [showBetDialog, setShowBetDialog] = useState(false)
  const [prediction, setPrediction] = useState("")
  const [wager, setWager] = useState("")
  const [placing, setPlacing] = useState(false)
  const [betError, setBetError] = useState("")

  const totalPot = bets.reduce((s, b) => s + b.wager, 0)
  const betCount = bets.length

  const handlePlaceBet = async () => {
    setBetError("")
    const pred = parseInt(prediction)
    const wag = parseInt(wager)

    if (isNaN(pred) || pred < 0) { setBetError("Enter a valid prediction"); return }
    if (isNaN(wag) || wag < 1) { setBetError("Enter a valid wager"); return }
    if (wag > userBalance) { setBetError("Insufficient BuzzCoins"); return }

    setPlacing(true)
    try {
      const res = await fetch("/api/betting/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: market.id, prediction: pred, wager: wag }),
      })
      const json = await res.json()
      if (!res.ok) { setBetError(json.error || "Failed to place bet"); return }
      setShowBetDialog(false)
      setPrediction("")
      setWager("")
      onBetPlaced()
    } catch {
      setBetError("Network error")
    } finally {
      setPlacing(false)
    }
  }

  return (
    <Card className={market.status === "resolved" ? "opacity-75" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{market.buzzword_label}</h3>
            <p className="text-sm text-muted-foreground">
              How many times will &quot;{market.buzzword_label}&quot; be said?
            </p>
          </div>
          <Badge variant={market.status === "open" ? "default" : market.status === "resolved" ? "secondary" : "outline"}>
            {market.status}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Pot</p>
            <p className="font-bold text-yellow-500">🪙 {totalPot}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Bets</p>
            <p className="font-bold">{betCount}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Live Count</p>
            {hasBet ? (
              <p className="font-bold text-primary flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" /> {liveCount ?? "—"}
              </p>
            ) : (
              <p className="font-bold text-muted-foreground flex items-center justify-center gap-1">
                <EyeOff className="h-3 w-3" /> Bet to see
              </p>
            )}
          </div>
        </div>

        {market.status === "resolved" && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
            <p className="text-sm font-medium">Final count: <span className="text-primary font-bold">{market.resolved_value}</span></p>
            {myBet && (
              <p className="text-sm mt-1">
                Your prediction: {myBet.prediction} —{" "}
                {myBet.payout > 0 ? (
                  <span className="text-green-500 font-bold">Won 🪙{myBet.payout}! 🎉</span>
                ) : (
                  <span className="text-red-400">Better luck next time</span>
                )}
              </p>
            )}
          </div>
        )}

        {market.status === "open" && !hasBet && (
          <Dialog open={showBetDialog} onOpenChange={setShowBetDialog}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Coins className="h-4 w-4 mr-2" />
                Place Bet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bet on &quot;{market.buzzword_label}&quot;</DialogTitle>
                <DialogDescription>
                  Predict the total count and set your wager. Top 3 closest split the pot (60/25/15%).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Your Prediction</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="How many times?"
                    value={prediction}
                    onChange={(e) => setPrediction(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Wager (Balance: 🪙{userBalance})</label>
                  <Input
                    type="number"
                    min="1"
                    max={userBalance}
                    placeholder="BuzzCoins to wager"
                    value={wager}
                    onChange={(e) => setWager(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    {[10, 25, 50, 100].map((amt) => (
                      <Button
                        key={amt}
                        variant="outline"
                        size="sm"
                        disabled={amt > userBalance}
                        onClick={() => setWager(String(Math.min(amt, userBalance)))}
                      >
                        {amt}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setWager(String(userBalance))}>
                      All-In
                    </Button>
                  </div>
                </div>
                {betError && <p className="text-sm text-destructive">{betError}</p>}
                <Button className="w-full" onClick={handlePlaceBet} disabled={placing}>
                  {placing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {placing ? "Placing..." : "Confirm Bet"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {hasBet && market.status === "open" && (
          <div className="p-3 rounded-lg bg-muted text-sm">
            <p>✅ Your prediction: <span className="font-bold">{myBet?.prediction}</span> — Wager: <span className="font-bold text-yellow-500">🪙{myBet?.wager}</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---- Timed Market Card Component (Yes/No) ----
function TimedMarketCard({
  market,
  bets,
  myBet,
  hasBet,
  liveCount,
  userBalance,
  onBetPlaced,
}: {
  market: BettingMarket
  bets: (Bet & { user?: any })[]
  myBet?: Bet
  hasBet: boolean
  liveCount?: number
  userBalance: number
  onBetPlaced: () => void
}) {
  const [side, setSide] = useState<"yes" | "no" | null>(null)
  const [wager, setWager] = useState("")
  const [placing, setPlacing] = useState(false)
  const [betError, setBetError] = useState("")
  const [timeLeft, setTimeLeft] = useState("")

  const totalPot = bets.reduce((s, b) => s + b.wager, 0)
  const yesBets = bets.filter((b) => b.side === "yes")
  const noBets = bets.filter((b) => b.side === "no")
  const yesPool = yesBets.reduce((s, b) => s + b.wager, 0)
  const noPool = noBets.reduce((s, b) => s + b.wager, 0)

  // Timer countdown
  useEffect(() => {
    if (!market.time_window_end || market.status === "resolved") return
    const interval = setInterval(() => {
      const diff = new Date(market.time_window_end!).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft("Expired")
        clearInterval(interval)
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [market.time_window_end, market.status])

  const handlePlaceBet = async () => {
    setBetError("")
    if (!side) { setBetError("Pick YES or NO"); return }
    const wag = parseInt(wager)
    if (isNaN(wag) || wag < 1) { setBetError("Enter a valid wager"); return }
    if (wag > userBalance) { setBetError("Insufficient BuzzCoins"); return }

    setPlacing(true)
    try {
      const res = await fetch("/api/betting/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: market.id, side, wager: wag }),
      })
      const json = await res.json()
      if (!res.ok) { setBetError(json.error || "Failed"); return }
      setSide(null)
      setWager("")
      onBetPlaced()
    } catch {
      setBetError("Network error")
    } finally {
      setPlacing(false)
    }
  }

  return (
    <Card className={market.status === "resolved" ? "opacity-75" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Will &quot;{market.buzzword_label}&quot; be said?
            </h3>
            <p className="text-sm text-muted-foreground">
              Within {market.time_window_minutes} minutes
            </p>
          </div>
          <div className="text-right">
            <Badge variant={market.status === "open" ? "default" : "secondary"}>
              {market.status === "resolved" ? "Resolved" : timeLeft || "—"}
            </Badge>
          </div>
        </div>

        {/* Yes/No pools */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-green-500">YES Pool</p>
            <p className="font-bold">🪙 {yesPool}</p>
            <p className="text-xs text-muted-foreground">{yesBets.length} bets</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Total Pot</p>
            <p className="font-bold text-yellow-500">🪙 {totalPot}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-500">NO Pool</p>
            <p className="font-bold">🪙 {noPool}</p>
            <p className="text-xs text-muted-foreground">{noBets.length} bets</p>
          </div>
        </div>

        {/* Live count (pay-to-see) */}
        {hasBet && (
          <div className="text-center p-2 rounded-lg bg-muted mb-4">
            <p className="text-xs text-muted-foreground">Current Count</p>
            <p className="font-bold text-primary">{liveCount ?? "—"}</p>
          </div>
        )}

        {market.status === "resolved" && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
            <p className="text-sm font-medium">
              Result: Word was {(market.resolved_value ?? 0) > (market.baseline_count ?? 0) ? (
                <span className="text-green-500 font-bold">SAID ✅</span>
              ) : (
                <span className="text-red-400 font-bold">NOT SAID ❌</span>
              )}
            </p>
            {myBet && (
              <p className="text-sm mt-1">
                You bet {myBet.side?.toUpperCase()} —{" "}
                {myBet.payout > 0 ? (
                  <span className="text-green-500 font-bold">Won 🪙{myBet.payout}! 🎉</span>
                ) : (
                  <span className="text-red-400">Lost 🪙{myBet.wager}</span>
                )}
              </p>
            )}
          </div>
        )}

        {market.status === "open" && !hasBet && timeLeft !== "Expired" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={side === "yes" ? "default" : "outline"}
                className={side === "yes" ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setSide("yes")}
              >
                👍 YES
              </Button>
              <Button
                variant={side === "no" ? "default" : "outline"}
                className={side === "no" ? "bg-red-600 hover:bg-red-700" : ""}
                onClick={() => setSide("no")}
              >
                👎 NO
              </Button>
            </div>
            {side && (
              <div className="space-y-2">
                <Input
                  type="number"
                  min="1"
                  max={userBalance}
                  placeholder={`Wager (Balance: 🪙${userBalance})`}
                  value={wager}
                  onChange={(e) => setWager(e.target.value)}
                />
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map((amt) => (
                    <Button key={amt} variant="outline" size="sm" disabled={amt > userBalance} onClick={() => setWager(String(Math.min(amt, userBalance)))}>
                      {amt}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setWager(String(userBalance))}>All-In</Button>
                </div>
                {betError && <p className="text-sm text-destructive">{betError}</p>}
                <Button className="w-full" onClick={handlePlaceBet} disabled={placing}>
                  {placing ? "Placing..." : `Bet ${side.toUpperCase()} for 🪙${wager || 0}`}
                </Button>
              </div>
            )}
          </div>
        )}

        {hasBet && market.status === "open" && (
          <div className="p-3 rounded-lg bg-muted text-sm">
            <p>✅ You bet <span className="font-bold">{myBet?.side?.toUpperCase()}</span> — Wager: <span className="font-bold text-yellow-500">🪙{myBet?.wager}</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
