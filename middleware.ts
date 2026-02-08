import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;

  // Sadece /api/ route'larını kontrol et, sayfalara dokunma
  if (!path.startsWith('/api/')) return NextResponse.next();

  // ═══ HER ZAMAN PUBLIC (katılımcı route'ları) ═══
  if (path.startsWith('/api/users')) return NextResponse.next();
  if (path.startsWith('/api/meeting')) return NextResponse.next();
  if (path.startsWith('/api/admin/auth')) return NextResponse.next();
  if (path.startsWith('/api/matches') && !path.includes('/reset')) return NextResponse.next();

  // ═══ /api/admin/* ROUTE'LARI HER ZAMAN TOKEN GEREKTİRİR (GET dahil) ═══
  if (path.startsWith('/api/admin/')) {
    // Fall through to token check below
  }
  // ═══ Diğer GET istekleri public (anasayfa etkinlik listesi, match okuma vs.) ═══
  else if (method === 'GET' && !path.startsWith('/api/debug')) {
    return NextResponse.next();
  }

  // ═══ GERİ KALAN HER ŞEY ADMIN TOKEN GEREKTİRİR ═══
  const token = request.headers.get('x-admin-token');
  if (!token) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: creds } = await supabase
      .from('admin_settings')
      .select('email, password')
      .eq('id', 1)
      .single();

    if (!creds) {
      return NextResponse.json(
        { error: 'Admin ayarları bulunamadı.' },
        { status: 500 }
      );
    }

    // Auth route ile AYNI hash mantığı
    const encoder = new TextEncoder();
    const raw = encoder.encode(
      creds.email + ':' + creds.password + '-teknopark-2026'
    );
    const buf = await crypto.subtle.digest('SHA-256', raw);
    const expected = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (token !== expected) {
      return NextResponse.json({ error: 'Geçersiz token.' }, { status: 401 });
    }

    return NextResponse.next();
  } catch (error) {
    console.error('[MIDDLEWARE] Auth hatası:', error);
    return NextResponse.json(
      { error: 'Auth doğrulama hatası.' },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
