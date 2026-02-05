import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function GoPage({
  params,
  searchParams,
}: {
  params: { matchId: string };
  searchParams: { user?: string };
}) {
  const matchId = params.matchId;
  const userId = searchParams.user;

  const errPage = (icon: string, title: string, msg: string) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b, #0f172a)', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px 28px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>{icon}</div>
        <h1 style={{ color: '#f59e0b', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>{title}</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{msg}</p>
      </div>
    </div>
  );

  if (!userId) {
    return errPage('⚠️', 'Kullanıcı belirtilmedi', 'Lütfen QR kodu tekrar okutun.');
  }

  try {
    // 1. Match'i bul
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchErr || !match) {
      return errPage('⚠️', 'Eşleşme bulunamadı', 'Bu QR kod geçersiz veya süresi dolmuş olabilir.');
    }

    // 2. Kullanıcının bu eşleşmede olduğunu doğrula
    if (match.user1_id !== userId && match.user2_id !== userId) {
      return errPage('🚫', 'Yetkisiz', 'Bu eşleşmede yer almıyorsunuz.');
    }

    // 3. Zaten active veya completed ise direkt yönlendir
    if (match.status === 'active' || match.status === 'completed') {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userData?.email) {
        redirect(`/meeting/${encodeURIComponent(userData.email)}`);
      }
      return errPage('✅', 'Eşleşme zaten başlamış', 'Sayfa yönlendiriliyor...');
    }

    // 4. Pending ise: AKTIF YAP
    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'pending');

    if (updateErr) {
      console.error('[GO] Match update error:', updateErr);
      return errPage('❌', 'Başlatma hatası', 'Eşleşme başlatılamadı. Lütfen tekrar deneyin.');
    }

    // 5. Kullanıcının email'ini al ve meeting sayfasına yönlendir
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userData?.email) {
      redirect(`/meeting/${encodeURIComponent(userData.email)}`);
    }

    return errPage('✅', 'Eşleşme başlatıldı!', 'Sayfa yönlendiriliyor...');

  } catch (err: any) {
    // redirect() throws a special error in Next.js, let it through
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    return errPage('❌', 'Bir hata oluştu', err.message || 'Lütfen tekrar deneyin.');
  }
}
