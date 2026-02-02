'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface UserData { id: string; full_name: string; company: string; title: string; email: string; event_id: string; }
interface MatchData { id: string; status: string; started_at: string | null; round_number: number; }
interface PartnerData { id: string; full_name: string; company: string; title: string; goal?: string; }
interface EventData { id: string; name: string; duration: number; status: string; }
interface WaitingData {
  isWaiting: boolean; roundNumber: number;
  activeCount: number; pendingCount: number; totalMatches: number;
  allStarted: boolean; lastStartedAt: string | null;
}

export default function MeetingPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [waiting, setWaiting] = useState<WaitingData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 404 ? 'Kullanıcı bulunamadı.' : (data.error || 'Veri alınamadı'));
        return;
      }
      setUser(data.user); setMatch(data.match); setPartner(data.partner);
      setEvent(data.event); setWaiting(data.waiting); setError(null);
    } catch (err: any) { setError('Bağlantı hatası...'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    let startedAt: string | null = null;
    const duration = event?.duration || 360;

    if (match?.status === 'active' && match.started_at) {
      startedAt = match.started_at;
    } else if (waiting?.isWaiting && waiting.allStarted && waiting.lastStartedAt) {
      startedAt = waiting.lastStartedAt;
    }

    if (!startedAt) { setTimeLeft(null); return; }

    const sa = startedAt;
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(sa).getTime()) / 1000);
      setTimeLeft(Math.max(duration - elapsed, 0));
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [match?.id, match?.status, match?.started_at, event?.duration, waiting?.allStarted, waiting?.lastStartedAt]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const tc = (s: number) => s <= 30 ? '#ef4444' : s <= 60 ? '#f59e0b' : '#10b981';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif", background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' },
    card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', padding: '28px', maxWidth: '420px', width: '100%', textAlign: 'center' },
    label: { color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 4px' },
  };

  if (loading) return <div style={S.page}><div style={S.card}><p style={{ color: '#94a3b8' }}>⏳ Yükleniyor...</p></div></div>;

  if (error && !user) return (
    <div style={S.page}><div style={S.card}>
      <p style={{ color: '#f87171', fontSize: '16px' }}>⚠️ {error}</p>
      <a href="/" style={{ display: 'inline-block', marginTop: '16px', padding: '10px 20px', background: '#06b6d4', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Ana Sayfaya Dön</a>
    </div></div>
  );

  const header = (
    <div style={{ marginBottom: '20px' }}>
      <p style={S.label}>TEKNOPARK ANKARA</p>
      <h1 style={{ color: '#06b6d4', fontSize: '18px', fontWeight: '700', margin: '0 0 12px' }}>AI Networking</h1>
      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 14px' }}>
        <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0' }}>{user?.full_name}</p>
        <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0' }}>{user?.company} &bull; {user?.title}</p>
      </div>
    </div>
  );

  // Active + expired
  if (match?.status === 'active' && timeLeft !== null && timeLeft <= 0) return (
    <div style={S.page}><div style={S.card}>
      {header}
      <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>⏰</div>
        <h2 style={{ color: '#f87171', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Süre Doldu!</h2>
        {partner && <p style={{ color: '#e2e8f0', fontSize: '14px', margin: '0' }}>{partner.full_name} &bull; {partner.company}</p>}
      </div>
      <p style={{ color: '#64748b', fontSize: '12px', marginTop: '12px' }}>Yeni tur başladığında otomatik güncellenecek.</p>
    </div></div>
  );

  // Active + running
  if (match?.status === 'active' && partner && timeLeft !== null && timeLeft > 0) {
    const duration = event?.duration || 360;
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
          <p style={S.label}>Kalan Süre</p>
          <div style={{ fontSize: '52px', fontWeight: '800', color: tc(timeLeft), fontFamily: "'JetBrains Mono', monospace", lineHeight: '1', marginBottom: '10px' }}>{fmt(timeLeft)}</div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(timeLeft / duration) * 100}%`, height: '100%', background: tc(timeLeft), borderRadius: '3px', transition: 'width 1s linear' }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '11px', margin: '8px 0 0' }}>Tur {match.round_number}</p>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))', borderRadius: '16px', padding: '16px', border: '1px solid rgba(6,182,212,0.2)' }}>
          <p style={S.label}>Görüşme Partneriniz</p>
          <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>{partner.full_name}</h3>
          <p style={{ color: '#06b6d4', fontSize: '13px', margin: '0' }}>{partner.company} &bull; {partner.title}</p>
          {partner.goal && (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px 12px', marginTop: '10px', textAlign: 'left' }}>
              <p style={{ color: '#64748b', fontSize: '10px', margin: '0 0 2px' }}>Hedefi:</p>
              <p style={{ color: '#cbd5e1', fontSize: '12px', margin: '0', lineHeight: '1.4' }}>{partner.goal}</p>
            </div>
          )}
        </div>
      </div></div>
    );
  }

  // Pending + QR
  if (match?.status === 'pending' && partner) {
    const activateUrl = `${baseUrl}/activate/${match.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=0f172a&color=06b6d4&data=${encodeURIComponent(activateUrl)}`;
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))', borderRadius: '16px', padding: '16px', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '16px' }}>
          <p style={S.label}>Eşleştiğiniz Kişi</p>
          <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>{partner.full_name}</h3>
          <p style={{ color: '#06b6d4', fontSize: '13px', margin: '0' }}>{partner.company} &bull; {partner.title}</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 12px' }}>📱 QR Kodu Okutun</p>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', display: 'inline-block' }}>
            <img src={qrUrl} alt="QR Code" width={200} height={200} style={{ display: 'block' }} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '12px 0 0', lineHeight: '1.5' }}>
            Partnerinizle buluşun. İkinizden biri diğerinin QR kodunu okuttuğunda sayaç başlayacak.
          </p>
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
      </div></div>
    );
  }

  // Waiting
  if (waiting?.isWaiting) {
    const duration = event?.duration || 360;
    const showTimer = waiting.allStarted && timeLeft !== null;
    const timedOut = showTimer && timeLeft! <= 0;
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{
          background: timedOut ? 'rgba(239,68,68,0.1)' : showTimer ? 'rgba(6,182,212,0.1)' : 'rgba(245,158,11,0.1)',
          borderRadius: '16px', padding: '24px',
          border: `1px solid ${timedOut ? 'rgba(239,68,68,0.2)' : showTimer ? 'rgba(6,182,212,0.2)' : 'rgba(245,158,11,0.2)'}`,
        }}>
          {!waiting.allStarted && (
            <>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>⏳</div>
              <h2 style={{ color: '#fbbf24', fontSize: '18px', fontWeight: '600', margin: '0 0 8px' }}>Bekleyiniz</h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' }}>
                Bu turda beklemedekisiniz. Tüm çiftler görüşmeye başladığında sayaç burada da başlayacak.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                {waiting.pendingCount > 0 && <div style={{ textAlign: 'center' }}><p style={{ color: '#f59e0b', fontSize: '20px', fontWeight: '700', margin: '0' }}>{waiting.pendingCount}</p><p style={{ color: '#64748b', fontSize: '10px', margin: '0' }}>QR Bekliyor</p></div>}
                {waiting.activeCount > 0 && <div style={{ textAlign: 'center' }}><p style={{ color: '#06b6d4', fontSize: '20px', fontWeight: '700', margin: '0' }}>{waiting.activeCount}</p><p style={{ color: '#64748b', fontSize: '10px', margin: '0' }}>Görüşmede</p></div>}
              </div>
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 2s infinite' }} />
                <span style={{ color: '#64748b', fontSize: '11px' }}>Çiftlerin QR okuması bekleniyor...</span>
              </div>
            </>
          )}
          {showTimer && !timedOut && (
            <>
              <p style={S.label}>Bu Turun Kalan Süresi</p>
              <div style={{ fontSize: '52px', fontWeight: '800', color: tc(timeLeft!), fontFamily: "'JetBrains Mono', monospace", lineHeight: '1', marginBottom: '10px', marginTop: '8px' }}>{fmt(timeLeft!)}</div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: `${(timeLeft! / duration) * 100}%`, height: '100%', background: tc(timeLeft!), borderRadius: '3px', transition: 'width 1s linear' }} />
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0' }}>Beklemedekisiniz. Süre dolduğunda yeni tur başlayacak.</p>
            </>
          )}
          {timedOut && (
            <>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>⏰</div>
              <h2 style={{ color: '#f87171', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Tur Tamamlandı!</h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0' }}>Yeni tur başladığında otomatik güncellenecek.</p>
            </>
          )}
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {waiting.roundNumber}</p>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  // No match
  return (
    <div style={S.page}><div style={S.card}>
      {header}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
        <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: '600', margin: '0 0 8px' }}>Henüz eşleşme yok</h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>Organizatör eşleştirmeleri başlattığında burada görünecek</p>
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>Otomatik kontrol ediliyor...</span>
        </div>
      </div>
      <a href="/" style={{ display: 'inline-block', marginTop: '16px', color: '#64748b', fontSize: '13px', textDecoration: 'none' }}>&larr; Ana Sayfa</a>
    </div>
    <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
