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

  let user1: any = null;
  let user2: any = null;
  let matchStatus: string | null = null;
  let errorMsg: string | null = null;

  try {
    const { data: match } = await supabase
      .from('matches').select('*').eq('id', matchId).single();

    if (!match) {
      errorMsg = 'Bu QR kod geçersiz veya süresi dolmuş olabilir.';
    } else {
      matchStatus = match.status;
      const { data: u1 } = await supabase.from('users').select('*').eq('id', match.user1_id).single();
      const { data: u2 } = await supabase.from('users').select('*').eq('id', match.user2_id).single();
      user1 = u1;
      user2 = u2;
    }
  } catch (err: any) {
    errorMsg = err.message || 'Bir hata oluştu.';
  }

  // ─── ERROR ───
  if (errorMsg) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700', margin: '0 0 12px' }}>Eşleşme bulunamadı</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ─── ALREADY ACTIVE OR COMPLETED ───
  if (matchStatus === 'active' || matchStatus === 'completed') {
    const statusText = matchStatus === 'active' ? 'Eşleşme zaten başlamış!' : 'Bu eşleşme tamamlanmış.';
    const statusIcon = matchStatus === 'active' ? '✅' : '⏰';
    const statusColor = matchStatus === 'active' ? '#10b981' : '#94a3b8';

    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>{statusIcon}</div>
          <h1 style={{ color: statusColor, fontSize: '24px', fontWeight: '700', margin: '0 0 12px' }}>{statusText}</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: '0 0 24px' }}>Sayfanıza dönün:</p>
          {user1 && (
            <a href={`/meeting/${encodeURIComponent(user1.email)}`} style={linkStyle}>
              {user1.full_name}
              <span style={linkSubStyle}>{user1.company}</span>
            </a>
          )}
          {user2 && (
            <a href={`/meeting/${encodeURIComponent(user2.email)}`} style={{...linkStyle, marginTop: '10px'}}>
              {user2.full_name}
              <span style={linkSubStyle}>{user2.company}</span>
            </a>
          )}
          <p style={footerStyle}>TEKNOPARK ANKARA</p>
        </div>
      </div>
    );
  }

  // ─── PENDING: Show "Ben kimim?" ───
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🤝</div>
        <h1 style={{ color: '#06b6d4', fontSize: '22px', fontWeight: '700', margin: '0 0 8px' }}>QR Kod Okundu!</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: '0 0 28px', lineHeight: '1.5' }}>
          Sayacı başlatmak için aşağıdan kendinizi seçin:
        </p>

        {user1 && (
          <a href={`/activate/${matchId}/go?email=${encodeURIComponent(user1.email)}`} style={btnStyle}>
            <span style={{ fontSize: '18px', fontWeight: '700' }}>{user1.full_name}</span>
            <span style={{ display: 'block', color: '#06b6d4', fontSize: '13px', marginTop: '4px' }}>{user1.company}</span>
          </a>
        )}

        {user2 && (
          <a href={`/activate/${matchId}/go?email=${encodeURIComponent(user2.email)}`} style={{...btnStyle, marginTop: '12px'}}>
            <span style={{ fontSize: '18px', fontWeight: '700' }}>{user2.full_name}</span>
            <span style={{ display: 'block', color: '#06b6d4', fontSize: '13px', marginTop: '4px' }}>{user2.company}</span>
          </a>
        )}

        <p style={footerStyle}>TEKNOPARK ANKARA</p>
      </div>
    </div>
  );
}

// ─── Shared styles ───
const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '20px',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
  borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
  padding: '48px 28px', maxWidth: '400px', width: '100%', textAlign: 'center',
};

const btnStyle: React.CSSProperties = {
  display: 'block', padding: '18px 20px',
  background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))',
  border: '2px solid rgba(6,182,212,0.3)', borderRadius: '16px',
  color: '#fff', textDecoration: 'none', transition: 'all 0.2s',
};

const linkStyle: React.CSSProperties = {
  display: 'block', padding: '14px 20px',
  background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))',
  border: '1px solid rgba(6,182,212,0.3)', borderRadius: '12px',
  color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: '600',
};

const linkSubStyle: React.CSSProperties = {
  display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '2px',
};

const footerStyle: React.CSSProperties = {
  color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '28px',
};
