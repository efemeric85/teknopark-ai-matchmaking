import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Güvenli alanlar - embedding ve hassas veriler HARİÇ
const SAFE_USER_FIELDS = 'id, email, full_name, company, position, current_intent, event_id, checked_in, created_at';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const identifier = decodeURIComponent(params.userId || '');
    
    if (!identifier) {
      return NextResponse.json({ error: 'Kullanıcı kimliği gerekli' }, { status: 400 });
    }
    
    const isEmail = identifier.includes('@');
    
    let user;
    
    if (isEmail) {
      const { data, error } = await supabase
        .from('users')
        .select(SAFE_USER_FIELDS)  // select('*') DEĞİL
        .eq('email', identifier)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
      }
      user = data;
    } else {
      const { data, error } = await supabase
        .from('users')
        .select(SAFE_USER_FIELDS)  // select('*') DEĞİL
        .eq('id', identifier)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
      }
      user = data;
    }

    // Event doğrulaması: kullanıcının aktif bir event'i olmalı
    if (!user.event_id) {
      return NextResponse.json({
        user: { id: user.id, full_name: user.full_name, email: user.email },
        matches: [],
        message: 'Aktif etkinlik bulunamadı.'
      });
    }

    // Event'in gerçekten aktif olduğunu kontrol et
    const { data: event } = await supabase
      .from('events')
      .select('id, name, status')
      .eq('id', user.event_id)
      .single();

    if (!event || event.status === 'draft') {
      return NextResponse.json({
        user: { id: user.id, full_name: user.full_name, email: user.email },
        matches: [],
        message: 'Etkinlik henüz aktif değil.'
      });
    }

    // Eşleşmeleri bul (iki ayrı sorgu - .or() UUID ile sorun çıkarabiliyor)
    const { data: matchesAsUser1, error: err1 } = await supabase
      .from('matches')
      .select('*')
      .eq('user1_id', user.id);

    const { data: matchesAsUser2, error: err2 } = await supabase
      .from('matches')
      .select('*')
      .eq('user2_id', user.id);

    if (err1) console.error('Matches user1 error:', err1);
    if (err2) console.error('Matches user2 error:', err2);

    const allMatches = [...(matchesAsUser1 || []), ...(matchesAsUser2 || [])];

    // Duplicate kontrolü
    const uniqueMatches = allMatches.filter((match, index, self) =>
      index === self.findIndex((m) => m.id === match.id)
    );

    // Partner bilgilerini getir (sadece güvenli alanlar)
    const matchesWithPartners = await Promise.all(
      uniqueMatches.map(async (match) => {
        const partnerId = match.user1_id === user.id ? match.user2_id : match.user1_id;
        
        const { data: partner } = await supabase
          .from('users')
          .select('id, full_name, company, position, current_intent')
          .eq('id', partnerId)
          .single();

        return {
          ...match,
          partner
        };
      })
    );

    return NextResponse.json({
      user,
      matches: matchesWithPartners
    });
  } catch (error: any) {
    console.error('Error fetching meeting data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
