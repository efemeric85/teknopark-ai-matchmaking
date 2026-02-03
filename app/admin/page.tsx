'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Event { id: string; name: string; date: string; duration: number; round_duration_sec?: number; status: string; created_at?: string; }
interface User { id: string; full_name: string; company: string; position: string; email: string; event_id: string; current_intent?: string; }
interface Match { id: string; event_id: string; user1_id: string; user2_id: string; round_number: number; status: string; started_at: string | null; table_number?: number; icebreaker_question?: string; }

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [sel, setSel] = useState<Event | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null);
  const [tick, setTick] = useState(0);

  // New event form
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState(360);

  // Live tick
  useEffect(() => { const t = setInterval(() => setTick(p => p + 1), 1000); return () => clearInterval(t); }, []);

  const flash = (text: string, type: 'ok' | 'err' | 'info') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 6000); };

  // Data loaders
  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) setEvents(data);
  }, []);

  const loadUsers = useCallback(async (eid: string) => {
    const { data } = await supabase.from('users').select('*').eq('event_id', eid).order('created_at', { ascending: true });
    if (data) setUsers(data);
  }, []);

  const loadMatches = useCallback(async (eid: string) => {
    const { data } = await supabase.from('matches').select('*').eq('event_id', eid).order('round_number', { ascending: false });
    if (data) setMatches(data);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    if (!sel) return;
    loadUsers(sel.id); loadMatches(sel.id);
    const iv = setInterval(() => { loadUsers(sel.id); loadMatches(sel.id); }, 5000);
    return () => clearInterval(iv);
  }, [sel, loadUsers, loadMatches]);

  const u = (id: string) => users.find(p => p.id === id);
  const getDuration = () => sel?.round_duration_sec || sel?.duration || 360;

  // CRUD operations
  const createEvent = async () => {
    if (!newName.trim()) return flash('Etkinlik adı gerekli.', 'err');
    setLoading('create');
    const { error } = await supabase.from('events').insert({
      name: newName.trim(),
      date: newDate || new Date().toISOString().split('T')[0],
      duration: newDuration,
      round_duration_sec: newDuration,
      status: 'active', // ALWAYS ACTIVE
    });
    if (error) flash('Hata: ' + error.message, 'err');
    else { flash('Etkinlik oluşturuldu.', 'ok'); setNewName(''); setNewDate(''); setNewDuration(360); loadEvents(); }
    setLoading(null);
  };

  const toggleEventStatus = async (ev: Event) => {
    const newStatus = ev.status === 'active' ? 'draft' : 'active';
    await supabase.from('events').update({ status: newStatus }).eq('id', ev.id);
    loadEvents();
    if (sel?.id === ev.id) setSel({ ...sel, status: newStatus });
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Etkinliği ve tüm verilerini silmek istediğinize emin misiniz?')) return;
    await supabase.from('matches').delete().eq('event_id', id);
    await supabase.from('users').delete().eq('event_id', id);
    await supabase.from('events').delete().eq('id', id);
    if (sel?.id === id) { setSel(null); setUsers([]); setMatches([]); }
    loadEvents();
    flash('Etkinlik silindi.', 'ok');
  };

  // Match operations
  const doMatch = async () => {
    if (!sel) return;
    setLoading('match');
    try {
      const res = await fetch(`/api/events/${sel.id}/match`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) flash(data.error || 'Eşleştirme hatası.', 'err');
      else flash(data.message || 'Eşleştirme tamamlandı.', 'ok');
      loadMatches(sel.id);
    } catch (e: any) { flash(e.message, 'err'); }
    setLoading(null);
  };

  const resetMatches = async () => {
    if (!sel || !confirm('Tüm eşleşmeleri sıfırlamak istediğinize emin misiniz?')) return;
    setLoading('reset');
    try {
      const res = await fetch(`/api/events/${sel.id}/match`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) flash('Tüm eşleşmeler sıfırlandı.', 'ok');
      else flash(data.error || 'Sıfırlama hatası.', 'err');
      loadMatches(sel.id);
    } catch (e: any) { flash(e.message, 'err'); }
    setLoading(null);
  };

  const handleManualStart = async (matchId: string) => {
    await supabase.from('matches')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', matchId).eq('status', 'pending');
    if (sel) loadMatches(sel.id);
  };

  // Timer helpers
  const calcRemaining = (m: Match): number => {
    if (!m.started_at) return getDuration();
    const elapsed = (Date.now() - new Date(m.started_at).getTime()) / 1000;
    return Math.max(0, Math.ceil(getDuration() - elapsed));
  };

  const fmtTimer = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerColor = (s: number) => s <= 30 ? '#ef4444' : s <= 60 ? '#f59e0b' : '#10b981';
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  // Stats
  const currentRound = matches.length > 0 ? matches[0].round_number : 0;
  const currentRoundMatches = matches.filter(m => m.round_number === currentRound);
  const pendingCount = currentRoundMatches.filter(m => m.status === 'pending').length;
  const activeCount = currentRoundMatches.filter(m => m.status === 'active').length;
  const completedCount = currentRoundMatches.filter(m => m.status === 'completed').length;
  const matchedUserIds = new Set(currentRoundMatches.flatMap(m => [m.user1_id, m.user2_id]));
  const unmatchedCount = users.filter(u => !matchedUserIds.has(u.id)).length;

  // Matrix builder
  const buildMatrix = () => {
    const mx: Record<string, Record<string, { round: number; status: string }>> = {};
    matches.forEach(m => {
      if (!mx[m.user1_id]) mx[m.user1_id] = {};
      if (!mx[m.user2_id]) mx[m.user2_id] = {};
      mx[m.user1_id][m.user2_id] = { round: m.round_number, status: m.status };
      mx[m.user2_id][m.user1_id] = { round: m.round_number, status: m.status };
    });
    return mx;
  };

  // Past rounds
  const pastRounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => b - a).filter(r => r < currentRound);

  // Styles
  const C: React.CSSProperties = { background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '16px', border: '1px solid #e2e8f0' };
  const T: React.CSSProperties = { fontSize: '15px', fontWeight: 600, color: '#334155', margin: '0 0 12px' };
  const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const btnPrimary: React.CSSProperties = { padding: '10px 20px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: '#06b6d4', color: '#fff' };
  const btnDanger: React.CSSProperties = { background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#dc2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
  const btnSmall: React.CSSProperties = { padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#dbeafe', color: '#1d4ed8' };

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 2px' }}>TEKNOPARK ANKARA</p>
          <h1 style={{ color: '#0f172a', fontSize: '20px', fontWeight: 700, margin: 0 }}>🛠️ Admin Paneli</h1>
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 500,
            background: msg.type === 'ok' ? '#dcfce7' : msg.type === 'err' ? '#fee2e2' : '#dbeafe',
            color: msg.type === 'ok' ? '#166534' : msg.type === 'err' ? '#991b1b' : '#1e40af',
            border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : msg.type === 'err' ? '#fecaca' : '#bfdbfe'}`,
          }}>
            {msg.text}
          </div>
        )}

        {/* New Event */}
        <div style={C}>
          <h3 style={T}>Yeni Etkinlik</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input placeholder="Etkinlik adı" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Süre (saniye)" value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value) || 360)} style={inputStyle} />
            <button onClick={createEvent} disabled={loading === 'create' || !newName.trim()} style={{ ...btnPrimary, opacity: loading === 'create' || !newName.trim() ? 0.5 : 1 }}>
              {loading === 'create' ? '⏳...' : '➕ Oluştur'}
            </button>
          </div>
        </div>

        {/* Event List */}
        <div style={C}>
          <h3 style={T}>Etkinlikler</h3>
          {events.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Henüz etkinlik yok.</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {events.map(ev => (
                <div key={ev.id} onClick={() => setSel(ev)} style={{
                  padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                  border: sel?.id === ev.id ? '2px solid #06b6d4' : '1px solid #e2e8f0',
                  background: sel?.id === ev.id ? '#f0fdfa' : '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{ev.name}</span>
                    {ev.date && <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '8px' }}>{fmtDate(ev.date)}</span>}
                    <span style={{
                      marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                      background: ev.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color: ev.status === 'active' ? '#166534' : '#991b1b',
                    }}>{ev.status === 'active' ? 'Yayında' : 'Taslak'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={(e) => { e.stopPropagation(); toggleEventStatus(ev); }} style={{ ...btnSmall, background: ev.status === 'active' ? '#fef3c7' : '#dcfce7', color: ev.status === 'active' ? '#92400e' : '#166534' }}>
                      {ev.status === 'active' ? '⏸' : '▶'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }} style={{ ...btnSmall, background: '#fee2e2', color: '#dc2626' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Event Details */}
        {sel && (
          <>
            {/* Participants */}
            <div style={C}>
              <h3 style={T}>👥 Katılımcılar ({users.length})</h3>
              {users.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Henüz katılımcı yok.</p>
              ) : (
                <div style={{ display: 'grid', gap: '6px' }}>
                  {users.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{p.full_name}</span>
                        <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>{p.company}</span>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{p.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Match Controls */}
            <div style={C}>
              <h3 style={T}>🎯 Eşleştirme Yönetimi</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={doMatch} disabled={loading === 'match'} style={{ ...btnPrimary, opacity: loading === 'match' ? 0.5 : 1 }}>
                  {loading === 'match' ? '⏳...' : currentRound === 0 ? '🎯 Eşleştir' : '➡️ Sonraki Tur'}
                </button>
                <button onClick={resetMatches} disabled={loading === 'reset'} style={{ ...btnDanger, padding: '10px 16px', fontSize: '13px' }}>
                  {loading === 'reset' ? '⏳...' : '🔄 Tümünü Sıfırla'}
                </button>
              </div>
            </div>

            {/* Current Round Stats */}
            {currentRound > 0 && (
              <div style={C}>
                <h3 style={T}>📊 Tur {currentRound} İstatistikleri</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <StatBox label="Bekleyen" value={pendingCount} color="#3b82f6" icon="📱" />
                  <StatBox label="Aktif" value={activeCount} color="#10b981" icon="⏱" />
                  <StatBox label="Tamamlanan" value={completedCount} color="#6b7280" icon="✅" />
                  <StatBox label="Eşleşmemiş" value={unmatchedCount} color="#f59e0b" icon="⏳" />
                </div>

                {/* Current round matches */}
                <div style={{ display: 'grid', gap: '8px' }}>
                  {currentRoundMatches.map(m => {
                    const u1 = u(m.user1_id);
                    const u2 = u(m.user2_id);
                    const remaining = m.status === 'active' ? calcRemaining(m) : 0;

                    return (
                      <div key={m.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderRadius: '10px', background: '#f8fafc',
                        borderLeft: `4px solid ${m.status === 'active' ? '#10b981' : m.status === 'pending' ? '#3b82f6' : '#d1d5db'}`,
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                            Tur {m.round_number} · Masa {m.table_number || 1}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>
                            {u1?.full_name || '?'} ↔ {u2?.full_name || '?'}
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
                            <div style={{ fontSize: '20px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: timerColor(remaining) }}>
                              {remaining > 0 ? fmtTimer(remaining) : '⏰ Süre Doldu'}
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

                {/* Unmatched warning */}
                {unmatchedCount > 0 && (
                  <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fde68a' }}>
                    <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
                      ⚠️ {users.filter(u2 => !matchedUserIds.has(u2.id)).map(u2 => u2.full_name).join(', ')} bu turda eşleşmedi (tek sayı katılımcı).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Match Matrix */}
            {matches.length > 0 && users.length > 1 && (
              <div style={C}>
                <h3 style={T}>🔢 Eşleşme Matrisi</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}></th>
                        {users.map(p => (
                          <th key={p.id} style={{ padding: '6px', borderBottom: '2px solid #e2e8f0', textAlign: 'center', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {p.full_name.split(' ')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const mx = buildMatrix();
                        return users.map(row => (
                          <tr key={row.id}>
                            <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                              {row.full_name.split(' ')[0]}
                            </td>
                            {users.map(col => {
                              if (row.id === col.id) return <td key={col.id} style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', background: '#f1f5f9' }}>·</td>;
                              const info = mx[row.id]?.[col.id];
                              return (
                                <td key={col.id} style={{
                                  padding: '6px', borderBottom: '1px solid #f1f5f9', textAlign: 'center',
                                  background: info ? (info.status === 'completed' ? '#dcfce7' : info.status === 'active' ? '#dbeafe' : '#fef3c7') : '#fff',
                                  fontWeight: info ? 600 : 400,
                                  color: info ? '#334155' : '#d1d5db',
                                }}>
                                  {info ? `T${info.round}` : '·'}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Past Rounds */}
            {pastRounds.length > 0 && (
              <div style={C}>
                <h3 style={T}>📜 Geçmiş Turlar</h3>
                {pastRounds.map(r => {
                  const roundMatches = matches.filter(m => m.round_number === r);
                  return (
                    <div key={r} style={{ marginBottom: '10px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Tur {r}</p>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        {roundMatches.map(m => {
                          const u1 = u(m.user1_id);
                          const u2 = u(m.user2_id);
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: '#f8fafc', fontSize: '12px' }}>
                              <span style={{ color: '#334155' }}>{u1?.full_name || '?'} ↔ {u2?.full_name || '?'}</span>
                              <span style={{ color: '#10b981', fontSize: '11px' }}>✅</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '24px' }}>
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
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</div>
    </div>
  );
}
