'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Event {
  id: string;
  name: string;
  date: string;
  duration: number;
  status: string;
}

interface User {
  id: string;
  full_name: string;
  company: string;
  title: string;
  email: string;
  event_id: string;
}

interface Match {
  id: string;
  event_id: string;
  user1_id: string;
  user2_id: string;
  round_number: number;
  status: string;
  started_at: string | null;
  user1?: User;
  user2?: User;
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [tick, setTick] = useState(0);

  // Form state
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDuration, setEventDuration] = useState('360');

  // Her saniye tick (timer güncellemesi için)
  useEffect(() => {
    const t = setInterval(() => setTick(prev => prev + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEvents(data);
  }, []);

  const loadParticipants = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (data) setParticipants(data);
  }, []);

  const loadMatches = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from('matches')
      .select('*, user1:user1_id(id, full_name, company, title, email), user2:user2_id(id, full_name, company, title, email)')
      .eq('event_id', eventId)
      .order('round_number', { ascending: false });
    if (data) setMatches(data as any);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (selectedEvent) {
      loadParticipants(selectedEvent.id);
      loadMatches(selectedEvent.id);
      const interval = setInterval(() => {
        loadParticipants(selectedEvent.id);
        loadMatches(selectedEvent.id);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedEvent, loadParticipants, loadMatches]);

  const createEvent = async () => {
    if (!eventName.trim()) { showMessage('Etkinlik adı gerekli.', 'error'); return; }
    const { error } = await supabase.from('events').insert({
      name: eventName.trim(),
      date: eventDate || new Date().toISOString().split('T')[0],
      duration: parseInt(eventDuration) || 360,
      status: 'draft',
    });
    if (error) { showMessage('Hata: ' + error.message, 'error'); }
    else {
      showMessage('Etkinlik oluşturuldu.', 'success');
      setEventName(''); setEventDate(''); setEventDuration('360');
      loadEvents();
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Bu etkinliği ve tüm verilerini silmek istediğinize emin misiniz?')) return;
    await supabase.from('matches').delete().eq('event_id', id);
    await supabase.from('users').delete().eq('event_id', id);
    await supabase.from('events').delete().eq('id', id);
    if (selectedEvent?.id === id) {
      setSelectedEvent(null); setParticipants([]); setMatches([]);
    }
    loadEvents();
    showMessage('Etkinlik silindi.', 'info');
  };

  // EŞLEŞTIR VE BAŞLAT
  const createAndStartMatches = async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/match`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showMessage(data.error || 'Eşleştirme hatası', 'error'); }
      else { showMessage(data.message, 'success'); loadMatches(selectedEvent.id); }
    } catch (err: any) {
      showMessage('Bağlantı hatası: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  // TÜM EŞLEŞMELERİ SIFIRLA
  const resetAllMatches = async () => {
    if (!selectedEvent) return;
    if (!confirm('Bu etkinlikteki TÜM eşleşmeler silinecek. Emin misiniz?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/match`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { showMessage(data.error || 'Sıfırlama hatası', 'error'); }
      else { showMessage(data.message, 'success'); loadMatches(selectedEvent.id); }
    } catch (err: any) {
      showMessage('Bağlantı hatası: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Hesaplamalar
  const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number || 1)) : 0;
  const currentRoundMatches = matches.filter(m => (m.round_number || 1) === currentRound);
  const pendingCount = currentRoundMatches.filter(m => m.status === 'pending').length;
  const activeCount = currentRoundMatches.filter(m => m.status === 'active').length;
  const completedCount = currentRoundMatches.filter(m => m.status === 'completed').length;
  const allCompleted = currentRoundMatches.length > 0 && activeCount === 0 && pendingCount === 0;

  const matchedUserIds = new Set<string>();
  currentRoundMatches.forEach(m => { matchedUserIds.add(m.user1_id); matchedUserIds.add(m.user2_id); });
  const unmatchedParticipants = currentRound > 0 ? participants.filter(p => !matchedUserIds.has(p.id)) : [];

  // Timer hesapla
  const getTimeLeft = (match: Match): number | null => {
    if (match.status !== 'active' || !match.started_at || !selectedEvent) return null;
    const duration = selectedEvent.duration || 360;
    const startTime = new Date(match.started_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    const remaining = duration - elapsed;
    return remaining > 0 ? remaining : 0;
  };

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

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '20px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 4px' }}>
            TEKNOPARK ANKARA
          </p>
          <h1 style={{ color: '#0f172a', fontSize: '22px', fontWeight: '700', margin: '0' }}>
            🛠️ Admin Paneli
          </h1>
        </div>

        {/* Mesaj */}
        {message && (
          <div style={{
            padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
            fontSize: '14px', fontWeight: '500',
            background: message.type === 'success' ? '#dcfce7' : message.type === 'error' ? '#fee2e2' : '#dbeafe',
            color: message.type === 'success' ? '#166534' : message.type === 'error' ? '#991b1b' : '#1e40af',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : message.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Yeni Etkinlik */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Yeni Etkinlik</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input type="text" placeholder="Etkinlik adı" value={eventName}
              onChange={e => setEventName(e.target.value)} style={inputStyle} />
            <input type="date" value={eventDate}
              onChange={e => setEventDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input type="number" placeholder="Süre (saniye)" value={eventDuration}
              onChange={e => setEventDuration(e.target.value)} style={inputStyle} />
            <button onClick={createEvent} style={{ ...btnPrimary, width: '100%' }}>+ Etkinlik Oluştur</button>
          </div>
        </div>

        {/* Etkinlikler */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Etkinlikler</h3>
          {events.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz etkinlik yok.</p>
          ) : events.map(ev => (
            <div key={ev.id} onClick={() => setSelectedEvent(ev)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer',
              border: selectedEvent?.id === ev.id ? '2px solid #06b6d4' : '1px solid #e2e8f0',
              background: selectedEvent?.id === ev.id ? '#f0fdfa' : '#fff',
            }}>
              <div>
                <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{ev.name}</span>
                <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '10px' }}>
                  {ev.date} &bull; {ev.duration}s &bull; {ev.status}
                </span>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id); }} style={btnDanger}>🗑️ Sil</button>
            </div>
          ))}
        </div>

        {/* Seçili etkinlik detayları */}
        {selectedEvent && (
          <>
            {/* Katılımcılar */}
            <div style={cardStyle}>
              <h3 style={sectionTitle}>👥 Katılımcılar ({participants.length})</h3>
              {participants.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz katılımcı yok.</p>
              ) : participants.map(p => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #f1f5f9',
                }}>
                  <div>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{p.full_name}</span>
                    <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '8px' }}>
                      {p.company} &bull; {p.title}
                    </span>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>{p.email}</span>
                </div>
              ))}
            </div>

            {/* Kontrol Paneli */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ ...sectionTitle, margin: '0' }}>
                  🏆 Tur {currentRound || '-'}
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {currentRound > 0 && (
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      background: allCompleted ? '#dcfce7' : activeCount > 0 ? '#dbeafe' : '#fef3c7',
                      color: allCompleted ? '#166534' : activeCount > 0 ? '#1d4ed8' : '#92400e',
                    }}>
                      {allCompleted ? '✅ Tamamlandı' : activeCount > 0 ? `⏱️ ${activeCount} aktif` : '⏳ Bekliyor'}
                    </span>
                  )}
                </div>
              </div>

              {/* İstatistikler */}
              {currentRound > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <StatBox label="Bekleyen" value={pendingCount} color="#f59e0b" icon="⏳" />
                  <StatBox label="Aktif" value={activeCount} color="#06b6d4" icon="⏱️" />
                  <StatBox label="Tamamlanan" value={completedCount} color="#10b981" icon="✅" />
                </div>
              )}

              {/* Butonlar */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {participants.length >= 2 && (
                  <button onClick={createAndStartMatches} disabled={loading} style={{
                    ...btnPrimary, opacity: loading ? 0.6 : 1,
                  }}>
                    {loading ? '⏳ İşleniyor...' : currentRound === 0 ? '🚀 Eşleştir ve Başlat' : '🔄 Yeni Tur Başlat'}
                  </button>
                )}

                {currentRound > 0 && (
                  <button onClick={resetAllMatches} disabled={loading} style={{
                    padding: '10px 20px', borderRadius: '10px', border: '1px solid #fecaca',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                    background: '#fff', color: '#dc2626',
                  }}>
                    🗑️ Tümünü Sıfırla
                  </button>
                )}
              </div>

              {participants.length < 2 && (
                <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '12px' }}>
                  Eşleştirme için en az 2 katılımcı gerekli.
                </p>
              )}
            </div>

            {/* AKTİF EŞLEŞMELER (Canlı Timer'lı) */}
            {currentRoundMatches.length > 0 && (
              <div style={cardStyle}>
                <h3 style={sectionTitle}>Eşleşmeler (Tur {currentRound})</h3>

                {currentRoundMatches.map(m => {
                  const u1 = (m as any).user1;
                  const u2 = (m as any).user2;
                  const timeLeft = getTimeLeft(m);
                  const duration = selectedEvent.duration || 360;
                  const isActive = m.status === 'active';
                  const isCompleted = m.status === 'completed';
                  const isExpired = isActive && timeLeft !== null && timeLeft <= 0;

                  return (
                    <div key={m.id} style={{
                      padding: '16px', borderRadius: '12px', marginBottom: '10px',
                      background: isActive ? (isExpired ? '#fef2f2' : '#f0fdfa') : isCompleted ? '#f8fafc' : '#fffbeb',
                      border: `1px solid ${isActive ? (isExpired ? '#fecaca' : '#99f6e4') : isCompleted ? '#e2e8f0' : '#fde68a'}`,
                    }}>
                      {/* Kullanıcı bilgileri */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isActive ? '12px' : '0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* User 1 */}
                            <div style={{
                              background: '#fff', padding: '6px 12px', borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                            }}>
                              <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                                {u1?.full_name || '?'}
                              </span>
                              <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '6px' }}>
                                {u1?.company || ''}
                              </span>
                            </div>

                            <span style={{ color: '#94a3b8', fontSize: '16px' }}>↔</span>

                            {/* User 2 */}
                            <div style={{
                              background: '#fff', padding: '6px 12px', borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                            }}>
                              <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                                {u2?.full_name || '?'}
                              </span>
                              <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '6px' }}>
                                {u2?.company || ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                          marginLeft: '12px', whiteSpace: 'nowrap',
                          background: isCompleted ? '#dcfce7' : isExpired ? '#fee2e2' : isActive ? '#dbeafe' : '#fef3c7',
                          color: isCompleted ? '#166534' : isExpired ? '#991b1b' : isActive ? '#1d4ed8' : '#92400e',
                        }}>
                          {isCompleted ? '✅ Bitti' : isExpired ? '⏰ Süre Doldu' : isActive ? '⏱️ Aktif' : '⏳ Bekliyor'}
                        </span>
                      </div>

                      {/* Canlı Timer (sadece aktif eşleşmeler için) */}
                      {isActive && timeLeft !== null && !isExpired && (
                        <div style={{
                          background: '#fff', borderRadius: '10px', padding: '10px 16px',
                          border: '1px solid #e2e8f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>Kalan süre:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontSize: '22px', fontWeight: '800', color: getTimerColor(timeLeft),
                              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                            }}>
                              {formatTime(timeLeft)}
                            </span>
                            {/* Mini progress bar */}
                            <div style={{
                              width: '80px', height: '6px', background: '#f1f5f9',
                              borderRadius: '3px', overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${(timeLeft / duration) * 100}%`, height: '100%',
                                background: getTimerColor(timeLeft), borderRadius: '3px',
                                transition: 'width 1s linear',
                              }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Süre doldu uyarısı */}
                      {isActive && isExpired && (
                        <div style={{
                          background: '#fff', borderRadius: '10px', padding: '10px 16px',
                          border: '1px solid #fecaca', textAlign: 'center',
                        }}>
                          <span style={{ color: '#dc2626', fontSize: '14px', fontWeight: '600' }}>
                            ⏰ Süre doldu!
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Eşleşmemiş / Beklemede katılımcılar */}
                {unmatchedParticipants.length > 0 && (
                  <div style={{
                    marginTop: '8px', padding: '12px 16px', borderRadius: '10px',
                    background: '#fffbeb', border: '1px solid #fde68a',
                  }}>
                    <div style={{ fontSize: '13px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>
                      ⏳ Beklemede ({unmatchedParticipants.length} kişi)
                    </div>
                    {unmatchedParticipants.map(p => (
                      <div key={p.id} style={{ fontSize: '13px', color: '#a16207', padding: '2px 0' }}>
                        {p.full_name} ({p.company})
                      </div>
                    ))}
                    <div style={{ fontSize: '11px', color: '#a16207', marginTop: '6px' }}>
                      Tek sayı katılımcı olduğu için bu turda eşleşmedi.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Geçmiş turlar */}
            {currentRound > 1 && (
              <div style={cardStyle}>
                <h3 style={sectionTitle}>Geçmiş Turlar</h3>
                {Array.from({ length: currentRound - 1 }, (_, i) => currentRound - 1 - i).map(roundNum => {
                  const roundMatches = matches.filter(m => (m.round_number || 1) === roundNum);
                  return (
                    <div key={roundNum} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                        Tur {roundNum} ({roundMatches.length} eşleşme)
                      </div>
                      {roundMatches.map(m => {
                        const u1 = (m as any).user1;
                        const u2 = (m as any).user2;
                        return (
                          <div key={m.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 12px', borderRadius: '8px', marginBottom: '4px',
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            fontSize: '13px',
                          }}>
                            <span style={{ color: '#334155' }}>
                              {u1?.full_name || '?'} ↔ {u2?.full_name || '?'}
                            </span>
                            <span style={{ color: '#10b981', fontSize: '11px' }}>✅</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
              Bu sayfa 5 saniyede bir otomatik güncelleniyor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '14px', background: '#f8fafc',
      borderRadius: '10px', border: '1px solid #e2e8f0',
    }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '14px', padding: '20px',
  marginBottom: '16px', border: '1px solid #e2e8f0',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 12px',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
  fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: '10px', border: 'none', fontSize: '14px',
  fontWeight: '600', cursor: 'pointer', background: '#06b6d4', color: '#fff',
};

const btnDanger: React.CSSProperties = {
  background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '6px 12px',
  color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
};
