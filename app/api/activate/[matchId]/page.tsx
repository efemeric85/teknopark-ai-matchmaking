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

  try {
    const { data: match } = await supabase
      .from('matches').select('*').eq('id', matchId).single();

    if (!match) {
      title = 'Eşleşme bulunamadı';
      subtitle = 'Bu QR kod geçersiz veya süresi dolmuş olabilir.';
    } else if (match.status === 'active') {
      title = 'Eşleşme zaten başlamış!';
      subtitle = 'Sayaç çoktan çalışıyor. Kendi sayfanıza dönebilirsiniz.';
      icon = '✅';
      color = '#10b981';
    } else if (match.status === 'completed') {
      title = 'Bu eşleşme tamamlanmış';
      subtitle = 'Bu tur sona erdi.';
    } else {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('status', 'pending');

      if (error) throw error;

      title = 'Eşleşme Başlatıldı!';
      subtitle = 'Sayaç başladı. Bu sekmeyi kapatıp kendi sayfanıza dönebilirsiniz.';
      icon = '🚀';
      color = '#06b6d4';
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
        padding: '48px 32px', maxWidth: '400px', width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>{icon}</div>
        <h1 style={{ color: color, fontSize: '24px', fontWeight: '700', margin: '0 0 12px' }}>{title}</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: '0 0 24px', lineHeight: '1.5' }}>{subtitle}</p>
        <p style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>TEKNOPARK ANKARA</p>
      </div>
    </div>
  );
}
