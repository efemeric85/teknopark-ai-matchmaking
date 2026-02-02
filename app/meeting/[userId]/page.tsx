'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

// ─── Types ───
interface MeetingData {
  v: string;
  user: { id: string; full_name: string; company: string; email: string } | null;
  match: { id: string; status: string; started_at: string | null; round_number: number } | null;
  partner: { id: string; full_name: string; company: string; title?: string; goal?: string } | null;
  event: { id: string; name: string; duration: number; status: string } | null;
  waiting: { isWaiting: boolean; roundNumber: number; activeCount: number; pendingCount: number; totalMatches: number; allStarted: boolean; lastStartedAt: string | null } | null;
  error?: string;
}

// ─── Styles ───
const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '20px' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '32px 24px', maxWidth: '420px', width: '100%', textAlign: 'center' as const } as React.CSSProperties,
  label: { color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 4px' } as React.CSSProperties,
  eventName: { color: '#06b6d4', fontSize: '16px', fontWeight: '600', margin: '0 0 24px' } as React.CSSProperties,
  userName: { color: '#fff', fontSize: '14px', fontWeight: '500', margin: '0 0 4px' } as React.CSSProperties,
  userCompany: { color: '#06b6d4', fontSize: '12px', margin: '0' } as React.CSSProperties,
};

export default function MeetingPage() {
  const params = useParams();
  const userId = decodeURIComponent(params.userId as string);

  const [data, setData] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch meeting data ───
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(userId)}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      console.log('[MEETING-PAGE] API Response:', json.v, json.match?.status, json.match?.started_at);
      setData(json);
      setError(null);
    } catch (err: any) {
      console.error('[MEETING-PAGE] Fetch error:', err);
      setError('Bağlantı hatası. Sayfa otomatik yenilenecek...');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ─── Polling: 3 saniyede bir API'yi kontrol et ───
  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchData]);

  // ─── Tick: Sayaç için saniyede bir güncelle ───
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // ─── Helper: Kalan süreyi hesapla ───
  const getRemaining = (startedAt: string, duration: number): number => {
    const elapsed = (now - new Date(startedAt).getTime()) / 1000;
    return Math.max(0, duration - elapsed);
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Header component ───
  const header = data?.event ? (
    <div style={{ marginBottom: '24px' }}>
      <p style={S.label}>TEKNOPARK ANKARA</p>
      <p style={S.eventName}>{data.event.name}</p>
      {data.user && (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '8px' }}>
          <p style={S.userName}>{data.user.full_name}</p>
          <p style={S.userCompany}>{data.user.company}</p>
        </div>
      )}
    </div>
  ) : null;

  // ─── LOADING ───
  if (loading) {
    return (
      <div style={S.page}><div style={S.card}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Yükleniyor...</p>
      </div></div>
    );
  }

  // ─── ERROR ───
  if (error || data?.error) {
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
        <p style={{ color: '#f59e0b', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>Hata</p>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{error || data?.error}</p>
      </div></div>
    );
  }

  if (!data) return null;

  const { match, partner, event, waiting } = data;
  const duration = event?.duration || 180;

  // ═══════════════════════════════════════════
  // STATE 1: PENDING - QR Kod Göster
  // ═══════════════════════════════════════════
  if (match?.status === 'pending' && partner) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const activateUrl = `${baseUrl}/activate/${match.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=0f172a&color=06b6d4&data=${encodeURIComponent(activateUrl)}`;

    return (
      <div style={S.page}><div style={S.card}>
        {header}
        {/* Partner Bilgisi */}
        <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))', borderRadius: '16px', padding: '16px', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '16px' }}>
          <p style={S.label}>Eşleştiğiniz Kişi</p>
          <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>{partner.full_name}</h3>
          <p style={{ color: '#06b6d4', fontSize: '13px', margin: '0' }}>{partner.company}{partner.title ? ` \u2022 ${partner.title}` : ''}</p>
        </div>
        {/* QR Code */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 12px' }}>📱 QR Kodu Okutun</p>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', display: 'inline-block' }}>
            <img src={qrUrl} alt="QR Code" width={200} height={200} style={{ display: 'block' }} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '12px 0 0', lineHeight: '1.5' }}>
            Partnerinizle buluşun. İkinizden biri diğerinin telefonundaki QR kodu okuttuğunda sayaç başlayacak.
          </p>
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
      </div></div>
    );
  }

  // ═══════════════════════════════════════════
  // STATE 2: ACTIVE - Sayaç Çalışıyor veya Süre Dolmuş
  // ═══════════════════════════════════════════
  if (match?.status === 'active' && match.started_at && partner) {
    const remaining = getRemaining(match.started_at, duration);

    // 2a: Süre devam ediyor
    if (remaining > 0) {
      const progress = remaining / duration;
      const progressColor = remaining > duration * 0.25 ? '#10b981' : remaining > duration * 0.1 ? '#f59e0b' : '#ef4444';

      return (
        <div style={S.page}><div style={S.card}>
          {header}
          {/* Partner */}
          <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))', borderRadius: '16px', padding: '16px', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '20px' }}>
            <p style={S.label}>Görüşme Devam Ediyor</p>
            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>{partner.full_name}</h3>
            <p style={{ color: '#06b6d4', fontSize: '13px', margin: '0' }}>{partner.company}{partner.title ? ` \u2022 ${partner.title}` : ''}</p>
          </div>
          {/* Timer */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Kalan Süre</p>
            <p style={{ color: progressColor, fontSize: '48px', fontWeight: '800', fontFamily: 'monospace', margin: '0 0 12px' }}>
              {formatTime(remaining)}
            </p>
            {/* Progress bar */}
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                background: `linear-gradient(90deg, ${progressColor}, ${progressColor}88)`,
                width: `${progress * 100}%`, height: '100%', borderRadius: '8px',
                transition: 'width 1s linear'
              }} />
            </div>
          </div>
          {/* Goal */}
          {partner.goal && (
            <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ color: '#a5b4fc', fontSize: '11px', margin: '0 0 4px', fontWeight: '600' }}>Ne Arıyor?</p>
              <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: '1.5', fontStyle: 'italic' }}>"{partner.goal}"</p>
            </div>
          )}
          <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
        </div></div>
      );
    }

    // 2b: Süre dolmuş
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>⏰</div>
          <h2 style={{ color: '#fca5a5', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Süre Doldu!</h2>
          <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 4px' }}>{partner.full_name}</p>
          <p style={{ color: '#06b6d4', fontSize: '13px', margin: '0' }}>{partner.company}{partner.title ? ` \u2022 ${partner.title}` : ''}</p>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '16px 0 0', lineHeight: '1.5' }}>
          Yeni tur başladığında otomatik güncellenecek.
        </p>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '8px' }}>Tur {match.round_number}</p>
      </div></div>
    );
  }

  // ═══════════════════════════════════════════
  // STATE 3: BEKLEMEDE (tek sayı katılımcı)
  // ═══════════════════════════════════════════
  if (waiting?.isWaiting) {
    const hasRunningTimer = waiting.allStarted && waiting.lastStartedAt;
    let waitRemaining = 0;
    if (hasRunningTimer && waiting.lastStartedAt) {
      waitRemaining = getRemaining(waiting.lastStartedAt, duration);
    }

    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>⏳</div>
          <h2 style={{ color: '#fbbf24', fontSize: '18px', fontWeight: '600', margin: '0 0 8px' }}>Beklemedekisiniz</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' }}>
            Bu turda tek sayı katılımcı olduğu için eşleşme yapılamadı. Bir sonraki turda eşleşeceksiniz.
          </p>
          {/* Bekleme sayacı: Diğer çiftlerin kalan süresi */}
          {hasRunningTimer && waitRemaining > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px', marginTop: '8px' }}>
              <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase' }}>Sonraki tur tahmini</p>
              <p style={{ color: '#fbbf24', fontSize: '32px', fontWeight: '700', fontFamily: 'monospace', margin: 0 }}>
                {formatTime(waitRemaining)}
              </p>
            </div>
          )}
          {hasRunningTimer && waitRemaining <= 0 && (
            <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '12px', padding: '12px', marginTop: '8px' }}>
              <p style={{ color: '#10b981', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                Mevcut tur tamamlandı. Yeni tur bekleniyor...
              </p>
            </div>
          )}
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {waiting.roundNumber}</p>
      </div></div>
    );
  }

  // ═══════════════════════════════════════════
  // STATE 4: TUR TAMAMLANDI (match yok veya completed)
  // ═══════════════════════════════════════════
  return (
    <div style={S.page}><div style={S.card}>
      {header}
      <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>⏰</div>
        <h2 style={{ color: '#6ee7b7', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Tur Tamamlandı!</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
          Yeni tur başladığında otomatik güncellenecek.
        </p>
      </div>
      {match && <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>}
    </div></div>
  );
}
