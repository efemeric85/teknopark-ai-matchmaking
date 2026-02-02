'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface MeetingData {
  v?: string;
  user?: { id: string; full_name: string; company: string; email: string };
  match?: { id: string; status: string; started_at: string | null; round_number: number } | null;
  partner?: { id: string; full_name: string; company: string; title: string; goal: string } | null;
  event?: { id: string; name: string; duration: number; status: string } | null;
  waiting?: {
    isWaiting: boolean; roundNumber: number;
    activeCount: number; pendingCount: number;
    totalMatches: number; allStarted: boolean; lastStartedAt: string | null;
  } | null;
  roundInfo?: { current: number; max: number; participantCount: number; allCompleted: boolean } | null;
  error?: string;
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '16px' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', maxWidth: '400px', width: '100%', textAlign: 'center' } as React.CSSProperties,
  label: { color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 8px' } as React.CSSProperties,
};

export default function MeetingPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<MeetingData | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/meeting/${encodeURIComponent(userId)}`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error('Fetch error:', e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── LOADING ───
  if (!data || !data.user) {
    return (
      <div style={S.page}><div style={S.card}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Yükleniyor...</p>
      </div></div>
    );
  }

  const { match, partner, event, waiting, roundInfo } = data;
  const duration = event?.duration || 360;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const allDone = roundInfo?.allCompleted === true;

  // ─── HEADER ───
  const header = (
    <div style={{ marginBottom: '16px' }}>
      <p style={S.label}>TEKNOPARK ANKARA</p>
      <h2 style={{ color: '#06b6d4', fontSize: '16px', fontWeight: '600', margin: '0 0 12px' }}>
        {event?.name || 'Networking'}
      </h2>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '8px' }}>
        <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 2px' }}>
          {data.user!.full_name}
        </h3>
        <p style={{ color: '#06b6d4', fontSize: '12px', margin: 0 }}>
          {data.user!.company || data.user!.email}
        </p>
      </div>
      {roundInfo && roundInfo.max > 0 && (
        <p style={{ color: '#475569', fontSize: '11px', margin: '4px 0 0' }}>
          Tur {roundInfo.current}/{roundInfo.max}
        </p>
      )}
    </div>
  );

  // ════════════════════════════════════════
  // STATE 1: ACTIVE MATCH - TIMER RUNNING
  // ════════════════════════════════════════
  if (match?.status === 'active' && match.started_at) {
    const elapsed = Math.floor((now - new Date(match.started_at).getTime()) / 1000);
    const remaining = Math.max(0, duration - elapsed);
    const progress = remaining / duration;

    // ── 1a: Süre devam ediyor ──
    if (remaining > 0) {
      return (
        <div style={S.page}><div style={S.card}>
          {header}
          {partner && (
            <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))', borderRadius: '16px', padding: '16px', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '16px' }}>
              <p style={S.label}>Eşleştiğiniz Kişi</p>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>{partner.full_name}</h3>
              <p style={{ color: '#06b6d4', fontSize: '13px', margin: '0' }}>{partner.company} &bull; {partner.title}</p>
            </div>
          )}
          <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p style={{ color: '#6ee7b7', fontSize: '12px', fontWeight: '600', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Kalan Süre</p>
            <p style={{ color: '#fff', fontSize: '48px', fontWeight: '700', margin: '0 0 12px', fontVariantNumeric: 'tabular-nums' }}>{formatTime(remaining)}</p>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
              <div style={{ background: remaining < 60 ? '#ef4444' : '#10b981', height: '100%', width: `${progress * 100}%`, borderRadius: '999px', transition: 'width 1s linear' }} />
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
        </div></div>
      );
    }

    // ── 1b: Süre doldu ──
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>⏰</div>
          <h2 style={{ color: '#f87171', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Süre Doldu!</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
            {allDone
              ? 'Tüm turlar tamamlandı. Etkinlik sona erdi. Katılımınız için teşekkürler!'
              : 'Yeni tur başladığında otomatik güncellenecek.'
            }
          </p>
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
      </div></div>
    );
  }

  // ════════════════════════════════════════
  // STATE 2: PENDING MATCH - QR CODE
  // ════════════════════════════════════════
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
            Partnerinizle buluşun. İkinizden biri diğerinin telefonundaki QR kodu okuttuğunda sayaç başlayacak.
          </p>
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
      </div></div>
    );
  }

  // ════════════════════════════════════════
  // STATE 3: WAITING (tek sayı katılımcı)
  // ════════════════════════════════════════
  if (waiting?.isWaiting) {
    const waitDuration = duration;
    let waitRemaining = waitDuration;

    if (waiting.allStarted && waiting.lastStartedAt) {
      const waitElapsed = Math.floor((now - new Date(waiting.lastStartedAt).getTime()) / 1000);
      waitRemaining = Math.max(0, waitDuration - waitElapsed);
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
          {waiting.allStarted && waiting.lastStartedAt && (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px' }}>
              <p style={{ color: '#fbbf24', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase' }}>Tur Bitimine Kalan</p>
              <p style={{ color: '#fff', fontSize: '32px', fontWeight: '700', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatTime(waitRemaining)}</p>
            </div>
          )}
          {!waiting.allStarted && (
            <p style={{ color: '#78716c', fontSize: '11px', margin: '8px 0 0' }}>
              {waiting.pendingCount} çift henüz QR okutmadı
            </p>
          )}
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {waiting.roundNumber}</p>
      </div></div>
    );
  }

  // ════════════════════════════════════════
  // STATE 4: TÜM TURLAR TAMAMLANDI
  // ════════════════════════════════════════
  if (allDone) {
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(168,85,247,0.1))', borderRadius: '16px', padding: '24px', border: '1px solid rgba(6,182,212,0.2)' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
          <h2 style={{ color: '#06b6d4', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Tüm Turlar Tamamlandı!</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' }}>
            {roundInfo!.participantCount} katılımcı ile {roundInfo!.max} tur görüşme tamamlandı. Etkinlik sona erdi.
          </p>
          <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: 0 }}>
            Katılımınız için teşekkürler! 🙏
          </p>
        </div>
      </div></div>
    );
  }

  // ════════════════════════════════════════
  // STATE 5a: HENÜZ EŞLEŞME YOK
  // ════════════════════════════════════════
  if (!match && !waiting) {
    return (
      <div style={S.page}><div style={S.card}>
        {header}
        <div style={{ background: 'rgba(6,182,212,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(6,182,212,0.2)' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</div>
          <h2 style={{ color: '#06b6d4', fontSize: '18px', fontWeight: '600', margin: '0 0 8px' }}>Eşleşme Bekleniyor</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
            Eşleşme için bu sayfada bekleyiniz. Eşleşme yapıldığında sayfa otomatik güncellenecek.
          </p>
        </div>
      </div></div>
    );
  }

  // ════════════════════════════════════════
  // STATE 5b: TUR TAMAMLANDI (completed)
  // ════════════════════════════════════════
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
