import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, email, company, position, current_intent, event_id } = body;

    if (!full_name?.trim() || !email?.trim() || !company?.trim()) {
      return NextResponse.json({ error: 'Ad, e-posta ve şirket alanları zorunludur.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Aynı etkinlikte aynı email var mı?
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .eq('event_id', event_id);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        error: 'Bu etkinliğe zaten kayıtlısınız.',
        duplicate: true,
        redirect: `/meeting/${encodeURIComponent(cleanEmail)}`,
      }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        full_name: full_name.trim(),
        email: cleanEmail,
        company: company.trim(),
        position: position?.trim() || '',
        current_intent: current_intent?.trim() || '',
        event_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ user: data, redirect: `/meeting/${encodeURIComponent(cleanEmail)}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Kayıt hatası.' }, { status: 500 });
  }
}
