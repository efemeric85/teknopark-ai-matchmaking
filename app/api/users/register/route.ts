import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, full_name, company, position, current_intent, event_id } = body;

    if (!email || !full_name || !current_intent) {
      return NextResponse.json(
        { error: 'Email, isim ve hedef alanları zorunludur' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    let user;

    if (existingUser) {
      // Update existing user
      const embedding = await generateEmbedding(
        `${full_name} - ${company || ''} - ${position || ''} - ${current_intent}`
      );

      const { data, error } = await supabase
        .from('users')
        .update({
          full_name,
          company,
          position,
          current_intent,
          embedding: JSON.stringify(embedding)
        })
        .eq('email', email)
        .select()
        .single();

      if (error) throw error;
      user = data;
    } else {
      // Create new user with embedding
      const embedding = await generateEmbedding(
        `${full_name} - ${company || ''} - ${position || ''} - ${current_intent}`
      );

      const userId = uuidv4();
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          full_name,
          company,
          position,
          current_intent,
          embedding: JSON.stringify(embedding)
        })
        .select()
        .single();

      if (error) throw error;
      user = data;
    }

    // If event_id provided, add user to event
    if (event_id && user) {
      const { error: eventUserError } = await supabase
        .from('event_users')
        .upsert({
          id: uuidv4(),
          event_id,
          user_id: user.id,
          checked_in: true
        }, { onConflict: 'event_id,user_id' });

      if (eventUserError) console.error('Event user error:', eventUserError);
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Kayıt sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
