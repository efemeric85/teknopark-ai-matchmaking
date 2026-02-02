import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ActivatePage({
  params,
}: {
  params: { matchId: string };
}) {
  const matchId = params.matchId;
  let title = '';
  let subtitle = '';
  let icon = '⚠️';
  let color = '#f59e0b';
  let user1: any = null;
  let user2: any = null;
  let activated = false;

  try {
    const { data: match } = await supabase
      .from('matches').select('*').eq('id', matchId).single();

    if (!match) {
      title = 'Eşleşme bulunamadı';
      subtitle = 'Bu QR kod geçersiz veya süresi dolmuş olabilir.';
    } else if (match.status === 'active') {
      title = 'Eşleşme zaten başlamış!';
      subtitle = 'Sayaç çoktan çalışıyor. Sayfanıza dönün.';
      icon = '✅';
      color = '#10b981';
      activated = true;

      // Fetch both users for links
      const { data: u1 } = await supabase.from('users').select('*').eq('id', match.user1_id).single();
      const { data: u2 } = await supabase.from('users').select('*').eq('id', match.user2_id).single();
      user1 = u1;
      user2 = u2;
    } else if (match.status === 'completed') {
      title = 'Bu eşleşme tamamlanmış';
      subtitle = 'Bu tur sona erdi.';
    } else {
      // PENDING → ACTIVE
      const { error } = await supabase
        .from('matches')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('status', 'pending');

      if (error) throw error;

      title = 'Eşleşme Başlatıldı!';
      subtitle = 'Sayaç başladı. Aşağıdan sayfanıza gidin.';
      icon = '🚀';
      color = '#06b6d4';
      activated = true;

      // Fetch both users for links
      const { data: u1 } = await supabase.from('users').select('*').eq('id', match.user1_id).single();
      const { data: u2 } = await supabase.from('users').select('*').eq('id', match.user2_id).single();
      user1 = u1;
      user2 = u2;
    }
  } catch (err: any) {
    title = 'Bir hata oluştu';
    subtitle = err.message || 'Lütfen tekrar deneyin.';
    icon = '❌';
    color = '#ef4444';
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '20px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
        padding: '48px 32px', maxWidth: '400px', width: '100%', textAlign: 'center' as const,
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>{icon}</div>
        <h1 style={{ color: color, fontSize: '24px', fontWeight: '700', margin: '0 0 12px' }}>{title}</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: '0 0 24px', lineHeight: '1.5' }}>{subtitle}</p>

        {/* User links to meeting pages */}
        {activated && user1 && user2 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
              Sayfanıza gidin:
            </p>
            <a
              href={`/meeting/${encodeURIComponent(user1.email)}`}
              style={{
                display: 'block', padding: '14px 20px', marginBottom: '10px',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.15))',
                border: '1px solid rgba(6,182,212,0.3)', borderRadius: '12px',
                color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: '600',
              }}
            >
              {user1.full_name}
              <span style={{ display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '2px' }}>
                {user1.company}
              </span>
            </a>
            <a
              href={`/meeting/${encodeURIComponent(user2.email)}`}
              style={{
                display: 'block', padding: '14px 20px',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.15))',
                border: '1px solid rgba(6,182,212,0.3)', borderRadius: '12px',
                color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: '600',
              }}
            >
              {user2.full_name}
              <span style={{ display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '2px' }}>
                {user2.company}
              </span>
            </a>
          </div>
        )}

        <p style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '2px' }}>TEKNOPARK ANKARA</p>
      </div>
    </div>
  );
}
