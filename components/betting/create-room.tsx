"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Coins, Loader2 } from "lucide-react"

interface CreateBettingRoomProps {
  sessionId: string
}

export function CreateBettingRoom({ sessionId }: CreateBettingRoomProps) {
  const router = useRouter()
  const [initialBalance, setInitialBalance] = useState("1000")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)
    const balance = parseInt(initialBalance)
    if (isNaN(balance) || balance < 1) {
      setError("Please enter a valid initial balance (minimum 1)")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/betting/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, initial_balance: balance }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "Failed to create betting room")
        return
      }

      // Redirect to the admin betting view
      router.push(`/sessions/${sessionId}/betting/admin`)
    } catch (err) {
      setError("Network error occurred")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-6 w-6 text-yellow-500" />
          <CardTitle>Create Betting Room</CardTitle>
        </div>
        <CardDescription>
          Open a betting market for this session. Users will use BuzzCoins to predict buzzword counts and events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="initial-balance">Starting BuzzCoins for New Users</Label>
          <Input
            id="initial-balance"
            type="number"
            min="1"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="e.g. 1000"
          />
          <p className="text-xs text-muted-foreground">
            Users who haven't played before will start with this balance. Existing users keep their lifetime balance. Broke users will be replenished with this amount.
          </p>
        </div>
        
        {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        
        <Button className="w-full" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Coins className="h-4 w-4 mr-2" />}
          {creating ? "Creating..." : "Create Betting Room"}
        </Button>
      </CardContent>
    </Card>
  )
}
