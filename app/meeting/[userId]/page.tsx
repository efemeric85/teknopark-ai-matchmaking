'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface UserData {
  id: string; full_name: string; company: string; title: string; email: string; event_id: string;
}
interface MatchData {
  id: string; status: string; started_at: string | null; round_number: number;
}
interface PartnerData {
  id: string; full_name: string; company: string; title: string; goal?: string;
}
interface EventData {
  id: string; name: string; duration: number; status: string;
}

export default function MeetingPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 404 ? 'Kullanıcı bulunamadı. Lütfen kayıt olun.' : (data.error || 'Veri alınamadı'));
        return;
      }
      setUser(data.user); setMatch(data.match); setPartner(data.partner); setEvent(data.event); setError(null);
    } catch (err: any) {
      setError('Bağlantı hatası. Tekrar deneniyor...');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!match || match.status !== 'active' || !match.started_at || !event) { setTimeLeft(null); return; }
    const duration = event.duration || 360;
    const updateTimer = () => {
      const startTime = new Date(match.started_at!).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = duration - elapsed;
      setTimeLeft(remaining > 0 ? remaining : 0);
      if (remaining <= 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [match?.id, match?.status, match?.started_at, event?.duration]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const getTimerColor = (s: number) => s <= 30 ? '#ef4444' : s <= 60 ? '#f59e0b' : '#10b981';

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '20px', fontFamily: "'Inter', 'Segoe UI', sans-serif",
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  };
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center',
  };

  if (loading) return (
    <div style={containerStyle}><div style={cardStyle}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
      <p style={{ color: '#94a3b8', fontSize: '16px' }}>Yükleniyor...</p>
    </div></div>
  );

  if (error && !user) return (
    <div style={containerStyle}><div style={cardStyle}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
      <p style={{ color: '#f87171', fontSize: '16px' }}>{error}</p>
      <a href="/" style={{ display: 'inline-block', marginTop: '20px', padding: '12px 24px', background: '#06b6d4', color: '#fff', borderRadius: '12px', textDecoration: 'none', fontWeight: '600' }}>Ana Sayfaya Dön</a>
    </div></div>
  );

  const header = (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>TEKNOPARK ANKARA</p>
      <h1 style={{ color: '#06b6d4', fontSize: '20px', fontWeight: '700', margin: '0 0 16px 0' }}>AI Networking</h1>
      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 16px' }}>
        <p style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0' }}>{user?.full_name}</p>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>{user?.company} &bull; {user?.title}</p>
      </div>
    </div>
  );

  // SÜRE DOLDU
  if (timeLeft !== null && timeLeft <= 0 && match?.status === 'active') return (
    <div style={containerStyle}><div style={cardStyle}>
      {header}
      <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏰</div>
        <h2 style={{ color: '#f87171', fontSize: '22px', fontWeight: '700', margin: '0 0 8px' }}>Süre Doldu!</h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 16px' }}>Görüşmeniz tamamlandı.</p>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
          <p style={{ color: '#e2e8f0', fontSize: '14px', margin: '0' }}>{partner?.full_name}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>{partner?.company} &bull; {partner?.title}</p>
        </div>
      </div>
      <p style={{ color: '#64748b', fontSize: '12px', marginTop: '16px' }}>Yeni tur başladığında otomatik güncellenecek.</p>
    </div></div>
  );

  // AKTİF EŞLEŞME + TIMER
  if (match && match.status === 'active' && partner && timeLeft !== null && timeLeft > 0) {
    const timerColor = getTimerColor(timeLeft);
    const duration = event?.duration || 360;
    return (
      <div style={containerStyle}><div style={cardStyle}>
        {header}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Kalan Süre</p>
          <div style={{ fontSize: '52px', fontWeight: '800', color: timerColor, fontFamily: "'JetBrains Mono', 'Courier New', monospace", lineHeight: '1', marginBottom: '12px' }}>
            {formatTime(timeLeft)}
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(timeLeft / duration) * 100}%`, height: '100%', background: timerColor, borderRadius: '3px', transition: 'width 1s linear' }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '11px', margin: '8px 0 0' }}>Tur {match.round_number}</p>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))', borderRadius: '16px', padding: '20px', border: '1px solid rgba(6,182,212,0.2)' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Görüşme Partneriniz</p>
          <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>{partner.full_name}</h3>
          <p style={{ color: '#06b6d4', fontSize: '14px', margin: '0 0 12px' }}>{partner.company} &bull; {partner.title}</p>
          {partner.goal && (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '10px 14px', textAlign: 'left' }}>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 4px' }}>Hedefi:</p>
              <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0', lineHeight: '1.4' }}>{partner.goal}</p>
            </div>
          )}
        </div>
      </div></div>
    );
  }

  // EŞLEŞME YOK
  return (
    <div style={containerStyle}><div style={cardStyle}>
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
      <a href="/" style={{ display: 'inline-block', marginTop: '20px', color: '#64748b', fontSize: '13px', textDecoration: 'none' }}>&larr; Ana Sayfa</a>
    </div>
    <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
