import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

const icebreakers = [
  "Yapay zeka projelerinizde hangi alanlara odaklanıyorsunuz?",
  "Şirketinizin en büyük teknoloji sorunu ne?",
  "Bugün burada en çok kimi tanımak isterdiniz?",
  "Son 6 ayda sizi en çok heyecanlandıran teknoloji ne oldu?",
  "İş ortağı ararken en çok nelere dikkat ediyorsunuz?",
  "Sektörünüzde yapay zekanın en büyük etkisi ne olacak?",
  "Bir startup kursanız hangi problemi çözerdiniz?",
  "Networking etkinliklerinden en çok ne bekliyorsunuz?",
  "Şirketinizde otomasyona en çok ihtiyaç duyan süreç hangisi?",
  "Gelecek 5 yılda sektörünüzü ne değiştirecek?",
];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    console.log('[MATCH-ROUTE] Event:', eventId);

    // ─── 1. Get event ───
    const { data: event } = await supabase
      .from('events').select('*').eq('id', eventId).single();
    if (!event) {
      return NextResponse.json({ error: 'Etkinlik bulunamadı.' }, { status: 404 });
    }

    // ─── 2. Get participants ───
    const { data: users } = await supabase
      .from('users').select('*').eq('event_id', eventId);
    if (!users || users.length < 2) {
      return NextResponse.json({ error: 'En az 2 katılımcı gerekli.' }, { status: 400 });
    }

    // ─── 3. Get existing matches to find current round ───
    const { data: existingMatches } = await supabase
      .from('matches').select('*').eq('event_id', eventId);

    const allMatches = existingMatches || [];
    const currentRound = allMatches.length > 0
      ? Math.max(...allMatches.map((m: any) => m.round_number)) + 1
      : 1;

    // ─── 4. Build already-matched pairs set ───
    const matchedPairs = new Set<string>();
    allMatches.forEach((m: any) => {
      const key1 = `${m.user1_id}-${m.user2_id}`;
      const key2 = `${m.user2_id}-${m.user1_id}`;
      matchedPairs.add(key1);
      matchedPairs.add(key2);
    });

    // ─── 5. Ensure embeddings exist ───
    for (const user of users) {
      if (!user.embedding || user.embedding.length === 0) {
        try {
          const text = `${user.full_name} - ${user.company} - ${user.position || ''} - ${user.current_intent || ''}`;
          const resp = await openai.embeddings.create({ model: 'text-embedding-ada-002', input: text });
          const emb = resp.data[0].embedding;
          await supabase.from('users').update({ embedding: emb }).eq('id', user.id);
          user.embedding = emb;
        } catch (e) {
          console.error('Embedding error for', user.email, e);
        }
      }
    }

    // ─── 6. Build similarity matrix (only unmatched pairs) ───
    const candidates: { u1: any; u2: any; score: number }[] = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const pairKey = `${users[i].id}-${users[j].id}`;
        if (matchedPairs.has(pairKey)) continue;

        let score = 0.5; // default if no embeddings
        if (users[i].embedding?.length && users[j].embedding?.length) {
          score = cosineSimilarity(users[i].embedding, users[j].embedding);
        }
        candidates.push({ u1: users[i], u2: users[j], score });
      }
    }

    // Sort by similarity (highest first)
    candidates.sort((a, b) => b.score - a.score);

    // ─── 7. Greedy matching ───
    const used = new Set<string>();
    const newMatches: any[] = [];
    let tableNum = 1;

    for (const c of candidates) {
      if (used.has(c.u1.id) || used.has(c.u2.id)) continue;
      used.add(c.u1.id);
      used.add(c.u2.id);

      newMatches.push({
        event_id: eventId,
        user1_id: c.u1.id,
        user2_id: c.u2.id,
        round_number: currentRound,
        table_number: tableNum++,
        icebreaker_question: icebreakers[Math.floor(Math.random() * icebreakers.length)],
        status: 'pending',
        started_at: null,
      });
    }

    if (newMatches.length === 0) {
      return NextResponse.json({ error: 'Eşleştirilecek yeni çift kalmadı.' }, { status: 400 });
    }

    // ─── 8. Insert matches ───
    const { error: insertError } = await supabase.from('matches').insert(newMatches);
    if (insertError) {
      console.error('[MATCH-ROUTE] Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // ─── 9. Update event status ───
    await supabase.from('events').update({ status: 'active' }).eq('id', eventId);

    const unmatchedCount = users.length - (used.size);
    console.log('[MATCH-ROUTE] Created', newMatches.length, 'matches. Round:', currentRound, 'Unmatched:', unmatchedCount);

    return NextResponse.json({
      success: true,
      round: currentRound,
      matchCount: newMatches.length,
      unmatched: unmatchedCount,
      message: `Tur ${currentRound}: ${newMatches.length} eşleşme oluşturuldu.${unmatchedCount > 0 ? ` ${unmatchedCount} kişi beklemede.` : ''}`,
    });

  } catch (error: any) {
    console.error('[MATCH-ROUTE] Error:', error);
    return NextResponse.json({ error: error.message || 'Eşleştirme hatası.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await supabase.from('matches').delete().eq('event_id', params.id);
    return NextResponse.json({ success: true, message: 'Tüm eşleşmeler sıfırlandı.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
