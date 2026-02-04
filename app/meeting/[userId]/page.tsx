'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeSVG as QRCode } from 'qrcode.react';

interface UserData { id: string; full_name: string; company: string; email: string; position?: string; }
interface MatchData { id: string; status: string; started_at: string | null; round_number: number; table_number?: number | null; icebreaker_question?: string | null; }
interface PartnerData { id: string; full_name: string; company: string; email: string; }
interface EventData { id: string; name: string; duration: number; status: string; }
interface WaitingData { isWaiting: boolean; roundNumber: number; activeCount: number; pendingCount: number; totalMatches: number; allStarted: boolean; lastStartedAt: string | null; }
interface RoundInfo { current: number; max: number; participantCount: number; allCompleted: boolean; }
interface EventListItem { id: string; name: string; status: string; duration: number; }

const S = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '16px' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '28px 20px', maxWidth: '420px', width: '100%', textAlign: 'center' as const } as React.CSSProperties,
};

export default function MeetingPage() {
  const params = useParams();
  const userId = decodeURIComponent(params.userId as string);

  const [user, setUser] = useState<UserData | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [waiting, setWaiting] = useState<WaitingData | null>(null);
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [allEvents, setAllEvents] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const prevMatchRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const eventParam = selectedEventId ? `?event_id=${selectedEventId}` : '';
      const res = await fetch(`/api/meeting/${encodeURIComponent(userId)}${eventParam}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.error && !data.user) { setError(data.error); return; }
      setUser(data.user);
      setMatch(data.match);
      setPartner(data.partner);
      setEvent(data.event);
      setWaiting(data.waiting);
      setRoundInfo(data.roundInfo || null);
      if (data.allEvents) setAllEvents(data.allEvents);
      setError(null);
      const newMatchId = data.match?.id || 'none';
      if (prevMatchRef.current && prevMatchRef.current !== newMatchId) {
        console.log('[MEETING] Match changed:', prevMatchRef.current, '->', newMatchId);
      }
      prevMatchRef.current = newMatchId;
    } catch (e: any) { console.error('[MEETING] Fetch error:', e); }
  }, [userId, selectedEventId]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 3000); return () => clearInterval(iv); }, [fetchData]);

  const calcRemaining = (): number => {
    if (!match?.started_at || !event?.duration) return 0;
    return Math.max(0, Math.ceil(event.duration - (Date.now() - new Date(match.started_at).getTime()) / 1000));
  };

  const calcWaitRemaining = (): number | null => {
    if (!waiting?.allStarted || !waiting?.lastStartedAt || !event?.duration) return null;
    return Math.max(0, Math.ceil(event.duration - (Date.now() - new Date(waiting.lastStartedAt).getTime()) / 1000));
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const tCol = (s: number) => s <= 30 ? '#ef4444' : s <= 60 ? '#f59e0b' : '#10b981';

  const homeBtn = (
    <a href="/" style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s' }}>🏠 Anasayfa</a>
  );

  const userCard = user ? (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px 16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{user.full_name}</p>
      <p style={{ color: '#06b6d4', fontSize: '12px', margin: '0 0 2px' }}>{user.company}{user.position ? ` / ${user.position}` : ''}</p>
      <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{user.email}</p>
    </div>
  ) : null;

  const evSelector = allEvents.length > 1 ? (
    <div style={{ marginBottom: '12px' }}>
      <select
        value={selectedEventId || event?.id || ''}
        onChange={e => setSelectedEventId(e.target.value || null)}
        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', fontSize: '12px', width: '100%' }}
      >
        {allEvents.map(ev => (
          <option key={ev.id} value={ev.id} style={{ background: '#1e293b' }}>
            {ev.name} {ev.status === 'active' ? '(Aktif)' : '(Taslak)'}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  const header = (
    <div style={{ marginBottom: '20px' }}>
      {homeBtn}
      {/* ═══ LOGO ═══ */}
      <div style={{ marginBottom: '12px' }}>
        <img
          src="/logo-white.png"
          alt="Teknopark Ankara"
          style={{ width: '200px', height: 'auto', display: 'block', margin: '0 auto' }}
        />
      </div>
      <p style={{ color: '#94a3b8', fontSize: '14px', letterSpacing: '4px', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>TEKNOPARK ANKARA</p>
      <p style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>🤝 Speed Networking</p>
      {event && <p style={{ color: '#06b6d4', fontSize: '18px', fontWeight: 700, margin: '0 0 12px' }}>{event.name}</p>}
      {evSelector}
      {userCard}
      {roundInfo && roundInfo.max > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 16px', display: 'inline-block' }}>
          <span style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 700 }}>{roundInfo.current}</span>
          <span style={{ color: '#06b6d4', fontSize: '12px', margin: '0 0 0 2px' }}>/{roundInfo.max}</span>
        </div>
      )}
    </div>
  );

  if (error && !user) return (
    <div style={S.page}><div style={S.card}>{homeBtn}
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
      <h2 style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Hata</h2>
      <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{error}</p>
    </div></div>
  );

  if (!user) return (
    <div style={S.page}><div style={S.card}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
      <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Yükleniyor...</p>
    </div></div>
  );

  if (roundInfo?.allCompleted && !match) return (
    <div style={S.page}><div style={S.card}>{header}
      <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
        <h2 style={{ color: '#6ee7b7', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Tüm Turlar Tamamlandı!</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>Etkinlik sona erdi. Katılımınız için teşekkürler! 🙏</p>
      </div>
    </div></div>
  );

  // ACTIVE MATCH
  if (match?.status === 'active' && match.started_at) {
    const remaining = calcRemaining();
    if (remaining <= 0) return (
      <div style={S.page}><div style={S.card}>{header}
        <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>⏰</div>
          <h2 style={{ color: '#6ee7b7', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Tur Tamamlandı!</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Yeni tur başladığında otomatik güncellenecek.</p>
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
      </div></div>
    );

    return (
      <div style={S.page}><div style={S.card}>{header}
        {partner && (
          <div style={{ background: 'rgba(6,182,212,0.1)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '16px' }}>
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px' }}>Görüşme Partneriniz</p>
            <h3 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{partner.full_name}</h3>
            <p style={{ color: '#06b6d4', fontSize: '13px', margin: 0 }}>{partner.company}</p>
          </div>
        )}
        {match.table_number && (
          <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '12px', padding: '14px', border: '2px solid rgba(239,68,68,0.4)', marginBottom: '16px' }}>
            <p style={{ color: '#fca5a5', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '2px' }}>MASA NUMARASI</p>
            <p style={{ color: '#ef4444', fontSize: '36px', fontWeight: 900, margin: 0, lineHeight: 1 }}>MASA {match.table_number}</p>
          </div>
        )}
        {match.icebreaker_question && (
          <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(139,92,246,0.2)', marginBottom: '16px' }}>
            <p style={{ color: '#c4b5fd', fontSize: '11px', margin: '0 0 4px' }}>💬 Sohbet Başlatıcı</p>
            <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>{match.icebreaker_question}</p>
          </div>
        )}
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '56px', fontWeight: 800, color: tCol(remaining), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmt(remaining)}</div>
          <p style={{ color: '#64748b', fontSize: '11px', margin: '8px 0 0' }}>Tur {match.round_number}</p>
        </div>
      </div></div>
    );
  }

  // PENDING MATCH - QR CODE
  if (match?.status === 'pending') {
    const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/activate/${match.id}` : `/activate/${match.id}`;
    return (
      <div style={S.page}><div style={S.card}>{header}
        {partner && (
          <div style={{ background: 'rgba(6,182,212,0.1)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '16px' }}>
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px' }}>Eşleşme Partneriniz</p>
            <h3 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>{partner.full_name}</h3>
            <p style={{ color: '#06b6d4', fontSize: '13px', margin: 0 }}>{partner.company}</p>
          </div>
        )}
        {match.table_number && (
          <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '12px', padding: '14px', border: '2px solid rgba(239,68,68,0.4)', marginBottom: '16px' }}>
            <p style={{ color: '#fca5a5', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '2px' }}>MASA NUMARASI</p>
            <p style={{ color: '#ef4444', fontSize: '36px', fontWeight: 900, margin: 0, lineHeight: 1 }}>MASA {match.table_number}</p>
          </div>
        )}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', display: 'inline-block', marginBottom: '16px' }}>
          <QRCode value={qrUrl} size={180} />
        </div>
        <p style={{ color: '#06b6d4', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>QR Kodu Okutun</p>
        <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Partneriniz bu QR kodu okutup ismini seçince sayaç başlayacak.</p>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>
      </div></div>
    );
  }

  // WAITING (odd participant)
  if (waiting?.isWaiting) {
    const wr = calcWaitRemaining();
    return (
      <div style={S.page}><div style={S.card}>{header}
        <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>⏳</div>
          <h2 style={{ color: '#fbbf24', fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Bu Turda Eşleşme Yapılmadı</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.5 }}>
            Tek sayıda katılımcı olduğu için bu turda beklemektesiniz. Bir sonraki turda eşleşeceksiniz.
          </p>
          {wr !== null && wr > 0 && (
            <div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: tCol(wr), fontVariantNumeric: 'tabular-nums' }}>{fmt(wr)}</div>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '4px 0 0' }}>Tur bitişine kalan süre</p>
            </div>
          )}
          {wr !== null && wr <= 0 && (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>Tur tamamlandı. Yeni tur bekleniyor...</p>
          )}
        </div>
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {waiting.roundNumber}</p>
      </div></div>
    );
  }

  // NO MATCH YET
  if (!match && !waiting) return (
    <div style={S.page}><div style={S.card}>{header}
      <div style={{ background: 'rgba(6,182,212,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(6,182,212,0.2)' }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</div>
        <h2 style={{ color: '#06b6d4', fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Eşleşme Bekleniyor</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>Eşleşme yapıldığında sayfa otomatik güncellenecek.</p>
      </div>
    </div></div>
  );

  // COMPLETED fallback
  return (
    <div style={S.page}><div style={S.card}>{header}
      <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>⏰</div>
        <h2 style={{ color: '#6ee7b7', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Tur Tamamlandı!</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Yeni tur başladığında otomatik güncellenecek.</p>
      </div>
      {match && <p style={{ color: '#475569', fontSize: '11px', marginTop: '12px' }}>Tur {match.round_number}</p>}
    </div></div>
  );
}
