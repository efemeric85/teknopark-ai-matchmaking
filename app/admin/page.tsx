'use client';

import { useEffect, useState, useCallback } from 'react';
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

  // Form state
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDuration, setEventDuration] = useState('360');

  // Etkinlikleri yükle
  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEvents(data);
  }, []);

  // Katılımcıları yükle
  const loadParticipants = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (data) setParticipants(data);
  }, []);

  // Eşleşmeleri yükle
  const loadMatches = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from('matches')
      .select('*, user1:user1_id(id, full_name, company, title, email), user2:user2_id(id, full_name, company, title, email)')
      .eq('event_id', eventId)
      .order('round_number', { ascending: false });
    if (data) setMatches(data as any);
  }, []);

  // İlk yükleme
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Seçili etkinlik değişince
  useEffect(() => {
    if (selectedEvent) {
      loadParticipants(selectedEvent.id);
      loadMatches(selectedEvent.id);

      // 5 saniyede bir güncelle
      const interval = setInterval(() => {
        loadParticipants(selectedEvent.id);
        loadMatches(selectedEvent.id);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedEvent, loadParticipants, loadMatches]);

  // Etkinlik oluştur
  const createEvent = async () => {
    if (!eventName.trim()) {
      showMessage('Etkinlik adı gerekli.', 'error');
      return;
    }

    const { error } = await supabase.from('events').insert({
      name: eventName.trim(),
      date: eventDate || new Date().toISOString().split('T')[0],
      duration: parseInt(eventDuration) || 360,
      status: 'draft',
    });

    if (error) {
      showMessage('Hata: ' + error.message, 'error');
    } else {
      showMessage('Etkinlik oluşturuldu.', 'success');
      setEventName('');
      setEventDate('');
      setEventDuration('360');
      loadEvents();
    }
  };

  // Etkinlik sil
  const deleteEvent = async (id: string) => {
    if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;

    // Önce eşleşmeleri sil
    await supabase.from('matches').delete().eq('event_id', id);
    // Kullanıcıları sil
    await supabase.from('users').delete().eq('event_id', id);
    // Etkinliği sil
    await supabase.from('events').delete().eq('id', id);

    if (selectedEvent?.id === id) {
      setSelectedEvent(null);
      setParticipants([]);
      setMatches([]);
    }
    loadEvents();
    showMessage('Etkinlik silindi.', 'info');
  };

  // Eşleştir ve Başlat
  const createAndStartMatches = async () => {
    if (!selectedEvent) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/match`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Eşleştirme hatası', 'error');
      } else {
        showMessage(data.message, 'success');
        loadMatches(selectedEvent.id);
      }
    } catch (err: any) {
      showMessage('Bağlantı hatası: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Bekleyen eşleşmeleri aktifleştir
  const activatePendingMatches = async () => {
    if (!selectedEvent) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/activate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Aktifleştirme hatası', 'error');
      } else {
        showMessage(data.message, 'success');
        loadMatches(selectedEvent.id);
      }
    } catch (err: any) {
      showMessage('Bağlantı hatası: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Tur istatistikleri
  const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number || 1)) : 0;
  const currentRoundMatches = matches.filter(m => (m.round_number || 1) === currentRound);
  const pendingCount = currentRoundMatches.filter(m => m.status === 'pending').length;
  const activeCount = currentRoundMatches.filter(m => m.status === 'active').length;
  const completedCount = currentRoundMatches.filter(m => m.status === 'completed').length;
  const allCompleted = currentRoundMatches.length > 0 && completedCount === currentRoundMatches.length;

  // Eşleşmemiş katılımcılar
  const matchedUserIds = new Set<string>();
  currentRoundMatches.forEach(m => {
    matchedUserIds.add(m.user1_id);
    matchedUserIds.add(m.user2_id);
  });
  const unmatchedParticipants = participants.filter(p => !matchedUserIds.has(p.id));

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafbfc',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: '20px',
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
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
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: '500',
            background: message.type === 'success' ? '#dcfce7' : message.type === 'error' ? '#fee2e2' : '#dbeafe',
            color: message.type === 'success' ? '#166534' : message.type === 'error' ? '#991b1b' : '#1e40af',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : message.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Yeni Etkinlik */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '20px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 12px' }}>
            Yeni Etkinlik
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Etkinlik adı"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              type="number"
              placeholder="Süre (saniye)"
              value={eventDuration}
              onChange={e => setEventDuration(e.target.value)}
              style={inputStyle}
            />
            <button onClick={createEvent} style={{
              ...btnPrimary,
              width: '100%',
            }}>
              + Etkinlik Oluştur
            </button>
          </div>
        </div>

        {/* Etkinlikler */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '20px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 12px' }}>
            Etkinlikler
          </h3>
          {events.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz etkinlik yok.</p>
          ) : (
            events.map(ev => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  border: selectedEvent?.id === ev.id ? '2px solid #06b6d4' : '1px solid #e2e8f0',
                  background: selectedEvent?.id === ev.id ? '#f0fdfa' : '#fff',
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{ev.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '10px' }}>
                    {ev.date} &bull; {ev.duration}s &bull; {ev.status}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
                  style={{
                    background: '#fee2e2',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🗑️ Sil
                </button>
              </div>
            ))
          )}
        </div>

        {/* Seçili Etkinlik Detayları */}
        {selectedEvent && (
          <>
            {/* Katılımcılar */}
            <div style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '16px',
              border: '1px solid #e2e8f0',
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 12px' }}>
                👥 Katılımcılar ({participants.length})
              </h3>
              {participants.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz katılımcı yok.</p>
              ) : (
                participants.map(p => (
                  <div key={p.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{p.full_name}</span>
                      <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '8px' }}>
                        {p.company} &bull; {p.title}
                      </span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>{p.email}</span>
                  </div>
                ))
              )}
            </div>

            {/* Eşleştirme Kontrolleri */}
            <div style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '16px',
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0' }}>
                  🏆 Tur {currentRound || 1} Durumu
                </h3>
                {currentRoundMatches.length > 0 && (
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: allCompleted ? '#dcfce7' : '#fef3c7',
                    color: allCompleted ? '#166534' : '#92400e',
                  }}>
                    {allCompleted ? '✅ Tamamlandı' : '⚙️ Devam Ediyor'}
                  </span>
                )}
              </div>

              {/* İstatistikler */}
              {currentRoundMatches.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <StatBox label="Bekleyen" value={pendingCount} color="#f59e0b" icon="⏳" />
                  <StatBox label="Aktif" value={activeCount} color="#06b6d4" icon="⏱️" />
                  <StatBox label="Tamamlanan" value={completedCount} color="#10b981" icon="✅" />
                </div>
              )}

              {/* Butonlar */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {/* Yeni tur başlat (eşleştir + aktifleştir) */}
                {(allCompleted || currentRound === 0) && participants.length >= 2 && (
                  <button
                    onClick={createAndStartMatches}
                    disabled={loading}
                    style={{
                      ...btnPrimary,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? '⏳ İşleniyor...' : currentRound === 0 ? '🚀 Eşleştir ve Başlat' : '🔄 Yeni Tur Başlat'}
                  </button>
                )}

                {/* Mevcut bekleyen eşleşmeleri aktifleştir */}
                {pendingCount > 0 && (
                  <button
                    onClick={activatePendingMatches}
                    disabled={loading}
                    style={{
                      ...btnSuccess,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? '⏳ İşleniyor...' : `▶️ ${pendingCount} Eşleşmeyi Başlat`}
                  </button>
                )}
              </div>

              {/* Uyarı: aktif eşleşmeler devam ederken yeni tur başlatılamaz */}
              {(activeCount > 0 || pendingCount > 0) && !allCompleted && currentRound > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#dbeafe',
                  border: '1px solid #bfdbfe',
                  fontSize: '13px',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span>⏱️</span>
                  <span>
                    {activeCount > 0
                      ? `${activeCount} görüşme devam ediyor. Tüm görüşmeler bittiğinde yeni tur başlatabilirsiniz.`
                      : `${pendingCount} eşleşme başlatılmayı bekliyor. Yukarıdaki butona basarak başlatın.`
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Eşleşmeler */}
            {currentRoundMatches.length > 0 && (
              <div style={{
                background: '#fff',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid #e2e8f0',
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 12px' }}>
                  Eşleşmeler ({currentRoundMatches.length})
                </h3>
                {currentRoundMatches.map(m => {
                  const u1 = (m as any).user1;
                  const u2 = (m as any).user2;
                  return (
                    <div key={m.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      borderRadius: '10px',
                      marginBottom: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}>
                      <div>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>
                          {u1?.full_name || m.user1_id}
                        </span>
                        <span style={{ color: '#94a3b8', margin: '0 8px' }}>&harr;</span>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>
                          {u2?.full_name || m.user2_id}
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: m.status === 'active' ? '#dbeafe' : m.status === 'completed' ? '#dcfce7' : '#fef3c7',
                        color: m.status === 'active' ? '#1d4ed8' : m.status === 'completed' ? '#166534' : '#92400e',
                      }}>
                        {m.status === 'active' ? '⏱️ Aktif' : m.status === 'completed' ? '✅ Tamamlandı' : '⏳ Bekliyor'}
                      </span>
                    </div>
                  );
                })}

                {/* Eşleşmemiş katılımcılar */}
                {unmatchedParticipants.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    fontSize: '13px',
                    color: '#92400e',
                  }}>
                    ⏳ Beklemede: {unmatchedParticipants.map(p => p.full_name).join(', ')}
                    <span style={{ fontSize: '11px', display: 'block', marginTop: '4px', color: '#a16207' }}>
                      (Tek sayı katılımcı olduğu için bu turda eşleşmedi)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bu sayfa otomatik güncelleniyor notu */}
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
              Bu sayfa 5 saniyede bir otomatik güncelleniyor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// =================== COMPONENTS ===================

function StatBox({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '14px',
      background: '#f8fafc',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
    }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</div>
    </div>
  );
}

// =================== STYLES ===================

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '10px',
  border: 'none',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  background: '#06b6d4',
  color: '#fff',
  transition: 'opacity 0.2s',
};

const btnSuccess: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '10px',
  border: 'none',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  background: '#10b981',
  color: '#fff',
  transition: 'opacity 0.2s',
};
