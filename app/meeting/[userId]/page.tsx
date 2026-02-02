'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

type PageState = 'loading' | 'no-match' | 'matched' | 'active' | 'completed';

export default function MeetingPage() {
  const params = useParams();
  const userId = decodeURIComponent(params.userId as string);

  const [user, setUser] = useState<any>(null);
  const [eventInfo, setEventInfo] = useState<any>(null);
  const [currentMatch, setCurrentMatch] = useState<any>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [timeLeft, setTimeLeft] = useState(0);
  const [starting, setStarting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQR, setShowQR] = useState(true);

  const timerRef = useRef<any>(null);
  const pollRef = useRef<any>(null);
  const prevMatchIdRef = useRef<string | null>(null);
  const hasPlayedSound = useRef(false);

  // Veri çek
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();

      if (!data.user) return;
      setUser(data.user);
      if (data.event) setEventInfo(data.event);
      setCurrentRound(data.currentRound || 0);

      const match = data.currentMatch;

      if (!match) {
        setPageState('no-match');
        setCurrentMatch(null);
        return;
      }

      // Yeni tur algıla
      if (match.id !== prevMatchIdRef.current) {
        prevMatchIdRef.current = match.id;
        setShowQR(true);
        hasPlayedSound.current = false;
      }

      setCurrentMatch(match);

      if (match.status === 'completed') {
        setPageState('completed');
      } else if (match.status === 'active' && match.started_at) {
        setPageState('active');
      } else {
        setPageState('matched');
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [userId]);

  // 5 saniyede bir polling
  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchData]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (pageState !== 'active' || !currentMatch?.started_at || !eventInfo) return;

    const duration = (eventInfo.round_duration_sec || 360) * 1000;
    const endTime = new Date(currentMatch.started_at).getTime() + duration;

    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setPageState('completed');
        fetch(`/api/matches/${currentMatch.id}/complete`, { method: 'POST' }).catch(() => {});
        clearInterval(timerRef.current);
        // Bip sesi
        if (!hasPlayedSound.current) {
          hasPlayedSound.current = true;
          playEndSound();
        }
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [pageState, currentMatch?.started_at, currentMatch?.id, eventInfo]);

  // QR oluştur
  useEffect(() => {
    if (!currentMatch || typeof window === 'undefined') return;
    const url = `${window.location.origin}/start/${currentMatch.id}`;
    generateQR(url).then(setQrDataUrl);
  }, [currentMatch?.id]);

  const handleStart = async () => {
    if (!currentMatch || starting) return;
    setStarting(true);
    try {
      await fetch(`/api/matches/${currentMatch.id}/start`, { method: 'POST' });
      await fetchData();
    } finally {
      setStarting(false);
    }
  };

  // Helpers
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const totalDuration = eventInfo ? eventInfo.round_duration_sec * 1000 : 360000;
  const progress = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;
  const timerColor = timeLeft < 30000 ? '#ef4444' : timeLeft < 120000 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      color: 'white',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px 16px'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px', width: '100%', maxWidth: '440px' }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
          Teknopark Ankara
        </div>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#22d3ee' }}>
          AI Networking
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '12px 20px',
          marginBottom: '20px',
          width: '100%',
          maxWidth: '440px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>{user.full_name}</div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>{user.company} &bull; {user.position}</div>
        </div>
      )}

      {/* Round Indicator */}
      {currentRound > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '20px', color: '#94a3b8', fontSize: '13px'
        }}>
          <div style={{ width: '40px', height: '1px', background: '#334155' }} />
          <span>Tur {currentRound}</span>
          <div style={{ width: '40px', height: '1px', background: '#334155' }} />
        </div>
      )}

      {/* CONTENT AREA */}
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* LOADING */}
        {pageState === 'loading' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <div style={{ color: '#94a3b8' }}>Yükleniyor...</div>
          </div>
        )}

        {/* NO MATCH */}
        {pageState === 'no-match' && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '16px',
            border: '1px dashed #334155'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Henüz eşleşme yok</div>
            <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
              Organizatör eşleştirmeleri başlattığında<br />burada görünecek
            </div>
            <div style={{ marginTop: '20px' }}>
              <div className="pulse-dot" style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#22d3ee', margin: '0 auto',
                animation: 'pulse 2s ease-in-out infinite'
              }} />
            </div>
          </div>
        )}

        {/* MATCHED - Bekliyor */}
        {pageState === 'matched' && currentMatch?.partner && (
          <>
            {/* Partner Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.1), rgba(59,130,246,0.1))',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid rgba(34,211,238,0.2)'
            }}>
              <div style={{ fontSize: '12px', color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                Eşleşmeniz
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
                {currentMatch.partner.full_name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: '#cbd5e1' }}>
                <div>🏢 {currentMatch.partner.company}</div>
                <div>💼 {currentMatch.partner.position}</div>
              </div>
              {currentMatch.partner.current_intent && (
                <div style={{
                  marginTop: '12px', padding: '10px 14px',
                  background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
                  fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', lineHeight: '1.5'
                }}>
                  &ldquo;{currentMatch.partner.current_intent}&rdquo;
                </div>
              )}
            </div>

            {/* QR Code */}
            {showQR && qrDataUrl && (
              <div style={{
                background: 'white', borderRadius: '16px',
                padding: '20px', marginBottom: '20px', textAlign: 'center'
              }}>
                <img src={qrDataUrl} alt="QR" style={{ width: '220px', height: '220px', margin: '0 auto' }} />
                <div style={{ color: '#475569', fontSize: '13px', marginTop: '8px' }}>
                  Partneriniz bu QR'ı okutarak görüşmeyi başlatabilir
                </div>
              </div>
            )}

            {/* Başlat Butonu */}
            <button
              onClick={handleStart}
              disabled={starting}
              style={{
                width: '100%', padding: '18px',
                background: starting ? '#475569' : 'linear-gradient(135deg, #22d3ee, #3b82f6)',
                border: 'none', borderRadius: '14px',
                color: 'white', fontSize: '18px', fontWeight: '700',
                cursor: starting ? 'not-allowed' : 'pointer',
                transition: 'transform 0.1s',
                boxShadow: '0 4px 20px rgba(34,211,238,0.3)'
              }}
            >
              {starting ? '⏳ Başlatılıyor...' : '🚀 GÖRÜŞMEYI BAŞLAT'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
              veya partnerinizin QR kodunu okutun
            </div>
          </>
        )}

        {/* ACTIVE - Timer */}
        {pageState === 'active' && currentMatch && (
          <>
            {/* Timer Display */}
            <div style={{
              textAlign: 'center', padding: '30px 20px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '20px',
              marginBottom: '20px',
              border: `2px solid ${timerColor}40`
            }}>
              <div style={{
                fontSize: '72px',
                fontWeight: '800',
                fontFamily: "'Courier New', monospace",
                color: timerColor,
                textShadow: `0 0 30px ${timerColor}40`,
                lineHeight: '1',
                marginBottom: '16px',
                animation: timeLeft < 30000 ? 'pulse 1s ease-in-out infinite' : 'none'
              }}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>

              {/* Progress Bar */}
              <div style={{
                width: '100%', height: '6px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '3px', overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progress}%`, height: '100%',
                  background: timerColor,
                  borderRadius: '3px',
                  transition: 'width 1s linear'
                }} />
              </div>
            </div>

            {/* Partner Info (compact) */}
            {currentMatch.partner && (
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                  {currentMatch.partner.full_name}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {currentMatch.partner.company} &bull; {currentMatch.partner.position}
                </div>
              </div>
            )}
          </>
        )}

        {/* COMPLETED */}
        {pageState === 'completed' && (
          <div style={{
            textAlign: 'center', padding: '50px 20px',
            background: 'rgba(34,197,94,0.05)',
            borderRadius: '16px',
            border: '1px solid rgba(34,197,94,0.2)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', color: '#22c55e' }}>
              Görüşmeniz bitmiştir
            </div>
            <div style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
              Lütfen diğer katılımcılarla<br />eşleşmek için bekleyiniz
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', animation: 'bounce 1.4s ease-in-out infinite' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', animation: 'bounce 1.4s ease-in-out 0.2s infinite' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', animation: 'bounce 1.4s ease-in-out 0.4s infinite' }} />
            </div>
          </div>
        )}
      </div>

      {/* Geri Butonu */}
      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{
          color: '#64748b', fontSize: '13px', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          ← Ana Sayfa
        </a>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// QR Code üreteci (qrcode paketi ile)
async function generateQR(text: string): Promise<string> {
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(text, {
      width: 250,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch {
    // qrcode paketi yoksa external API kullan
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
  }
}

// Bip sesi
function playEndSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    };
    playBeep(880, 0);
    playBeep(880, 0.3);
    playBeep(1320, 0.6);
  } catch {}
}
