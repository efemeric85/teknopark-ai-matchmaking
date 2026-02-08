import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminCreds(): Promise<{ email: string; password: string } | null> {
  const { data } = await supabase.from('admin_settings').select('*').eq('id', 1).single();
  return data ? { email: data.email, password: data.password } : null;
}

async function generateToken(email: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email + ':' + password + '-teknopark-2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST: Login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action, newEmail, newPassword } = body;

    const creds = await getAdminCreds();
    if (!creds) {
      return NextResponse.json({ error: 'Admin ayarları bulunamadı. SQL migration\'ı çalıştırın.' }, { status: 500 });
    }

    // ═══ ACTION: Change credentials ═══
    if (action === 'change_credentials') {
      const token = request.headers.get('x-admin-token');
      if (!token) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

      const expected = await generateToken(creds.email, creds.password);
      if (token !== expected) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

      if (!newEmail?.trim() && !newPassword?.trim()) {
        return NextResponse.json({ error: 'Yeni email veya şifre gerekli.' }, { status: 400 });
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (newEmail?.trim()) updates.email = newEmail.trim().toLowerCase();
      if (newPassword?.trim()) updates.password = newPassword.trim();

      const { error: updateErr } = await supabase
        .from('admin_settings')
        .update(updates)
        .eq('id', 1);

      if (updateErr) throw updateErr;

      // Generate new token with updated credentials
      const updatedEmail = updates.email || creds.email;
      const updatedPassword = updates.password || creds.password;
      const newToken = await generateToken(updatedEmail, updatedPassword);

      return NextResponse.json({
        success: true,
        message: 'Admin bilgileri güncellendi.',
        token: newToken,
      });
    }

    // ═══ ACTION: Login ═══
    if (!email || !password) {
      return NextResponse.json({ error: 'Email ve şifre gerekli.' }, { status: 400 });
    }

    if (email.trim().toLowerCase() !== creds.email || password !== creds.password) {
      return NextResponse.json({ error: 'Email veya şifre hatalı.' }, { status: 401 });
    }

    const token = await generateToken(creds.email, creds.password);
    return NextResponse.json({ success: true, token });
  } catch (e: any) {
    return NextResponse.json({ error: 'Sunucu hatasi.' || 'Hata' }, { status: 500 });
  }
}

// GET: Validate token
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-admin-token');
    if (!token) return NextResponse.json({ valid: false }, { status: 401 });

    const creds = await getAdminCreds();
    if (!creds) return NextResponse.json({ valid: false }, { status: 500 });

    const expected = await generateToken(creds.email, creds.password);
    if (token !== expected) return NextResponse.json({ valid: false }, { status: 401 });

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
