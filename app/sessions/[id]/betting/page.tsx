import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import { BettingRoomView } from "@/components/betting/betting-room"

interface BettingPageProps {
  params: Promise<{ id: string }>
}

export default async function BettingPage({ params }: BettingPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/sessions/${id}`)
  }

  // Get active betting room for this session
  const { data: room } = await supabase
    .from("betting_rooms")
    .select("id")
    .eq("session_id", id)
    .eq("status", "open")
    .single()

  if (!room) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <h2 className="text-2xl font-bold mb-2">No Active Betting Room</h2>
        <p className="text-muted-foreground">The admin has not opened a betting room for this session yet.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <BettingRoomView roomId={room.id} user={user} />
    </div>
  )
}
