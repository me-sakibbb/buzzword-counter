"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Session, User, Buzzword } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { Play, Pause, Square, Send, Timer, Keyboard } from "lucide-react"

interface LiveTrackerProps {
  session: Session & {
    teacher: any
    buzzwords: Buzzword[]
  }
  user: User
}

interface BuzzwordCount {
  [key: string]: number
}

interface TimelineEntry {
  timestamp: number
  buzzword: string
}

export function LiveTracker({ session, user }: LiveTrackerProps) {
  const router = useRouter()
  const [isTracking, setIsTracking] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [counts, setCounts] = useState<BuzzwordCount>({})
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Initialize counts
  useEffect(() => {
    const initialCounts: BuzzwordCount = {}
    session.buzzwords?.forEach((buzzword) => {
      initialCounts[buzzword.id] = 0
    })
    setCounts(initialCounts)
  }, [session.buzzwords])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTracking && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTracking, startTime])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isTracking) return

      const key = event.key
      const buzzwordIndex = Number.parseInt(key) - 1

      if (buzzwordIndex >= 0 && buzzwordIndex < (session.buzzwords?.length || 0)) {
        const buzzword = session.buzzwords![buzzwordIndex]
        handleBuzzwordClick(buzzword)
      }

      // Space to pause/resume
      if (key === " " && (event.target as HTMLElement)?.tagName !== "TEXTAREA") {
        event.preventDefault()
        toggleTracking()
      }

    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [isTracking, session.buzzwords])

  const startTracking = () => {
    const now = Date.now()
    setStartTime(now)
    setIsTracking(true)
  }

  const pauseTracking = () => {
    setIsTracking(false)
  }

  const toggleTracking = () => {
    if (isTracking) {
      pauseTracking()
    } else if (startTime) {
      setIsTracking(true)
    } else {
      startTracking()
    }
  }

  const stopTracking = () => {
    setIsTracking(false)
    setShowSubmitDialog(true)
  }

  const handleBuzzwordClick = useCallback(
    async (buzzword: Buzzword) => {
      if (!isTracking || !startTime) return

      const newCounts = {
        ...counts,
        [buzzword.id]: (counts[buzzword.id] || 0) + 1,
      }
      
      setCounts(newCounts)

      setTimeline((prev) => [
        ...prev,
        {
          timestamp: Date.now() - startTime,
          buzzword: buzzword.label,
        },
      ])
      
      // Update betting room live counts in the background (fire and forget)
      // First check if there's an active room for this session
      const supabase = createClient()
      const { data: room } = await supabase
        .from("betting_rooms")
        .select("id")
        .eq("session_id", session.id)
        .eq("status", "open")
        .single()
        
      if (room) {
        fetch(`/api/betting/rooms/${room.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ live_counts: newCounts }),
        }).catch(err => console.error("Failed to sync live count to betting room", err))
      }
    },
    [isTracking, startTime, counts, session.id],
  )

  const handleSubmit = async () => {
    if (!startTime) return

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("submissions").insert({
        session_id: session.id,
        created_by: user.id,
        counts,
        timeline,
        status: "pending",
      })

      if (error) throw error

      router.push(`/sessions/${session.id}?submitted=true`)
    } catch (error) {
      console.error("Error submitting:", error)
      alert("Failed to submit. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const totalBuzzwords = Object.values(counts).reduce((sum, count) => sum + count, 0)

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={session.teacher?.avatar_url || ""} alt={session.teacher?.name || ""} />
                <AvatarFallback>{session.teacher?.name?.charAt(0).toUpperCase() || "T"}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl text-balance">{session.title}</CardTitle>
                <p className="text-muted-foreground">{session.teacher?.name}</p>
              </div>
            </div>
            <Badge variant={isTracking ? "default" : "secondary"}>{isTracking ? "Recording" : "Paused"}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold">{formatTime(elapsedTime)}</div>
                <div className="text-sm text-muted-foreground">Elapsed Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalBuzzwords}</div>
                <div className="text-sm text-muted-foreground">Total Buzzwords</div>
              </div>
            </div>
            <div className="flex gap-2">
              {!startTime ? (
                <Button onClick={startTracking} size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              ) : (
                <>
                  <Button onClick={toggleTracking} variant="outline" size="lg">
                    {isTracking ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isTracking ? "Pause" : "Resume"}
                  </Button>
                  <Button onClick={stopTracking} variant="destructive" size="lg">
                    <Square className="h-4 w-4 mr-2" />
                    Stop & Submit
                  </Button>
                </>
              )}
              <Button onClick={() => setShowKeyboardHelp(true)} variant="ghost" size="lg">
                <Keyboard className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buzzwords Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {session.buzzwords?.map((buzzword, index) => (
          <Card
            key={buzzword.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${isTracking ? "hover:scale-105 active:scale-95" : "opacity-50"
              }`}
            onClick={() => handleBuzzwordClick(buzzword)}
          >
            <CardContent className="p-6 text-center">
              <div className="text-sm text-muted-foreground mb-2">Key {index + 1}</div>
              <div className="font-semibold text-lg mb-3 text-balance">{buzzword.label}</div>
              <div className="text-3xl font-bold text-primary">{counts[buzzword.id] || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {timeline
                .slice(-10)
                .reverse()
                .map((entry, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{entry.buzzword}</span>
                    <span className="text-muted-foreground">{formatTime(entry.timestamp)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Your Tracking Data</DialogTitle>
            <DialogDescription>
              Review your buzzword counts and add any additional notes before submitting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Duration: {formatTime(elapsedTime)}</div>
                <div>Total Buzzwords: {totalBuzzwords}</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Buzzword Counts</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {session.buzzwords?.map((buzzword) => (
                  <div key={buzzword.id} className="flex justify-between">
                    <span>{buzzword.label}:</span>
                    <span className="font-medium">{counts[buzzword.id] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any observations or comments about the session..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Submitting..." : "Submit Data"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard Help Dialog */}
      <Dialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>Use these shortcuts for faster buzzword tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Buzzword Keys</h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {session.buzzwords?.slice(0, 9).map((buzzword, index) => (
                  <div key={buzzword.id} className="flex justify-between">
                    <span>{buzzword.label}</span>
                    <Badge variant="outline">{index + 1}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Control Keys</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Pause/Resume</span>
                  <Badge variant="outline">Space</Badge>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
