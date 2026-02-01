import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Registration request body:', body);

    // Validate required fields
    if (!body.email || !body.full_name || !body.current_intent) {
      return NextResponse.json({ 
        error: 'Email, ad soyad ve amaç zorunludur.' 
      }, { status: 400 });
    }

    if (!body.event_id) {
      return NextResponse.json({ 
        error: 'Etkinlik seçilmedi.' 
      }, { status: 400 });
    }

    // Check if user already registered for this event
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', body.email)
      .eq('event_id', body.event_id)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        success: true,
        user: existingUser,
        message: 'Bu etkinliğe zaten kayıtlısınız.'
      });
    }

    // Create user
    const userData = {
      email: body.email,
      full_name: body.full_name,
      company: body.company || null,
      position: body.position || null,
      current_intent: body.current_intent,
      event_id: body.event_id,
      checked_in: true
    };

    console.log('Creating user with data:', userData);

    const { data: user, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Created user:', user);

    return NextResponse.json({ 
      success: true, 
      user 
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    return NextResponse.json({ 
      error: error.message || 'Kayıt sırasında hata oluştu.' 
    }, { status: 500 });
  }
}
