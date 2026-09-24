import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import { CreateBettingRoom } from "@/components/betting/create-room"
import { AdminBettingView } from "@/components/betting/admin-view"
import { AuthGuard } from "@/components/auth/auth-guard"

interface BettingAdminPageProps {
  params: Promise<{ id: string }>
}

export default async function BettingAdminPage({ params }: BettingAdminPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    redirect(`/sessions/${id}`)
  }

  // Get session and buzzwords
  const { data: session } = await supabase
    .from("sessions")
    .select("*, teacher:teachers(*)")
    .eq("id", id)
    .single()

  if (!session) notFound()

  const { data: buzzwords } = await supabase
    .from("buzzwords")
    .select("*")
    .eq("teacher_id", session.teacher_id)

  // Check if room exists
  const { data: room } = await supabase
    .from("betting_rooms")
    .select("id")
    .eq("session_id", id)
    .eq("status", "open")
    .single()

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {room ? (
          <AdminBettingView roomId={room.id} user={user} sessionBuzzwords={buzzwords || []} />
        ) : (
          <div className="container mx-auto py-12 px-4">
            <CreateBettingRoom sessionId={id} />
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
