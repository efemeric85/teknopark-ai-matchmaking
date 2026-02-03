# AI-Powered B2B Networking & Matchmaking App

A real-time, AI-powered networking application designed for B2B events and speed networking sessions. The system uses OpenAI embeddings and cosine similarity to intelligently match participants based on their professional profiles and networking goals.

Built for a technopark organization to facilitate meaningful connections at corporate networking events.

## Live Demo

> **Note:** The live demo requires an active Supabase database with participant data. To test locally, follow the setup instructions below.

## Features

### AI-Powered Matching
- Generates vector embeddings from participant profiles using OpenAI's `text-embedding-3-small` model (1536 dimensions)
- Calculates cosine similarity scores between all participants
- Uses TF-IDF weighting and backtracking algorithm for optimal match distribution
- Ensures each participant gets the most relevant connections

### Event Management (Admin Panel)
- Create and manage networking events with custom themes
- Configure round duration (default: 6 minutes per match)
- Set maximum number of rounds
- Start/stop matching rounds with one click
- Real-time overview of all active matches
- PDF export of all rounds with match details and scores
- Auto-handles odd number of participants (waiting queue system)

### Participant Experience
- Simple registration: name, company, position, and "What are you looking for?" prompt
- QR code-based handshake to start each meeting
- Real-time countdown timer synced with server
- AI-generated icebreaker questions tailored to each pair
- View match history and partner details

### Technical Highlights
- Real-time synchronization across all devices
- Server-side timer management (no client-side drift)
- QR race condition handling for simultaneous scans
- Auto-completion of expired matches
- Middleware-based API authentication
- Duplicate registration prevention
- Progressive Web App (PWA) support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | OpenAI API (embeddings + icebreaker generation) |
| Auth | Custom token-based admin authentication |
| Styling | Tailwind CSS |
| QR | qrcode.react + html5-qrcode |
| Deployment | Vercel |

## Project Structure

```
app/
├── page.tsx                          # Landing page + participant registration
├── admin/page.tsx                    # Admin panel (event management, rounds, PDF export)
├── meeting/[userId]/page.tsx         # Participant meeting view (QR, timer, partner info)
├── activate/[matchId]/
│   ├── page.tsx                      # QR scan activation page
│   └── go/route.ts                   # Handshake confirmation endpoint
├── api/
│   ├── auth/route.ts                 # Admin login + token generation
│   ├── users/
│   │   ├── register/route.ts         # Participant registration + embedding generation
│   │   └── login/route.ts            # Participant login
│   ├── events/
│   │   ├── route.ts                  # List/create events
│   │   └── [id]/
│   │       ├── route.ts              # Get/update/delete event
│   │       ├── activate/route.ts     # Activate event
│   │       └── rounds/route.ts       # Start new matching round
│   ├── match/route.ts                # AI matching algorithm (core logic)
│   ├── meeting/[userId]/route.ts     # Get current match + timer data
│   └── matches/
│       └── [id]/route.ts             # Individual match operations
├── middleware.ts                      # API route protection
components/ui/                         # Reusable UI components (shadcn/ui)
hooks/                                 # Custom React hooks
lib/                                   # Utility functions + Supabase client
```

## How It Works

```
1. REGISTRATION (30 sec)
   Participant fills out: name, company, position
   + answers: "What am I looking for today?"
   → OpenAI generates a 1536-dim embedding vector

2. AI MATCHING (automatic)
   Admin clicks "Start Matching"
   → System calculates cosine similarity between all participants
   → TF-IDF scoring + backtracking finds optimal pairs
   → Table assignments generated

3. MEETING (6 min per round)
   Two participants meet at assigned table
   → Scan each other's QR code to start timer
   → AI-generated icebreaker question displayed
   → Server-synced countdown (3 min each side)
   → Auto-completes when time expires

4. NEXT ROUND
   Admin starts next round
   → New matches generated (no repeat pairs)
   → Process repeats for configured number of rounds
```

## Setup & Installation

### Prerequisites
- Node.js 18+
- Supabase account (with pgvector extension enabled)
- OpenAI API key

### Environment Variables

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

### Database Setup

Enable the pgvector extension in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Required tables: `events`, `users`, `matches`, `admin_settings`. The application will reference these tables through Supabase client queries.

### Run Locally

```bash
git clone https://github.com/efemeric85/teknopark-ai-matchmaking.git
cd teknopark-ai-matchmaking
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the participant view.
Open [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

### Deploy to Vercel

1. Push to GitHub
2. Connect repo in Vercel dashboard
3. Add environment variables in Vercel > Settings > Environment Variables
4. Deploy

## Matching Algorithm

The core matching logic (`app/api/match/route.ts`) works in several stages:

1. **Embedding Generation:** Each participant's "What am I looking for?" answer is converted to a 1536-dimensional vector using OpenAI's `text-embedding-3-small`
2. **Similarity Matrix:** Cosine similarity is calculated between all participant pairs
3. **TF-IDF Scoring:** Keyword importance is weighted to prioritize specific over generic matches
4. **Optimal Pairing:** A backtracking algorithm finds the best global assignment, avoiding repeat matches from previous rounds
5. **Icebreaker Generation:** OpenAI generates a contextual conversation starter for each matched pair

## Author

**Efe Meric** | [RichMe AI](https://richmeai.com)
04.02.2026
AI Automation & Process Optimization Consultant

---

*Built as a real-world solution for a technopark organization's B2B networking events.*
