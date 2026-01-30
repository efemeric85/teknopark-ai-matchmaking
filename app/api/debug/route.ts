import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createServerClient();
    
    // Get all matches
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*');
    
    // Get all users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .limit(10);
    
    return NextResponse.json({
      matches: matches || [],
      matchError,
      users: users || [],
      userError,
      matchCount: matches?.length || 0,
      userCount: users?.length || 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
