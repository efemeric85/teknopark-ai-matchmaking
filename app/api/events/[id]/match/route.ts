import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
async function validateAdmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('x-admin-token');
  if (!token) return false;
  // Credentials'ı DB'den oku (auth route ile aynı kaynak)
  const { data: creds } = await supabase.from('admin_settings').select('email, password').eq('id', 1).single();
  if (!creds) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(creds.email + ':' + creds.password + '-teknopark-2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  const expected = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return token === expected;
}

// ═══════════════════════════════════════════
// TURKISH NLP: Tokenizer + TF-IDF + Scoring
// ═══════════════════════════════════════════

const STOP_WORDS = new Set([
  've', 'ile', 'için', 'bir', 'bu', 'da', 'de', 'den', 'dan', 'ya', 'ki',
  'mi', 'mı', 'mu', 'mü', 'ama', 'fakat', 'hem', 'ne', 'var', 'yok',
  'olan', 'olarak', 'gibi', 'kadar', 'daha', 'çok', 'en', 'her', 'ben',
  'biz', 'siz', 'onlar', 'benim', 'bizim', 'şu', 'şey', 'diye', 'sonra',
  'önce', 'ayrıca', 'ancak', 'ise', 'veya', 'bunu', 'burada', 'bugün',
]);

function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[^a-zğüşıöç0-9]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function buildIDF(allTokenSets: string[][]): Map<string, number> {
  const n = allTokenSets.length;
  const df = new Map<string, number>();
  for (const tokens of allTokenSets) {
    const unique = new Set(tokens);
    for (const t of unique) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1);
  }
  return idf;
}

function tfidfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const vec = new Map<string, number>();
  const len = tokens.length || 1;
  for (const [term, count] of tf) {
    vec.set(term, (count / len) * (idf.get(term) || 1));
  }
  return vec;
}

function cosineSim(v1: Map<string, number>, v2: Map<string, number>): number {
  let dot = 0, n1 = 0, n2 = 0;
  for (const [t, a] of v1) {
    const b = v2.get(t) || 0;
    dot += a * b;
    n1 += a * a;
  }
  for (const [, b] of v2) n2 += b * b;
  if (n1 === 0 || n2 === 0) return 0;
  return dot / (Math.sqrt(n1) * Math.sqrt(n2));
}

// ═══════════════════════════════════════════
// COMPLEMENTARITY SCORING
// ═══════════════════════════════════════════

const CATEGORIES: Record<string, string[]> = {
  INVESTOR:   ['yatırım', 'yatırımcı', 'fon', 'sermaye', 'melek', 'fonlama', 'vc'],
  STARTUP:    ['girişim', 'startup', 'girişimci', 'kurucu', 'mvp', 'fikir'],
  TECH:       ['yazılım', 'teknoloji', 'geliştirici', 'developer', 'mühendis', 'programlama', 'kod', 'backend', 'frontend'],
  AI:         ['yapay', 'zeka', 'makine', 'öğrenme', 'otomasyon', 'chatbot', 'nlp', 'llm', 'derin'],
  BUSINESS:   ['müşteri', 'satış', 'pazarlama', 'büyüme', 'gelir', 'ihracat', 'ithalat'],
  PARTNER:    ['ortak', 'ortaklık', 'işbirliği', 'partner', 'birlikte'],
  MENTOR:     ['mentor', 'danışman', 'koç', 'rehber', 'deneyim', 'tecrübe'],
  SAAS:       ['saas', 'bulut', 'cloud', 'abonelik', 'platform'],
  ECOMMERCE:  ['ticaret', 'eticaret', 'mağaza', 'perakende', 'marketplace'],
  FINTECH:    ['fintech', 'finans', 'banka', 'ödeme', 'kripto', 'blockchain'],
  HEALTH:     ['sağlık', 'medikal', 'tıp', 'hastane', 'ilaç'],
  EDUCATION:  ['eğitim', 'öğretim', 'kurs', 'akademi', 'edtech'],
  ENERGY:     ['enerji', 'güneş', 'solar', 'rüzgar', 'yenilenebilir'],
  DEFENSE:    ['savunma', 'askeri', 'siber', 'güvenlik'],
  LOGISTICS:  ['lojistik', 'taşımacılık', 'depo', 'tedarik', 'zincir'],
};

// Complementary category pairs [catA, catB, score]
const COMP_RULES: [string, string, number][] = [
  ['INVESTOR', 'STARTUP', 0.95],
  ['INVESTOR', 'TECH', 0.80],
  ['INVESTOR', 'AI', 0.85],
  ['INVESTOR', 'SAAS', 0.80],
  ['INVESTOR', 'FINTECH', 0.80],
  ['INVESTOR', 'ECOMMERCE', 0.75],
  ['INVESTOR', 'HEALTH', 0.75],
  ['INVESTOR', 'ENERGY', 0.75],
  ['MENTOR', 'STARTUP', 0.90],
  ['MENTOR', 'TECH', 0.70],
  ['BUSINESS', 'TECH', 0.80],
  ['BUSINESS', 'AI', 0.80],
  ['BUSINESS', 'SAAS', 0.75],
  ['PARTNER', 'PARTNER', 0.60],
  ['TECH', 'AI', 0.65],
  ['TECH', 'SAAS', 0.60],
  ['STARTUP', 'BUSINESS', 0.70],
  ['STARTUP', 'MENTOR', 0.90],
];

const SEEKING = ['arıyorum', 'istiyorum', 'ihtiyacım', 'lazım', 'arıyor', 'aramak', 'bulmak', 'gerekiyor'];
const OFFERING = ['sunuyorum', 'yapıyorum', 'geliştiriyorum', 'üretiyorum', 'sağlıyorum', 'hizmet', 'veriyorum', 'sunuyor'];

function extractCategories(text: string): Set<string> {
  const lower = text.toLocaleLowerCase('tr');
  const cats = new Set<string>();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) cats.add(cat);
  }
  return cats;
}

function hasSeeking(text: string): boolean {
  const l = text.toLocaleLowerCase('tr');
  return SEEKING.some(w => l.includes(w));
}

function hasOffering(text: string): boolean {
  const l = text.toLocaleLowerCase('tr');
  return OFFERING.some(w => l.includes(w));
}

function complementarityScore(intent1: string, intent2: string): number {
  if (!intent1 || !intent2) return 0.15; // minimum for empty intents

  const cats1 = extractCategories(intent1);
  const cats2 = extractCategories(intent2);
  const seek1 = hasSeeking(intent1);
  const seek2 = hasSeeking(intent2);
  const offer1 = hasOffering(intent1);
  const offer2 = hasOffering(intent2);

  let maxScore = 0;

  for (const [catA, catB, score] of COMP_RULES) {
    if ((cats1.has(catA) && cats2.has(catB)) || (cats1.has(catB) && cats2.has(catA))) {
      let bonus = 0;
      // One seeking what the other offers = extra bonus
      if ((seek1 && offer2) || (seek2 && offer1)) bonus = 0.05;
      maxScore = Math.max(maxScore, score + bonus);
    }
  }

  // Same category overlap (could collaborate)
  for (const cat of cats1) {
    if (cats2.has(cat)) {
      maxScore = Math.max(maxScore, 0.40);
    }
  }

  return Math.max(maxScore, 0.10); // everyone has minimum networking value
}

// ═══════════════════════════════════════════
// COMBINED PAIR SCORING
// ═══════════════════════════════════════════

interface UserRow {
  id: string;
  full_name: string;
  company: string;
  position: string;
  current_intent: string;
  email: string;
}

function getUserText(u: UserRow): string {
  return [u.company || '', u.position || '', u.current_intent || ''].filter(Boolean).join(' ');
}

interface PairScore {
  u1: string;
  u2: string;
  score: number;
  domainScore: number;
  compScore: number;
}

function scoreAllPairs(users: UserRow[]): PairScore[] {
  // Build TF-IDF
  const allTokens = users.map(u => tokenize(getUserText(u)));
  const idf = buildIDF(allTokens);
  const vectors = allTokens.map(tokens => tfidfVector(tokens, idf));

  const pairs: PairScore[] = [];

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const domainScore = cosineSim(vectors[i], vectors[j]);
      const compScore = complementarityScore(
        users[i].current_intent || '',
        users[j].current_intent || ''
      );

      // Weighted: complementarity matters more than domain overlap
      const score = domainScore * 0.30 + compScore * 0.70;

      pairs.push({
        u1: users[i].id,
        u2: users[j].id,
        score,
        domainScore,
        compScore,
      });
    }
  }

  return pairs.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════
// GREEDY MAXIMUM WEIGHT MATCHING
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// SMART MATCHING: Fair waiting + optimal coverage
// ═══════════════════════════════════════════

type MatchResult = { u1: string; u2: string; score: number };

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Find a perfect matching (no repeats) using backtracking.
 * For n<=14, this is fast enough. Returns null if impossible.
 */
function findPerfectMatching(
  userIds: string[],
  pairScores: PairScore[],
  usedPairs: Set<string>,
  calls: { count: number }
): MatchResult[] | null {
  if (userIds.length === 0) return [];
  if (userIds.length === 1) return null;
  if (calls.count++ > 50000) return null; // Safety limit

  const first = userIds[0];
  const rest = userIds.slice(1);

  // Try partners sorted by score descending (best matches first)
  const partners = rest
    .filter(id => !usedPairs.has(pairKey(first, id)))
    .map(id => {
      const ps = pairScores.find(p => pairKey(p.u1, p.u2) === pairKey(first, id));
      return { id, score: ps?.score || 0.05 };
    })
    .sort((a, b) => b.score - a.score);

  for (const partner of partners) {
    const remaining = rest.filter(id => id !== partner.id);
    const sub = findPerfectMatching(remaining, pairScores, usedPairs, calls);
    if (sub !== null) {
      return [{ u1: first, u2: partner.id, score: partner.score }, ...sub];
    }
  }

  return null;
}

/**
 * Match an even number of users. Tries backtracking for perfect (no-repeat)
 * matching first, falls back to greedy if impossible or too many users.
 */
function matchEven(
  users: UserRow[],
  pairScores: PairScore[],
  usedPairs: Set<string>
): { matches: MatchResult[]; repeatCount: number } {
  const userIds = users.map(u => u.id);

  // For small groups: try backtracking for repeat-free matching
  if (users.length <= 16) {
    const calls = { count: 0 };
    const perfect = findPerfectMatching(userIds, pairScores, usedPairs, calls);
    if (perfect) return { matches: perfect, repeatCount: 0 };
  }

  // Greedy fallback
  const userIdSet = new Set(userIds);
  const matched = new Set<string>();
  const matches: MatchResult[] = [];

  // Pass 1: unused pairs by score
  for (const pair of pairScores) {
    if (!userIdSet.has(pair.u1) || !userIdSet.has(pair.u2)) continue;
    if (usedPairs.has(pairKey(pair.u1, pair.u2))) continue;
    if (matched.has(pair.u1) || matched.has(pair.u2)) continue;
    matches.push({ u1: pair.u1, u2: pair.u2, score: pair.score });
    matched.add(pair.u1);
    matched.add(pair.u2);
  }

  // Pass 2: force-pair remaining
  const remaining = users.filter(u => !matched.has(u.id));
  for (let i = 0; i + 1 < remaining.length; i += 2) {
    const key = pairKey(remaining[i].id, remaining[i + 1].id);
    const ps = pairScores.find(p => pairKey(p.u1, p.u2) === key);
    matches.push({ u1: remaining[i].id, u2: remaining[i + 1].id, score: ps?.score || 0.05 });
    matched.add(remaining[i].id);
    matched.add(remaining[i + 1].id);
  }

  const repeatCount = matches.filter(m => usedPairs.has(pairKey(m.u1, m.u2))).length;
  return { matches, repeatCount };
}

/**
 * Main matching function.
 * For odd n: strategically chooses who waits (fair distribution, no consecutive waits,
 * minimize repeats). For even n: direct matching.
 */
function smartMatch(
  users: UserRow[],
  pairScores: PairScore[],
  usedPairs: Set<string>,
  prevUnmatchedId: string | null,
  waitCounts: Map<string, number>
): { matches: MatchResult[]; unmatched: string | null } {
  const n = users.length;
  if (n < 2) return { matches: [], unmatched: n === 1 ? users[0].id : null };

  // Even number: match everyone
  if (n % 2 === 0) {
    const result = matchEven(users, pairScores, usedPairs);
    return { matches: result.matches, unmatched: null };
  }

  // Odd number: choose who waits, then match remaining (even count)

  // Build waiter candidates: exclude prevUnmatched (they MUST play this round)
  // Sort by fewest waits first (fairness)
  const candidates = users
    .filter(u => u.id !== prevUnmatchedId)
    .map(u => ({ id: u.id, waits: waitCounts.get(u.id) || 0 }))
    .sort((a, b) => a.waits - b.waits);

  let bestResult: { matches: MatchResult[]; unmatched: string; repeatCount: number } | null = null;

  for (const cand of candidates) {
    const remaining = users.filter(u => u.id !== cand.id);
    const result = matchEven(remaining, pairScores, usedPairs);

    if (result.repeatCount === 0) {
      // Perfect: no repeats with this waiter choice
      return { matches: result.matches, unmatched: cand.id };
    }

    // Track best (fewest repeats, then fewest waits)
    if (!bestResult || result.repeatCount < bestResult.repeatCount ||
        (result.repeatCount === bestResult.repeatCount && cand.waits < (waitCounts.get(bestResult.unmatched) || 0))) {
      bestResult = { matches: result.matches, unmatched: cand.id, repeatCount: result.repeatCount };
    }
  }

  return { matches: bestResult!.matches, unmatched: bestResult!.unmatched };
}

// ═══════════════════════════════════════════
// POST: Create next round matches
// ═══════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await validateAdmin(request))) {
      return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const eventId = params.id;

    // 1. Get event
    const { data: event, error: eventErr } = await supabase
      .from('events').select('*').eq('id', eventId).single();
    if (eventErr || !event) {
      return NextResponse.json({ error: 'Etkinlik bulunamadı.' }, { status: 404 });
    }

    const maxRounds = event.max_rounds || 5;
    const duration = event.round_duration_sec || event.duration || 360;

    // 2. Get participants
    const { data: users, error: usersErr } = await supabase
      .from('users').select('*').eq('event_id', eventId);
    if (usersErr || !users || users.length < 2) {
      return NextResponse.json({ error: 'En az 2 katılımcı gerekli.' }, { status: 400 });
    }

    // Max rounds cannot exceed n-1 (each person meets everyone)
    const maxPossibleRounds = users.length < 2 ? 0 : (users.length % 2 === 0 ? users.length - 1 : users.length);
    const effectiveMaxRounds = Math.min(maxRounds, maxPossibleRounds);

    // 3. Get existing matches
    const { data: existingMatches } = await supabase
      .from('matches').select('*').eq('event_id', eventId).order('round_number', { ascending: true });

    const allMatches = existingMatches || [];

    // 4. Auto-complete expired active matches
    const now = Date.now();
    const expired = allMatches.filter(m =>
      m.status === 'active' && m.started_at &&
      (now - new Date(m.started_at).getTime()) / 1000 >= duration
    );
    if (expired.length > 0) {
      await supabase.from('matches')
        .update({ status: 'completed' })
        .in('id', expired.map(m => m.id));
      // Update local copy
      for (const m of allMatches) {
        if (expired.find(e => e.id === m.id)) m.status = 'completed';
      }
    }

    // 5. Check if current round still has pending/active matches
    const currentMaxRound = allMatches.length > 0
      ? Math.max(...allMatches.map(m => m.round_number))
      : 0;

    if (currentMaxRound > 0) {
      const currentRoundMatches = allMatches.filter(m => m.round_number === currentMaxRound);
      const stillRunning = currentRoundMatches.filter(m => m.status === 'pending' || m.status === 'active');
      if (stillRunning.length > 0) {
        return NextResponse.json({
          error: `Tur ${currentMaxRound} hala devam ediyor. ${stillRunning.length} eşleşme tamamlanmadı.`,
          runningCount: stillRunning.length,
        }, { status: 400 });
      }
    }

    // 6. Check max rounds
    const nextRound = currentMaxRound + 1;
    if (nextRound > effectiveMaxRounds) {
      return NextResponse.json({
        error: `Maksimum tur sayısına ulaşıldı. ${users.length} katılımcı ile en fazla ${maxPossibleRounds} tur yapılabilir.`,
        maxReached: true,
        maxPossibleRounds,
      }, { status: 400 });
    }

    // 7. Build used pairs set
    const usedPairs = new Set<string>();
    for (const m of allMatches) {
      usedPairs.add(pairKey(m.user1_id, m.user2_id));
    }

    // 8. Calculate all pair scores
    const pairScores = scoreAllPairs(users as UserRow[]);

    // 8.5. Compute wait history for fair distribution
    let prevUnmatchedId: string | null = null;
    const waitCounts = new Map<string, number>();
    const userIdSet = new Set(users.map(u => u.id));

    if (users.length % 2 === 1 && currentMaxRound > 0) {
      // Count how many times each user has waited across all rounds
      for (let r = 1; r <= currentMaxRound; r++) {
        const roundMs = allMatches.filter(m => m.round_number === r);
        const matchedInRound = new Set<string>();
        for (const m of roundMs) {
          matchedInRound.add(m.user1_id);
          matchedInRound.add(m.user2_id);
        }
        for (const uid of userIdSet) {
          if (!matchedInRound.has(uid)) {
            waitCounts.set(uid, (waitCounts.get(uid) || 0) + 1);
          }
        }
      }

      // Find who waited last round (they must NOT wait again)
      const prevRoundMatches = allMatches.filter(m => m.round_number === currentMaxRound);
      const prevMatchedIds = new Set<string>();
      for (const m of prevRoundMatches) {
        prevMatchedIds.add(m.user1_id);
        prevMatchedIds.add(m.user2_id);
      }
      for (const uid of userIdSet) {
        if (!prevMatchedIds.has(uid)) {
          prevUnmatchedId = uid;
          break;
        }
      }
    }

    // 9. Smart match (fair waiting + backtracking for optimal coverage)
    const { matches: roundMatches, unmatched } = smartMatch(
      users as UserRow[], pairScores, usedPairs, prevUnmatchedId, waitCounts
    );

    if (roundMatches.length === 0) {
      return NextResponse.json({
        error: 'Eşleştirilecek yeni çift kalmadı. Tüm olası kombinasyonlar tükendi.',
        noMorePairs: true,
      }, { status: 400 });
    }

    // 10. Insert matches
    const matchRows = roundMatches.map((m, idx) => ({
      event_id: eventId,
      user1_id: m.u1,
      user2_id: m.u2,
      round_number: nextRound,
      table_number: idx + 1,
      compatibility_score: Math.round(m.score * 100) / 100,
      status: 'pending',
      started_at: null,
      icebreaker_question: '',
    }));

    const { error: insertErr } = await supabase.from('matches').insert(matchRows);
    if (insertErr) throw insertErr;

    // 11. Build response with details
    const userMap = new Map(users.map(u => [u.id, u]));
    const details = roundMatches.map(m => ({
      user1: userMap.get(m.u1)?.full_name || '?',
      user2: userMap.get(m.u2)?.full_name || '?',
      score: Math.round(m.score * 100),
    }));

    return NextResponse.json({
      success: true,
      round: nextRound,
      maxRounds: effectiveMaxRounds,
      maxPossibleRounds,
      matchCount: roundMatches.length,
      unmatched: unmatched ? userMap.get(unmatched)?.full_name || unmatched : null,
      unmatchedId: unmatched || null,
      message: `Tur ${nextRound}: ${roundMatches.length} eşleşme oluşturuldu.${unmatched ? ' 1 kişi beklemede.' : ''}`,
      details,
    });
  } catch (error: any) {
    console.error('[MATCH-V9] Error:', error);
    return NextResponse.json({ error: error.message || 'Eşleştirme hatası.' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════
// DELETE: Reset all matches
// ═══════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await validateAdmin(request))) {
      return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const eventId = params.id;

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('event_id', eventId);

    if (error) throw error;

    // DO NOT touch event status
    return NextResponse.json({ success: true, message: 'Tüm eşleşmeler sıfırlandı.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
