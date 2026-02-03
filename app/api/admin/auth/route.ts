import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ═══ ADMIN BİLGİLERİ (değiştirmek istersen burayı düzenle) ═══
const ADMIN_EMAIL = 'bahtiyarozturk@gmail.com';
const ADMIN_PASSWORD = 'admin123';

async function generateToken(email: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email + ':' + password + '-teknopark-2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST: Login
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email ve şifre gerekli.' }, { status: 400 });
    }

    if (email.trim().toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Email veya şifre hatalı.' }, { status: 401 });
    }

    const token = await generateToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    return NextResponse.json({ success: true, token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Hata' }, { status: 500 });
  }
}

// GET: Validate token
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-admin-token');
    if (!token) return NextResponse.json({ valid: false }, { status: 401 });

    const expected = await generateToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (token !== expected) return NextResponse.json({ valid: false }, { status: 401 });

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
