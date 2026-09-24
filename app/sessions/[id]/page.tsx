import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Calendar, Play, BarChart3, Users, Clock } from "lucide-react"
import { useLoader } from "@/app/context/LoaderContext"

interface SessionPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getCurrentUser()

  // Get session details with teacher and buzzwords
  const { data: session } = await supabase
    .from("sessions")
    .select(`
      *,
      teacher:teachers(*)
    `)
    .eq("id", id)
    .single()

  if (!session) {
    notFound()
  }

  const { data: buzzwords } = await supabase
    .from("buzzwords")
    .select("*")
    .eq("teacher_id", session.teacher_id)   // or some other linking column

  session.buzzwords = buzzwords;  // attach buzzwords to session object


  // Get session aggregates if available
  const { data: aggregates } = await supabase.from("session_aggregates").select("*").eq("session_id", id).single()

  // Get approved submissions count
  const { count: submissionCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("session_id", id)
    .eq("status", "approved")

  const canTrack = user && (user.approved || user.role === "admin")
  const isApproved = session.status === "approved"

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Session Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={session.teacher?.avatar_url || ""} alt={session.teacher?.name || ""} />
              <AvatarFallback className="text-2xl">
                {session.teacher?.name?.charAt(0).toUpperCase() || "T"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant={isApproved ? "default" : "secondary"}>{session.status}</Badge>
                  <p className="text-sm text-muted-foreground">by {session.teacher?.name}</p>
                </div>
                <CardTitle className="text-3xl text-balance">{session.title}</CardTitle>
                <CardDescription className="text-lg mt-2">
                  {session.teacher?.bio || "Educational session"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {session.scheduled_at
                    ? new Date(session.scheduled_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    : "Date TBD"}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {submissionCount || 0} submissions
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Created {new Date(session.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {isApproved && canTrack ? (
          <Button size="lg" asChild>
            <Link href={`/sessions/${session.id}/live`}>
              <Play className="h-5 w-5 mr-2" />
              Start Live Tracking
            </Link>
          </Button>
        ) : isApproved ? (
          <div className="text-center space-y-2">
            <Button size="lg" disabled>
              <Play className="h-5 w-5 mr-2" />
              Start Live Tracking
            </Button>
            <p className="text-sm text-muted-foreground">{user ? "Account approval required" : "Sign in required"}</p>
          </div>
        ) : null}
        
        {aggregates && (
          <Button size="lg" variant="outline" asChild>
            <Link href={`/sessions/${session.id}/analytics`} prefetch={true}>
              <BarChart3 className="h-5 w-5 mr-2" />
              View Analytics
            </Link>
          </Button>
        )}

        {user && user.role === "admin" && (
            <Button size="lg" variant="secondary" className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-700 dark:text-yellow-500" asChild>
              <Link href={`/sessions/${session.id}/betting/admin`} prefetch={false}>
                <Coins className="h-5 w-5 mr-2" />
                Admin Betting Panel
              </Link>
            </Button>
        )}

        {user && user.role !== "admin" && (
            <Button size="lg" variant="secondary" className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-700 dark:text-yellow-500" asChild>
              <Link href={`/sessions/${session.id}/betting`} prefetch={false}>
                <Coins className="h-5 w-5 mr-2" />
                Betting Room
              </Link>
            </Button>
        )}
      </div>

      {/* Buzzwords Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Buzzwords to Track</CardTitle>
          <CardDescription>These are the key terms and phrases that will be tracked during the session</CardDescription>
        </CardHeader>
        <CardContent>
          {session.buzzwords && session.buzzwords.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {session.buzzwords.map((buzzword: any, index: number) => (
                <div
                  key={buzzword.id}
                  className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm text-muted-foreground mb-1">Key {index + 1}</div>
                  <div className="font-medium text-balance">{buzzword.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No buzzwords defined for this session.</p>
          )}
        </CardContent>
      </Card>

      {/* Session Stats */}
      {aggregates && (
        <Card>
          <CardHeader>
            <CardTitle>Session Statistics</CardTitle>
            <CardDescription>Aggregated data from approved submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{aggregates.sample_size || 0}</div>
                <div className="text-sm text-muted-foreground">Total Submissions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {aggregates.counts_sum
                    ? Object.values(aggregates.counts_sum).reduce((a: number, b: any) => a + (b || 0), 0)
                    : 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Buzzwords</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {aggregates.last_updated_at ? new Date(aggregates.last_updated_at).toLocaleDateString() : "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">Last Updated</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {isApproved && canTrack && (
        <Card>
          <CardHeader>
            <CardTitle>How to Track Buzzwords</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">During the Session</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Click buzzword buttons when you hear them</li>
                  <li>• Use keyboard shortcuts (1-9) for quick access</li>
                  <li>• Track counts in real-time during the presentation</li>
                  <li>• Submit your data when the session ends</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">After Submission</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Your submission will be pending admin approval</li>
                  <li>• Approved data contributes to session analytics</li>
                  <li>• View your submission history in your profile</li>
                  <li>• Check back for aggregated results</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
