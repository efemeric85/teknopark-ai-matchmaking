import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, email, company, position, current_intent, event_id } = body;

    // ─── Validate ───
    if (!full_name?.trim() || !email?.trim() || !company?.trim()) {
      return NextResponse.json({ error: 'Ad, e-posta ve şirket zorunludur.' }, { status: 400 });
    }
    if (!event_id) {
      return NextResponse.json({ error: 'Etkinlik seçilmedi.' }, { status: 400 });
    }

    // ─── Check event exists and is active ───
    const { data: event } = await supabase
      .from('events').select('id, name, status').eq('id', event_id).single();

    if (!event) {
      return NextResponse.json({ error: 'Etkinlik bulunamadı.' }, { status: 404 });
    }
    if (event.status !== 'active') {
      return NextResponse.json({ error: 'Bu etkinlik şu an kayıt kabul etmiyor.' }, { status: 400 });
    }

    // ─── Check duplicate: same email + same event ───
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .eq('event_id', event_id);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Bu etkinliğe zaten kayıtlısınız. Eşleşme sayfanıza yönlendirileceksiniz.' }, { status: 409 });
    }

    // ─── Generate embedding ───
    let embedding = null;
    try {
      const text = `${full_name} - ${company} - ${position || ''} - ${current_intent || ''}`;
      const embResponse = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      embedding = embResponse.data[0].embedding;
    } catch (embErr) {
      console.error('Embedding error (non-fatal):', embErr);
    }

    // ─── Create user ───
    const userData: any = {
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      company: company.trim(),
      position: (position || '').trim(),
      current_intent: (current_intent || '').trim(),
      event_id,
    };
    if (embedding) userData.embedding = embedding;

    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, full_name: user.full_name },
      redirect: `/meeting/${encodeURIComponent(user.email)}`,
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message || 'Kayıt hatası.' }, { status: 500 });
  }
}
