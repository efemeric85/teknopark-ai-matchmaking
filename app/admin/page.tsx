'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Event {
  id: string;
  name: string;
  date: string | null;
  round_duration_sec: number;
  status: string;
  theme?: string;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  company: string;
  position: string;
  current_intent: string;
  event_id: string;
}

interface Match {
  id: string;
  event_id: string;
  user1_id: string;
  user2_id: string;
  round_number: number;
  table_number: number;
  icebreaker_question: string;
  status: string;
  started_at: string | null;
  user1?: User;
  user2?: User;
}

function formatDate(d: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newEvent, setNewEvent] = useState({ name: '', date: '', duration: 360 });
  const [loading, setLoading] = useState('');
  const [tick, setTick] = useState(0);

  // ─── Timer tick (every second) ───
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // ─── Fetch events ───
  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) {
      setEvents(data);
      if (selectedEvent) {
        const updated = data.find((e: Event) => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
      }
    }
  }, [selectedEvent]);

  // ─── Fetch participants ───
  const fetchParticipants = useCallback(async () => {
    if (!selectedEvent) return;
    const { data } = await supabase.from('users').select('*').eq('event_id', selectedEvent.id).order('created_at');
    if (data) setParticipants(data);
  }, [selectedEvent]);

  // ─── Fetch matches + enrich with user info ───
  const fetchMatches = useCallback(async () => {
    if (!selectedEvent) return;
    const { data } = await supabase.from('matches').select('*').eq('event_id', selectedEvent.id).order('round_number').order('table_number');
    if (!data) return;

    const userIds = new Set<string>();
    data.forEach((m: any) => { userIds.add(m.user1_id); userIds.add(m.user2_id); });
    const { data: users } = await supabase.from('users').select('*').in('id', Array.from(userIds));
    const userMap: Record<string, User> = {};
    (users || []).forEach((u: User) => { userMap[u.id] = u; });

    // Auto-complete expired
    const duration = selectedEvent.round_duration_sec || 360;
    for (const m of data) {
      if (m.status === 'active' && m.started_at) {
        const elapsed = (Date.now() - new Date(m.started_at).getTime()) / 1000;
        if (elapsed > duration) {
          await supabase.from('matches').update({ status: 'completed' }).eq('id', m.id);
          m.status = 'completed';
        }
      }
    }

    setMatches(data.map((m: any) => ({ ...m, user1: userMap[m.user1_id], user2: userMap[m.user2_id] })));
  }, [selectedEvent]);

  // ─── Initial load + polling ───
  useEffect(() => { fetchEvents(); }, []);

  useEffect(() => {
    if (selectedEvent) { fetchParticipants(); fetchMatches(); }
  }, [selectedEvent?.id]);

  useEffect(() => {
    const iv = setInterval(() => {
      fetchEvents();
      if (selectedEvent) { fetchParticipants(); fetchMatches(); }
    }, 5000);
    return () => clearInterval(iv);
  }, [selectedEvent]);

  // ─── Create event ───
  const handleCreateEvent = async () => {
    if (!newEvent.name.trim()) return;
    setLoading('create');
    await supabase.from('events').insert({
      name: newEvent.name.trim(),
      date: newEvent.date || null,
      round_duration_sec: newEvent.duration || 360,
      status: 'draft',
    });
    setNewEvent({ name: '', date: '', duration: 360 });
    await fetchEvents();
    setLoading('');
  };

  // ─── Delete event ───
  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Bu etkinliği ve tüm eşleşmelerini silmek istediğinize emin misiniz?')) return;
    await supabase.from('matches').delete().eq('event_id', id);
    await supabase.from('users').delete().eq('event_id', id);
    await supabase.from('events').delete().eq('id', id);
    if (selectedEvent?.id === id) { setSelectedEvent(null); setParticipants([]); setMatches([]); }
    await fetchEvents();
  };

  // ─── Toggle status ───
  const handleToggleStatus = async (event: Event) => {
    const newStatus = event.status === 'active' ? 'draft' : 'active';
    await supabase.from('events').update({ status: newStatus }).eq('id', event.id);
    await fetchEvents();
  };

  // ─── Match participants ───
  const handleMatch = async () => {
    if (!selectedEvent) return;
    setLoading('match');
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/match`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Eşleştirme hatası');
    } catch (e: any) { alert(e.message); }
    await fetchMatches();
    setLoading('');
  };

  // ─── Reset all matches ───
  const handleReset = async () => {
    if (!selectedEvent) return;
    if (!confirm('Tüm eşleşmeleri sıfırlamak istediğinize emin misiniz?')) return;
    setLoading('reset');
    await fetch(`/api/events/${selectedEvent.id}/match`, { method: 'DELETE' });
    await fetchMatches();
    setLoading('');
  };

  // ─── Manual start ───
  const handleManualStart = async (matchId: string) => {
    await supabase.from('matches').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', matchId).eq('status', 'pending');
    await fetchMatches();
  };

  // ─── Derived state ───
  const maxRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : 0;
  const currentRoundMatches = matches.filter(m => m.round_number === maxRound);
  const allCurrentDone = currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.status === 'completed');
  const hasActive = currentRoundMatches.some(m => m.status === 'active');
  const hasPending = currentRoundMatches.some(m => m.status === 'pending');

  // ─── Render ───
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '24px 0', textAlign: 'center' }}>
        <p style={{ color: '#06b6d4', fontSize: '12px', letterSpacing: '3px', margin: 0 }}>TEKNOPARK ANKARA</p>
        <h1 style={{ color: '#fff', fontSize: '24px', margin: '4px 0 0' }}>🎯 Admin Paneli</h1>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>

        {/* ═══ Event Creation ═══ */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Yeni Etkinlik</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input
              placeholder="Etkinlik adı"
              value={newEvent.name}
              onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
              style={inputStyle}
            />
            <input
              type="date"
              value={newEvent.date}
              onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="Süre (saniye)"
              value={newEvent.duration}
              onChange={e => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) || 360 })}
              style={inputStyle}
            />
            <button
              onClick={handleCreateEvent}
              disabled={loading === 'create' || !newEvent.name.trim()}
              style={{ ...btnPrimary, opacity: loading === 'create' || !newEvent.name.trim() ? 0.5 : 1 }}
            >
              + Etkinlik Oluştur
            </button>
          </div>
        </div>

        {/* ═══ Event List ═══ */}
        <div style={{ ...cardStyle, marginTop: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Etkinlikler</h2>
          {events.length === 0 && <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz etkinlik yok.</p>}
          {events.map(ev => (
            <div
              key={ev.id}
              onClick={() => setSelectedEvent(ev)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer',
                border: selectedEvent?.id === ev.id ? '2px solid #06b6d4' : '1px solid #e2e8f0',
                background: selectedEvent?.id === ev.id ? '#f0fdfa' : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{ev.name}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px', fontSize: '12px', color: '#64748b' }}>
                    {ev.date && <span>📅 {formatDate(ev.date)}</span>}
                    <span>⏱ {ev.round_duration_sec || 360}s</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                  background: ev.status === 'active' ? '#d1fae5' : '#f1f5f9',
                  color: ev.status === 'active' ? '#065f46' : '#64748b',
                }}>
                  {ev.status === 'active' ? '✓ Aktif' : 'Taslak'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(ev); }}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid',
                    borderColor: ev.status === 'active' ? '#fca5a5' : '#86efac',
                    background: ev.status === 'active' ? '#fef2f2' : '#f0fdf4',
                    color: ev.status === 'active' ? '#991b1b' : '#166534',
                  }}
                  title={ev.status === 'active' ? 'Taslağa al' : 'Yayınla'}
                >
                  {ev.status === 'active' ? '⏸ Taslağa Al' : '▶ Yayınla'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                  title="Sil"
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ Selected Event Detail ═══ */}
        {selectedEvent && (
          <>
            {/* Participants */}
            <div style={{ ...cardStyle, marginTop: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
                👥 Katılımcılar ({participants.length})
              </h2>
              {participants.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz katılımcı yok.</p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {participants.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                        <span style={{ color: '#64748b', marginLeft: '8px' }}>{p.company}</span>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>{p.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Match Management */}
            <div style={{ ...cardStyle, marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🏆 Tur {maxRound || 0}</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {matches.length === 0 && participants.length >= 2 && (
                    <button onClick={handleMatch} disabled={loading === 'match'} style={btnPrimary}>
                      {loading === 'match' ? '...' : '🎯 Eşleştir'}
                    </button>
                  )}
                  {allCurrentDone && participants.length >= 2 && (
                    <button onClick={handleMatch} disabled={loading === 'match'} style={btnPrimary}>
                      {loading === 'match' ? '...' : '➡️ Sonraki Tur'}
                    </button>
                  )}
                  {matches.length > 0 && (
                    <button onClick={handleReset} disabled={loading === 'reset'} style={btnDanger}>
                      {loading === 'reset' ? '...' : '🔄 Tümünü Sıfırla'}
                    </button>
                  )}
                </div>
              </div>

              {matches.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz eşleşme yok. {participants.length < 2 ? 'En az 2 katılımcı gerekli.' : '"Eşleştir" butonuna basın.'}</p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {matches.map(m => {
                    const duration = selectedEvent.round_duration_sec || 360;
                    let remaining = 0;
                    if (m.status === 'active' && m.started_at) {
                      const elapsed = Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000);
                      remaining = Math.max(0, duration - elapsed);
                    }

                    return (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderRadius: '10px',
                        background: m.status === 'active' ? '#f0fdf4' : m.status === 'pending' ? '#eff6ff' : '#f8fafc',
                        border: `1px solid ${m.status === 'active' ? '#bbf7d0' : m.status === 'pending' ? '#bfdbfe' : '#e2e8f0'}`,
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                            Tur {m.round_number} · Masa {m.table_number}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>
                            {m.user1?.full_name || '?'} ↔ {m.user2?.full_name || '?'}
                          </div>
                          {m.icebreaker_question && (
                            <div style={{ fontSize: '11px', color: '#0891b2', marginTop: '2px' }}>💬 {m.icebreaker_question}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {m.status === 'pending' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#3b82f6' }}>📱 QR Bekliyor</span>
                              <button onClick={() => handleManualStart(m.id)} style={btnSmall}>Manuel Başlat</button>
                            </div>
                          )}
                          {m.status === 'active' && (
                            <div style={{ fontSize: '20px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: remaining < 60 ? '#ef4444' : '#16a34a' }}>
                              {formatTimer(remaining)}
                            </div>
                          )}
                          {m.status === 'completed' && (
                            <span style={{ fontSize: '12px', color: '#16a34a' }}>✅ Tamamlandı</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '24px' }}>
          Bu sayfa 5 saniyede bir otomatik güncelleniyor.
        </p>
      </div>
    </div>
  );
}

// ─── Styles ───
const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '20px',
  border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
  fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff',
  fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap',
};

const btnDanger: React.CSSProperties = {
  padding: '10px 20px', borderRadius: '8px', border: '1px solid #fca5a5', cursor: 'pointer',
  background: '#fef2f2', color: '#991b1b', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap',
};

const btnSmall: React.CSSProperties = {
  padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer',
  background: '#fff', color: '#334155', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
};
