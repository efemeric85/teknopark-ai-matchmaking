export interface User {
  id: string;
  email: string;
  full_name: string;
  company: string | null;
  position: string | null;
  current_intent: string;
  embedding?: number[];
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  theme: string | null;
  status: 'draft' | 'active' | 'completed';
  round_duration_sec: number;
  created_at: string;
}

export interface Match {
  id: string;
  event_id: string;
  user_a_id: string;
  user_b_id: string;
  round_number: number;
  table_number: number | null;
  icebreaker_question: string | null;
  handshake_a: boolean;
  handshake_b: boolean;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  started_at: string | null;
  created_at: string;
  user_a?: User;
  user_b?: User;
}

export interface EventUser {
  id: string;
  event_id: string;
  user_id: string;
  checked_in: boolean;
}
