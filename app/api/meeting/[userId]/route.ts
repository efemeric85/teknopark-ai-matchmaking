import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        .select('*')
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
        .select('*')
        .eq('id', identifier)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
      }
      user = data;
    }

    // iki ayrı sorgu ile eşleşmeleri bul (.or() UUID ile sorun çıkarabiliyor)
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

    // Partner bilgilerini getir
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
