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

  const pageStyle = `
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    font-family: 'Inter', 'Segoe UI', sans-serif; padding: 20px;
  `;

  const cardBg = `
    background: rgba(255,255,255,0.05); backdrop-filter: blur(10px);
    border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);
    padding: 40px 28px; max-width: 400px; width: 100%; text-align: center;
  `;

  const linkStyle = `
    display: block; padding: 16px; margin: 8px 0; border-radius: 14px;
    background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3);
    color: #fff; text-decoration: none; font-size: 18px; font-weight: 700;
    transition: all 0.2s;
  `;

  try {
    const { data: match } = await supabase
      .from('matches').select('*').eq('id', matchId).single();

    if (!match) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b, #0f172a)', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px 28px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ color: '#f59e0b', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>Eşleşme bulunamadı</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Bu QR kod geçersiz veya süresi dolmuş olabilir.</p>
          </div>
        </div>
      );
    }

    const matchStatus = match.status;

    // Fetch both users
    const { data: user1 } = await supabase.from('users').select('*').eq('id', match.user1_id).single();
    const { data: user2 } = await supabase.from('users').select('*').eq('id', match.user2_id).single();

    // Already active or completed - show status with links
    if (matchStatus === 'active' || matchStatus === 'completed') {
      const statusText = matchStatus === 'active' ? 'Eşleşme zaten başlamış!' : 'Bu eşleşme tamamlanmış.';
      const statusIcon = matchStatus === 'active' ? '✅' : '⏰';
      const statusColor = matchStatus === 'active' ? '#10b981' : '#94a3b8';

      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b, #0f172a)', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px 28px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>{statusIcon}</div>
            <h1 style={{ color: statusColor, fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>{statusText}</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>Sayfanıza dönün:</p>
            {user1 && (
              <a href={`/meeting/${encodeURIComponent(user1.email)}`} style={{ display: 'block', padding: '16px', margin: '8px 0', borderRadius: '14px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: '#fff', textDecoration: 'none', fontSize: '18px', fontWeight: 700 }}>
                {user1.full_name}
                <span style={{ display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '2px' }}>{user1.company}</span>
              </a>
            )}
            {user2 && (
              <a href={`/meeting/${encodeURIComponent(user2.email)}`} style={{ display: 'block', padding: '16px', margin: '8px 0', borderRadius: '14px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: '#fff', textDecoration: 'none', fontSize: '18px', fontWeight: 700 }}>
                {user2.full_name}
                <span style={{ display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '2px' }}>{user2.company}</span>
              </a>
            )}
            <p style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '2px', marginTop: '20px' }}>TEKNOPARK ANKARA</p>
          </div>
        </div>
      );
    }

    // PENDING - Show "Kendinizi Seçin" with links to /activate/[matchId]/go?email=xxx
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b, #0f172a)', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px 28px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📱</div>
          <h1 style={{ color: '#06b6d4', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>QR Kod Okundu!</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>Kendinizi seçin ve sayacı başlatın:</p>

          {user1 && (
            <a href={`/activate/${matchId}/go?user=${user1.id}`} style={{ display: 'block', padding: '18px', margin: '10px 0', borderRadius: '14px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: '#fff', textDecoration: 'none', fontSize: '18px', fontWeight: 700 }}>
              🙋 {user1.full_name}
              <span style={{ display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '4px' }}>{user1.company}</span>
            </a>
          )}

          {user2 && (
            <a href={`/activate/${matchId}/go?user=${user2.id}`} style={{ display: 'block', padding: '18px', margin: '10px 0', borderRadius: '14px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: '#fff', textDecoration: 'none', fontSize: '18px', fontWeight: 700 }}>
              🙋 {user2.full_name}
              <span style={{ display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '4px' }}>{user2.company}</span>
            </a>
          )}

          <p style={{ color: '#64748b', fontSize: '11px', marginTop: '20px' }}>
            İsminize basınca sayaç her iki telefonda da başlayacak.
          </p>
          <p style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '2px', marginTop: '16px' }}>TEKNOPARK ANKARA</p>
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b, #0f172a)', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px 28px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ color: '#ef4444', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>Bir hata oluştu</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>{err.message || 'Lütfen tekrar deneyin.'}</p>
        </div>
      </div>
    );
  }
}
