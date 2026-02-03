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
  const ADMIN_EMAIL = 'bahtiyarozturk@gmail.com';
  const ADMIN_PASSWORD = 'admin123';
  const encoder = new TextEncoder();
  const data = encoder.encode(ADMIN_EMAIL + ':' + ADMIN_PASSWORD + '-teknopark-2026');
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

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function greedyMatch(
  users: UserRow[],
  pairScores: PairScore[],
  usedPairs: Set<string>
): { matches: { u1: string; u2: string; score: number }[]; unmatched: string | null } {
  const matched = new Set<string>();
  const roundMatches: { u1: string; u2: string; score: number }[] = [];

  // pairScores already sorted descending by score
  for (const pair of pairScores) {
    const key = pairKey(pair.u1, pair.u2);
    if (usedPairs.has(key)) continue;          // already met in previous round
    if (matched.has(pair.u1)) continue;         // already matched this round
    if (matched.has(pair.u2)) continue;         // already matched this round

    roundMatches.push({ u1: pair.u1, u2: pair.u2, score: pair.score });
    matched.add(pair.u1);
    matched.add(pair.u2);
  }

  // Find unmatched user (odd number)
  let unmatched: string | null = null;
  for (const u of users) {
    if (!matched.has(u.id)) {
      unmatched = u.id;
      break;
    }
  }

  return { matches: roundMatches, unmatched };
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
    if (nextRound > maxRounds) {
      return NextResponse.json({
        error: `Maksimum tur sayısına (${maxRounds}) ulaşıldı. Ayarlardan artırabilirsiniz.`,
        maxReached: true,
      }, { status: 400 });
    }

    // 7. Build used pairs set
    const usedPairs = new Set<string>();
    for (const m of allMatches) {
      usedPairs.add(pairKey(m.user1_id, m.user2_id));
    }

    // 8. Calculate all pair scores
    const pairScores = scoreAllPairs(users as UserRow[]);

    // 9. Greedy match
    const { matches: roundMatches, unmatched } = greedyMatch(
      users as UserRow[], pairScores, usedPairs
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
      maxRounds,
      matchCount: roundMatches.length,
      unmatched: unmatched ? userMap.get(unmatched)?.full_name || unmatched : null,
      message: `Tur ${nextRound}: ${roundMatches.length} eşleşme oluşturuldu (uyumluluk bazlı).`,
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
