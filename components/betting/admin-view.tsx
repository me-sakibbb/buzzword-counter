"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { BettingRoom, BettingMarket, Bet, User } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Coins, Clock, Settings, Loader2, CheckCircle, Lock, Play, Square } from "lucide-react"

interface AdminBettingViewProps {
  roomId: string
  user: User
  sessionBuzzwords: { id: string; label: string }[]
}

interface RoomData {
  room: BettingRoom & { session: any }
  markets: BettingMarket[]
  bets: (Bet & { user?: any })[]
  participants: any[]
}

export function AdminBettingView({ roomId, user, sessionBuzzwords }: AdminBettingViewProps) {
  const [data, setData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const supabase = createClient()

  // New Market State
  const [newMarketWord, setNewMarketWord] = useState("")
  const [newMarketTime, setNewMarketTime] = useState("5")
  const [creatingMarket, setCreatingMarket] = useState(false)

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
    const channel = supabase.channel(`admin-betting-${roomId}`)
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_markets", filter: `room_id=eq.${roomId}` }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_rooms", filter: `id=eq.${roomId}` }, () => fetchRoom())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, supabase, fetchRoom])

  const handleUpdateMarketStatus = async (marketId: string, status: "locked" | "open") => {
    setProcessing(`status-${marketId}`)
    try {
      await fetch("/api/betting/markets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: marketId, status }),
      })
      await fetchRoom()
    } finally {
      setProcessing(null)
    }
  }

  const handleResolveMarket = async (marketId: string, resolvedValue: number) => {
    setProcessing(`resolve-${marketId}`)
    try {
      await fetch("/api/betting/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: marketId, resolved_value: resolvedValue }),
      })
      await fetchRoom()
    } finally {
      setProcessing(null)
    }
  }

  const handleCreateTimedMarket = async () => {
    if (!newMarketWord || !newMarketTime) return
    setCreatingMarket(true)
    
    // Get the current live count for baseline
    const baseline = data?.room.live_counts?.[newMarketWord] || 0
    const buzzwordLabel = sessionBuzzwords.find(b => b.id === newMarketWord)?.label || "Unknown"

    try {
      await fetch("/api/betting/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          type: "timed_yes_no",
          buzzword_id: newMarketWord,
          buzzword_label: buzzwordLabel,
          time_window_minutes: parseInt(newMarketTime),
          baseline_count: baseline
        }),
      })
      setNewMarketWord("")
      await fetchRoom()
    } finally {
      setCreatingMarket(false)
    }
  }
  
  const handleToggleRoomStatus = async () => {
    if (!data) return
    setProcessing("room-status")
    try {
        const newStatus = data.room.status === "open" ? "closed" : "open"
        await fetch(`/api/betting/rooms/${roomId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
        })
        await fetchRoom()
    } finally {
        setProcessing(null)
    }
  }


  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error || !data) return <div className="p-12 text-center text-destructive">{error}</div>

  const totalCountMarkets = data.markets.filter(m => m.type === "total_count")
  const timedMarkets = data.markets.filter(m => m.type === "timed_yes_no")
  const liveCounts = data.room.live_counts || {}

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" /> Betting Admin Panel
          </h1>
          <p className="text-muted-foreground">{data.room.session?.title}</p>
        </div>
        <div className="flex gap-4 items-center">
            <Badge variant={data.room.status === "open" ? "default" : "secondary"}>
                {data.room.status.toUpperCase()}
            </Badge>
            <Button 
                variant={data.room.status === "open" ? "destructive" : "default"}
                onClick={handleToggleRoomStatus}
                disabled={processing === "room-status"}
            >
                {processing === "room-status" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {data.room.status === "open" ? "Close Room" : "Open Room"}
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="markets">
            <TabsList>
              <TabsTrigger value="markets">Prediction Markets ({totalCountMarkets.length})</TabsTrigger>
              <TabsTrigger value="timed">Timed Bets ({timedMarkets.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="markets" className="space-y-4 mt-4">
              {totalCountMarkets.map(market => {
                const bets = data.bets.filter(b => b.market_id === market.id)
                const pot = bets.reduce((s, b) => s + b.wager, 0)
                const currentCount = liveCounts[market.buzzword_id] || 0
                return (
                  <Card key={market.id}>
                    <CardHeader className="py-4 flex flex-row items-center justify-between bg-muted/50">
                      <div>
                        <CardTitle className="text-lg">{market.buzzword_label}</CardTitle>
                        <CardDescription>Predict Total Count</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={market.status === "open" ? "default" : market.status === "resolved" ? "secondary" : "outline"}>
                            {market.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <div className="space-x-4">
                          <span>Pot: <strong className="text-yellow-500">🪙{pot}</strong></span>
                          <span>Bets: <strong>{bets.length}</strong></span>
                          <span>Live Count: <strong className="text-primary">{currentCount}</strong></span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {market.status === "open" && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleUpdateMarketStatus(market.id, "locked")}
                                disabled={processing === `status-${market.id}`}
                            >
                                <Lock className="h-4 w-4 mr-2" /> Lock (Stop Bets)
                            </Button>
                        )}
                        {market.status === "locked" && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleUpdateMarketStatus(market.id, "open")}
                                disabled={processing === `status-${market.id}`}
                            >
                                <Play className="h-4 w-4 mr-2" /> Re-open
                            </Button>
                        )}
                        {market.status !== "resolved" && (
                            <Button 
                                size="sm"
                                onClick={() => handleResolveMarket(market.id, currentCount)}
                                disabled={processing === `resolve-${market.id}`}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" /> Resolve with count {currentCount}
                            </Button>
                        )}
                        {market.status === "resolved" && (
                            <div className="text-sm font-medium text-green-500">
                                Resolved with count: {market.resolved_value}
                            </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>

            <TabsContent value="timed" className="space-y-4 mt-4">
               {timedMarkets.map(market => {
                const bets = data.bets.filter(b => b.market_id === market.id)
                const pot = bets.reduce((s, b) => s + b.wager, 0)
                const currentCount = liveCounts[market.buzzword_id] || 0
                return (
                  <Card key={market.id}>
                    <CardHeader className="py-4 flex flex-row items-center justify-between bg-muted/50">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5" /> {market.buzzword_label}
                        </CardTitle>
                        <CardDescription>Will say within {market.time_window_minutes} mins</CardDescription>
                      </div>
                      <Badge variant={market.status === "open" ? "default" : market.status === "resolved" ? "secondary" : "outline"}>
                        {market.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <div className="space-x-4">
                          <span>Pot: <strong className="text-yellow-500">🪙{pot}</strong></span>
                          <span>Baseline: <strong>{market.baseline_count}</strong></span>
                          <span>Live: <strong className="text-primary">{currentCount}</strong></span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                         {market.status !== "resolved" && (
                            <Button 
                                size="sm"
                                onClick={() => handleResolveMarket(market.id, currentCount)}
                                disabled={processing === `resolve-${market.id}`}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" /> Resolve Now
                            </Button>
                        )}
                        {market.status === "resolved" && (
                            <div className="text-sm font-medium">
                                Word was {(market.resolved_value ?? 0) > (market.baseline_count ?? 0) ? <span className="text-green-500">SAID</span> : <span className="text-red-500">NOT SAID</span>}
                            </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {timedMarkets.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg">
                      No timed bets created yet.
                  </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Timed Bet</CardTitle>
              <CardDescription>Open a quick YES/NO market</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Buzzword</Label>
                <Select value={newMarketWord} onValueChange={setNewMarketWord}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select buzzword" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionBuzzwords.map(bw => (
                        <SelectItem key={bw.id} value={bw.id}>{bw.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time Window (minutes)</Label>
                <Select value={newMarketTime} onValueChange={setNewMarketTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 minutes</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full" 
                onClick={handleCreateTimedMarket}
                disabled={!newMarketWord || creatingMarket}
              >
                {creatingMarket ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
                Create Timed Market
              </Button>
            </CardContent>
          </Card>
          
           <Card>
            <CardHeader>
              <CardTitle>Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Total count markets will automatically resolve when you stop and submit the live tracker.</p>
                <p>• Timed bets need to be manually resolved or will auto-resolve if a chron job was set up.</p>
                <p>• You can lock markets to stop taking new bets while keeping them unresolved.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
