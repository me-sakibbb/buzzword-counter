export interface User {
  id: string
  name?: string
  email?: string
  photo_url?: string
  role: "user" | "admin"
  approved: boolean
  created_at: string
}

export interface Teacher {
  id: string
  name: string
  bio?: string
  avatar_url?: string
}

export interface Buzzword {
  id: string
  teacher_id: string
  label: string
}

export interface Session {
  id: string
  teacher_id: string
  title: string
  scheduled_at?: string
  created_by?: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  updated_at: string
  teacher?: Teacher
  buzzwords?: Buzzword[]
}

export interface Submission {
  id: string
  session_id: string
  created_by: string
  counts: Record<string, number>
  timeline: Array<{ timestamp: number; buzzword: string }>
  status: "pending" | "approved" | "rejected"
  created_at: string
  approved_at?: string
  approved_by?: string
  session?: Session
}

export interface SessionAggregate {
  session_id: string
  counts_avg?: Record<string, number>
  counts_sum?: Record<string, number>
  counts_stddev?: Record<string, number>
  sample_size?: number
  time_series?: Record<string, Array<{ time: number; count: number }>>
  last_updated_at: string
}

// ---- BuzzCoins Betting Platform Types ----

export interface BettingRoom {
  id: string
  session_id: string
  created_by: string
  initial_balance: number
  status: "open" | "closed"
  live_counts: Record<string, number>
  created_at: string
  session?: Session
}

export interface BettingBalance {
  id: string
  user_id: string
  balance: number
  updated_at: string
  user?: User
}

export interface BettingRoomParticipant {
  id: string
  room_id: string
  user_id: string
  starting_balance: number
  joined_at: string
  user?: User
}

export interface BettingMarket {
  id: string
  room_id: string
  type: "total_count" | "timed_yes_no"
  buzzword_id: string
  buzzword_label: string
  time_window_minutes?: number
  time_window_start?: string
  time_window_end?: string
  baseline_count?: number
  resolved_value?: number
  status: "open" | "locked" | "resolved"
  created_at: string
  resolved_at?: string
}

export interface Bet {
  id: string
  market_id: string
  user_id: string
  prediction?: number
  side?: "yes" | "no"
  wager: number
  payout: number
  rank?: number
  created_at: string
  user?: User
  market?: BettingMarket
}
