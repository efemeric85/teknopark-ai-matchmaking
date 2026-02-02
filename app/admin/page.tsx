'use client';

import { useState, useEffect, useCallback } from 'react';

export default function AdminPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [roundData, setRoundData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);

  // Event creation
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState('360');

  // Events yükle
  const fetchEvents = async () => {
    const res = await fetch('/api/events');
    const data = await res.json();
    if (data.events) setEvents(data.events);
  };

  // Katılımcıları yükle
  const fetchParticipants = useCallback(async (eventId: string) => {
    const res = await fetch(`/api/events/${eventId}`);
    const data = await res.json();
    if (data.event?.participants) setParticipants(data.event.participants);
  }, []);

  // Tur durumunu yükle
  const fetchRoundData = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/rounds`);
      const data = await res.json();
      setRoundData(data);
    } catch {
      setRoundData(null);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, []);

  // Seçili etkinlik için polling
  useEffect(() => {
    if (!selectedEventId) return;
    fetchParticipants(selectedEventId);
    fetchRoundData(selectedEventId);
    const interval = setInterval(() => fetchRoundData(selectedEventId), 8000);
    return () => clearInterval(interval);
  }, [selectedEventId, fetchParticipants, fetchRoundData]);

  // Etkinlik oluştur
  const createEvent = async () => {
    if (!newName) return;
    setLoading(true);
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          event_date: newDate || null,
          round_duration_sec: parseInt(newDuration) || 360,
          status: 'active'
        })
      });
      setNewName(''); setNewDate(''); setNewDuration('360');
      fetchEvents();
    } finally { setLoading(false); }
  };

  // Etkinlik sil
  const deleteEvent = async (id: string) => {
    if (!confirm('Bu etkinliği ve tüm verilerini silmek istediğinize emin misiniz?')) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (selectedEventId === id) { setSelectedEventId(null); setParticipants([]); setRoundData(null); }
    fetchEvents();
  };

  // İlk tur eşleştirme başlat
  const startMatching = async () => {
    if (!selectedEventId) return;
    setMatching(true);
    try {
      const res = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: selectedEventId })
      });
      const data = await res.json();
      if (data.error) alert('Hata: ' + data.error);
      else {
        alert('Eşleştirmeler oluşturuldu!');
        fetchRoundData(selectedEventId);
      }
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally { setMatching(false); }
  };

  // Sıradaki turu başlat
  const startNextRound = async () => {
    if (!selectedEventId) return;
    setCreatingRound(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.error) {
        alert('Hata: ' + data.error);
      } else {
        alert(`Tur ${data.round} oluşturuldu! ${data.matchCount} eşleşme, ${data.unmatchedCount} kişi beklemede.`);
        fetchRoundData(selectedEventId);
      }
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally { setCreatingRound(false); }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#0f172a', color: 'white', padding: '20px 24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>🛠️ Admin Panel</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>Teknopark AI Networking Yönetimi</p>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Etkinlik Oluştur */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Yeni Etkinlik</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input placeholder="Etkinlik adı" value={newName} onChange={e => setNewName(e.target.value)}
              style={inputStyle} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={inputStyle} />
            <input type="number" placeholder="Süre (saniye)" value={newDuration} onChange={e => setNewDuration(e.target.value)}
              style={inputStyle} />
            <button onClick={createEvent} disabled={loading || !newName}
              style={{ ...btnStyle, background: '#22d3ee', color: '#0f172a' }}>
              {loading ? 'Oluşturuluyor...' : '+ Etkinlik Oluştur'}
            </button>
          </div>
        </div>

        {/* Etkinlik Listesi */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Etkinlikler</h2>
          {events.length === 0 && <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz etkinlik yok</p>}
          {events.map(event => (
            <div key={event.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '8px', marginBottom: '8px',
              background: selectedEventId === event.id ? '#f0f9ff' : '#f8fafc',
              border: selectedEventId === event.id ? '2px solid #22d3ee' : '1px solid #e2e8f0',
              cursor: 'pointer'
            }}
              onClick={() => setSelectedEventId(event.id)}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px' }}>{event.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {event.event_date || 'Tarih belirlenmemiş'} &bull; {event.round_duration_sec || 360}s
                  &bull; {event.status}
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}>
                🗑️ Sil
              </button>
            </div>
          ))}
        </div>

        {/* Seçili Etkinlik Detayı */}
        {selectedEvent && (
          <>
            {/* Katılımcılar */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
                👥 Katılımcılar ({participants.length})
              </h2>
              {participants.length === 0 && <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz katılımcı yok</p>}
              <div style={{ display: 'grid', gap: '8px' }}>
                {participants.map((p: any) => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', fontSize: '14px'
                  }}>
                    <div>
                      <strong>{p.full_name}</strong>
                      <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{p.company} &bull; {p.position}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{p.email}</span>
                  </div>
                ))}
              </div>

              {/* İlk eşleştirme butonu (henüz eşleşme yoksa) */}
              {(!roundData || roundData.currentRound === 0) && participants.length >= 2 && (
                <button onClick={startMatching} disabled={matching}
                  style={{ ...btnStyle, background: '#8b5cf6', color: 'white', width: '100%', marginTop: '16px', padding: '14px' }}>
                  {matching ? '⏳ Eşleştirme yapılıyor...' : '🤖 AI Eşleştirmeleri Başlat (Tur 1)'}
                </button>
              )}
            </div>

            {/* TUR YÖNETİMİ */}
            {roundData && roundData.currentRound > 0 && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    🎯 Tur {roundData.currentRound} Durumu
                  </h2>
                  <div style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                    background: roundData.allCompleted ? '#dcfce7' : '#fef3c7',
                    color: roundData.allCompleted ? '#16a34a' : '#d97706'
                  }}>
                    {roundData.allCompleted ? '✅ Tamamlandı' : '⏱️ Devam Ediyor'}
                  </div>
                </div>

                {/* İstatistikler */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <StatBox label="Bekleyen" value={roundData.pendingMatches || 0} color="#94a3b8" icon="⏳" />
                  <StatBox label="Aktif" value={roundData.activeMatches || 0} color="#f59e0b" icon="⏱️" />
                  <StatBox label="Tamamlanan" value={roundData.completedMatches || 0} color="#22c55e" icon="✅" />
                </div>

                {/* Eşleşme Listesi */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#64748b' }}>
                    Eşleşmeler ({roundData.totalMatches})
                  </h3>
                  {(roundData.matches || []).map((m: any) => (
                    <div key={m.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', borderRadius: '8px', marginBottom: '6px',
                      background: m.status === 'completed' ? '#f0fdf4' : m.status === 'active' ? '#fffbeb' : '#f8fafc',
                      border: `1px solid ${m.status === 'completed' ? '#bbf7d0' : m.status === 'active' ? '#fde68a' : '#e2e8f0'}`
                    }}>
                      <div style={{ fontSize: '14px' }}>
                        <strong>{m.user1?.full_name || 'Kullanıcı 1'}</strong>
                        <span style={{ margin: '0 8px', color: '#94a3b8' }}>↔</span>
                        <strong>{m.user2?.full_name || 'Kullanıcı 2'}</strong>
                      </div>
                      <span style={{
                        fontSize: '12px', fontWeight: '600',
                        color: m.status === 'completed' ? '#16a34a' : m.status === 'active' ? '#d97706' : '#94a3b8'
                      }}>
                        {m.status === 'completed' ? '✅ Tamamlandı' : m.status === 'active' ? '⏱️ Görüşme Devam Ediyor' : '⏳ Bekliyor'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Sıradaki Tur Butonu */}
                {roundData.allCompleted && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                    borderRadius: '12px', padding: '20px', textAlign: 'center',
                    border: '2px solid #86efac'
                  }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#16a34a', marginBottom: '12px' }}>
                      🎉 Tur {roundData.currentRound} tamamlandı!
                    </div>
                    <button onClick={startNextRound} disabled={creatingRound}
                      style={{
                        ...btnStyle,
                        background: creatingRound ? '#94a3b8' : '#22c55e',
                        color: 'white',
                        padding: '14px 32px',
                        fontSize: '16px'
                      }}>
                      {creatingRound ? '⏳ Oluşturuluyor...' : `🚀 Tur ${roundData.currentRound + 1} Eşleşmelerini Başlat`}
                    </button>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                      Katılımcılar otomatik olarak yeni eşleşmelerini görecek
                    </p>
                  </div>
                )}

                {/* Devam ederken uyarı */}
                {!roundData.allCompleted && (
                  <div style={{
                    background: '#fffbeb', borderRadius: '8px', padding: '12px 16px',
                    fontSize: '13px', color: '#92400e', border: '1px solid #fde68a'
                  }}>
                    ⏱️ {roundData.totalMatches - roundData.completedMatches} görüşme devam ediyor. Tüm görüşmeler
                    bittiğinde yeni tur başlatabilirsiniz. Bu sayfa otomatik güncelleniyor.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Stat Box Component
function StatBox({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '14px',
      background: '#f8fafc', borderRadius: '10px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</div>
    </div>
  );
}

// Styles
const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #e2e8f0', fontSize: '14px',
  outline: 'none', width: '100%', boxSizing: 'border-box'
};

const btnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: '8px',
  border: 'none', fontSize: '14px', fontWeight: '600',
  cursor: 'pointer', transition: 'opacity 0.2s'
};
