'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface UserData {
  id: string;
  full_name: string;
  company: string;
  title: string;
  email: string;
  event_id: string;
}

interface MatchData {
  id: string;
  status: string;
  started_at: string | null;
  round_number: number;
}

interface PartnerData {
  id: string;
  full_name: string;
  company: string;
  title: string;
  goal?: string;
}

interface EventData {
  id: string;
  name: string;
  duration: number;
  status: string;
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
        if (res.status === 404) {
          setError('Kullanıcı bulunamadı. Lütfen kayıt olun.');
        } else {
          setError(data.error || 'Veri alınamadı');
        }
        return;
      }

      setUser(data.user);
      setMatch(data.match);
      setPartner(data.partner);
      setEvent(data.event);
      setError(null);
    } catch (err: any) {
      setError('Bağlantı hatası. Tekrar deneniyor...');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 5 saniyede bir veri çek
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!match || match.status !== 'active' || !match.started_at || !event) {
      setTimeLeft(null);
      return;
    }

    const duration = event.duration || 360;

    const updateTimer = () => {
      const startTime = new Date(match.started_at!).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const remaining = duration - elapsedSeconds;

      if (remaining <= 0) {
        setTimeLeft(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        setTimeLeft(remaining);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [match?.id, match?.status, match?.started_at, event?.duration]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (seconds: number): string => {
    if (seconds <= 30) return '#ef4444';
    if (seconds <= 60) return '#f59e0b';
    return '#10b981';
  };

  // =================== RENDER ===================

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '32px',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center',
  };

  // LOADING
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // ERROR
  if (error && !user) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ color: '#f87171', fontSize: '16px' }}>{error}</p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: '20px',
              padding: '12px 24px',
              background: '#06b6d4',
              color: '#fff',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600',
            }}
          >
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    );
  }

  // HEADER (ortak)
  const headerSection = (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
        TEKNOPARK ANKARA
      </p>
      <h1 style={{ color: '#06b6d4', fontSize: '20px', fontWeight: '700', margin: '0 0 16px 0' }}>
        AI Networking
      </h1>
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '12px 16px',
      }}>
        <p style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0' }}>{user?.full_name}</p>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
          {user?.company} &bull; {user?.title}
        </p>
      </div>
    </div>
  );

  // SÜRE DOLDU
  if (timeLeft !== null && timeLeft <= 0 && match?.status === 'active') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {headerSection}
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏰</div>
            <h2 style={{ color: '#f87171', fontSize: '22px', fontWeight: '700', margin: '0 0 8px 0' }}>
              Süre Doldu!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 16px 0' }}>
              Görüşmeniz tamamlandı.
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              padding: '12px',
            }}>
              <p style={{ color: '#e2e8f0', fontSize: '14px', margin: '0' }}>
                {partner?.full_name}
              </p>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>
                {partner?.company} &bull; {partner?.title}
              </p>
            </div>
          </div>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '16px' }}>
            Yeni tur başladığında bu sayfa otomatik güncellenecek.
          </p>
        </div>
      </div>
    );
  }

  // AKTİF EŞLEŞME + TIMER
  if (match && match.status === 'active' && partner && timeLeft !== null && timeLeft > 0) {
    const timerColor = getTimerColor(timeLeft);
    const duration = event?.duration || 360;
    const progress = (timeLeft / duration) * 100;

    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {headerSection}

          {/* Timer */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '20px',
          }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' }}>
              Kalan Süre
            </p>
            <div style={{
              fontSize: '52px',
              fontWeight: '800',
              color: timerColor,
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              lineHeight: '1',
              marginBottom: '12px',
              transition: 'color 0.3s',
            }}>
              {formatTime(timeLeft)}
            </div>
            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: timerColor,
                borderRadius: '3px',
                transition: 'width 1s linear, background 0.3s',
              }} />
            </div>
            <p style={{ color: '#64748b', fontSize: '11px', margin: '8px 0 0 0' }}>
              Tur {match.round_number}
            </p>
          </div>

          {/* Partner Kartı */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.1))',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(6, 182, 212, 0.2)',
          }}>
            <p style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' }}>
              Görüşme Partneriniz
            </p>
            <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>
              {partner.full_name}
            </h3>
            <p style={{ color: '#06b6d4', fontSize: '14px', margin: '0 0 12px 0' }}>
              {partner.company} &bull; {partner.title}
            </p>
            {partner.goal && (
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                textAlign: 'left',
              }}>
                <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 4px 0' }}>Hedefi:</p>
                <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0', lineHeight: '1.4' }}>
                  {partner.goal}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // BEKLEYEN EŞLEŞME (pending)
  if (match && match.status === 'pending' && partner) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {headerSection}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🤝</div>
            <h2 style={{ color: '#fbbf24', fontSize: '18px', fontWeight: '700', margin: '0 0 12px 0' }}>
              Eşleşmeniz Hazır!
            </h2>
            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>
              {partner.full_name}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0' }}>
              {partner.company} &bull; {partner.title}
            </p>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px' }}>
            Organizatör turu başlattığında sayaç başlayacak.
          </p>
          <div style={{
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#06b6d4',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ color: '#64748b', fontSize: '12px' }}>Bekleniyor...</span>
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  // EŞLEŞME YOK
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {headerSection}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>
            Henüz eşleşme yok
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>
            Organizatör eşleştirmeleri başlattığında burada görünecek
          </p>
          <div style={{
            marginTop: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#06b6d4',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ color: '#64748b', fontSize: '12px' }}>Otomatik kontrol ediliyor...</span>
          </div>
        </div>
        <a href="/" style={{
          display: 'inline-block',
          marginTop: '20px',
          color: '#64748b',
          fontSize: '13px',
          textDecoration: 'none',
        }}>
          &larr; Ana Sayfa
        </a>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
