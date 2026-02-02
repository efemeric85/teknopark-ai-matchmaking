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
  date: string | null;
  round_duration_sec: number;
  status: string;
  created_at: string;
}
interface User {
  id: string;
  full_name: string;
  company: string;
  position: string;
  email: string;
  event_id: string;
  current_intent: string;
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
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [sel, setSel] = useState<Event | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null);
  const [tick, setTick] = useState(0);

  // Form
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState(360);

  // Timer tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // ─── Data loaders ───
  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) {
      setEvents(data);
      if (sel) {
        const updated = data.find((e: Event) => e.id === sel.id);
        if (updated) setSel(updated);
      }
    }
  }, [sel]);

  const loadUsers = useCallback(async (eid: string) => {
    const { data } = await supabase.from('users').select('*').eq('event_id', eid).order('created_at');
    if (data) setUsers(data);
  }, []);

  const loadMatches = useCallback(async (eid: string) => {
    const { data } = await supabase.from('matches').select('*').eq('event_id', eid).order('round_number').order('table_number');
    if (!data) return;

    // Auto-complete expired
    const dur = sel?.round_duration_sec || 360;
    for (const m of data) {
      if (m.status === 'active' && m.started_at) {
        const elapsed = (Date.now() - new Date(m.started_at).getTime()) / 1000;
        if (elapsed > dur) {
          await supabase.from('matches').update({ status: 'completed' }).eq('id', m.id);
          m.status = 'completed';
        }
      }
    }
    setMatches(data);
  }, [sel]);

  // Initial + polling
  useEffect(() => { loadEvents(); }, []);
  useEffect(() => {
    if (sel) { loadUsers(sel.id); loadMatches(sel.id); }
  }, [sel?.id]);
  useEffect(() => {
    const iv = setInterval(() => {
      loadEvents();
      if (sel) { loadUsers(sel.id); loadMatches(sel.id); }
    }, 5000);
    return () => clearInterval(iv);
  }, [sel]);

  const showMsg = (text: string, type: 'ok' | 'err' | 'info' = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  // ─── User lookup ───
  const getUser = (id: string): User | undefined => users.find(u => u.id === id);

  // ─── Actions ───
  const createEvent = async () => {
    if (!newName.trim()) return;
    setLoading('create');
    await supabase.from('events').insert({
      name: newName.trim(),
      date: newDate || null,
      round_duration_sec: newDuration || 360,
      status: 'draft',
    });
    setNewName(''); setNewDate(''); setNewDuration(360);
    await loadEvents();
    setLoading('');
    showMsg('Etkinlik oluşturuldu.', 'ok');
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Bu etkinliği ve tüm verilerini silmek istediğinize emin misiniz?')) return;
    await supabase.from('matches').delete().eq('event_id', id);
    await supabase.from('users').delete().eq('event_id', id);
    await supabase.from('events').delete().eq('id', id);
    if (sel?.id === id) { setSel(null); setUsers([]); setMatches([]); }
    await loadEvents();
    showMsg('Etkinlik silindi.', 'ok');
  };

  const toggleStatus = async (ev: Event) => {
    const newStatus = ev.status === 'active' ? 'draft' : 'active';
    await supabase.from('events').update({ status: newStatus }).eq('id', ev.id);
    await loadEvents();
    showMsg(newStatus === 'active' ? 'Etkinlik yayınlandı.' : 'Etkinlik taslağa alındı.', 'ok');
  };

  const handleMatch = async () => {
    if (!sel) return;
    setLoading('match');
    try {
      const res = await fetch(`/api/events/${sel.id}/match`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error || 'Eşleştirme hatası.', 'err'); }
      else { showMsg(data.message || `${data.matchCount} eşleşme oluşturuldu.`, 'ok'); }
    } catch (e: any) { showMsg(e.message, 'err'); }
    await loadMatches(sel.id);
    setLoading('');
  };

  const handleReset = async () => {
    if (!sel) return;
    if (!confirm('Tüm eşleşmeleri sıfırlamak istediğinize emin misiniz?')) return;
    setLoading('reset');
    await fetch(`/api/events/${sel.id}/match`, { method: 'DELETE' });
    await loadMatches(sel.id);
    setLoading('');
    showMsg('Tüm eşleşmeler sıfırlandı.', 'ok');
  };

  const manualStart = async (matchId: string) => {
    await supabase.from('matches').update({
      status: 'active',
      started_at: new Date().toISOString(),
    }).eq('id', matchId).eq('status', 'pending');
    if (sel) await loadMatches(sel.id);
    showMsg('Eşleşme manuel başlatıldı.', 'ok');
  };

  // ─── Derived state ───
  const curRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number || 1)) : 0;
  const curMatches = matches.filter(m => (m.round_number || 1) === curRound);
  const activeC = curMatches.filter(m => m.status === 'active').length;
  const pendingC = curMatches.filter(m => m.status === 'pending').length;
  const completedC = curMatches.filter(m => m.status === 'completed').length;
  const allDone = curMatches.length > 0 && activeC === 0 && pendingC === 0;

  const matchedIds = new Set<string>();
  curMatches.forEach(m => { matchedIds.add(m.user1_id); matchedIds.add(m.user2_id); });
  const unmatchedUsers = curRound > 0 ? users.filter(p => !matchedIds.has(p.id)) : [];

  // Timer helpers
  const getTimeLeft = (m: Match): number | null => {
    if (m.status !== 'active' || !m.started_at || !sel) return null;
    return Math.max((sel.round_duration_sec || 360) - Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000), 0);
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const tc = (s: number) => s <= 30 ? '#ef4444' : s <= 60 ? '#f59e0b' : '#10b981';
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  // Eşleşme Matrisi
  const buildMatrix = () => {
    const mx: Record<string, Record<string, { round: number; status: string; dur: number }>> = {};
    matches.forEach(m => {
      if (!mx[m.user1_id]) mx[m.user1_id] = {};
      if (!mx[m.user2_id]) mx[m.user2_id] = {};
      const dur = m.started_at
        ? Math.min(Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000), sel?.round_duration_sec || 360)
        : 0;
      const info = { round: m.round_number, status: m.status, dur };
      mx[m.user1_id][m.user2_id] = info;
      mx[m.user2_id][m.user1_id] = info;
    });
    return mx;
  };

  // ─── Render ───
  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 2px' }}>TEKNOPARK ANKARA</p>
          <h1 style={{ color: '#0f172a', fontSize: '20px', fontWeight: '700', margin: '0' }}>🛠️ Admin Paneli</h1>
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: '500',
            background: msg.type === 'ok' ? '#dcfce7' : msg.type === 'err' ? '#fee2e2' : '#dbeafe',
            color: msg.type === 'ok' ? '#166534' : msg.type === 'err' ? '#991b1b' : '#1e40af',
            border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : msg.type === 'err' ? '#fecaca' : '#bfdbfe'}`,
          }}>
            {msg.text}
          </div>
        )}

        {/* ═══ Yeni Etkinlik ═══ */}
        <div style={C}>
          <h3 style={T}>Yeni Etkinlik</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input placeholder="Etkinlik adı" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Süre (saniye)" value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value) || 360)} style={inputStyle} />
            <button onClick={createEvent} disabled={loading === 'create' || !newName.trim()} style={{ ...btnPrimary, opacity: loading === 'create' || !newName.trim() ? 0.5 : 1 }}>
              + Etkinlik Oluştur
            </button>
          </div>
        </div>

        {/* ═══ Etkinlikler ═══ */}
        <div style={C}>
          <h3 style={T}>Etkinlikler</h3>
          {events.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>Henüz etkinlik yok.</p>}
          {events.map(ev => (
            <div
              key={ev.id}
              onClick={() => setSel(ev)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer',
                border: sel?.id === ev.id ? '2px solid #06b6d4' : '1px solid #e2e8f0',
                background: sel?.id === ev.id ? '#f0fdfa' : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{ev.name}</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '2px', fontSize: '11px', color: '#64748b' }}>
                  {ev.date && <span>📅 {fmtDate(ev.date)}</span>}
                  <span>⏱ {ev.round_duration_sec || 360}s</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                  background: ev.status === 'active' ? '#d1fae5' : '#f1f5f9',
                  color: ev.status === 'active' ? '#065f46' : '#64748b',
                }}>
                  {ev.status === 'active' ? '✓ Aktif' : 'Taslak'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStatus(ev); }}
                  style={{
                    padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid', borderColor: ev.status === 'active' ? '#fca5a5' : '#86efac',
                    background: ev.status === 'active' ? '#fef2f2' : '#f0fdf4',
                    color: ev.status === 'active' ? '#991b1b' : '#166534',
                  }}
                >
                  {ev.status === 'active' ? '⏸ Taslağa Al' : '▶ Yayınla'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ Seçili Etkinlik Detayları ═══ */}
        {sel && (
          <>
            {/* Katılımcılar */}
            <div style={C}>
              <h3 style={T}>👥 Katılımcılar ({users.length})</h3>
              {users.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>Henüz katılımcı yok.</p>
              ) : (
                <div style={{ display: 'grid', gap: '6px' }}>
                  {users.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                        <span style={{ color: '#64748b', marginLeft: '6px' }}>{p.company}</span>
                        {p.position && <span style={{ color: '#94a3b8', marginLeft: '4px' }}>· {p.position}</span>}
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{p.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* İstatistikler */}
            {curRound > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <StatBox icon="📋" label="Bekleyen" value={pendingC} color="#3b82f6" />
                <StatBox icon="▶️" label="Aktif" value={activeC} color="#10b981" />
                <StatBox icon="✅" label="Tamamlanan" value={completedC} color="#8b5cf6" />
                <StatBox icon="👤" label="Eşleşmemiş" value={unmatchedUsers.length} color="#f59e0b" />
              </div>
            )}

            {/* Eşleşme Yönetimi */}
            <div style={C}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ ...T, margin: 0 }}>🏆 Tur {curRound || 0}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(matches.length === 0 || allDone) && users.length >= 2 && (
                    <button onClick={handleMatch} disabled={loading === 'match'} style={btnPrimary}>
                      {loading === 'match' ? '...' : matches.length === 0 ? '🎯 Eşleştir' : '➡️ Sonraki Tur'}
                    </button>
                  )}
                  {matches.length > 0 && (
                    <button onClick={handleReset} disabled={loading === 'reset'} style={btnDanger}>
                      {loading === 'reset' ? '...' : '🔄 Tümünü Sıfırla'}
                    </button>
                  )}
                </div>
              </div>

              {curMatches.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>
                  {users.length < 2 ? 'En az 2 katılımcı gerekli.' : 'Henüz eşleşme yok. "Eşleştir" butonuna basın.'}
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {curMatches.map(m => {
                    const u1 = getUser(m.user1_id);
                    const u2 = getUser(m.user2_id);
                    const timeLeft = getTimeLeft(m);

                    return (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: '10px',
                        background: m.status === 'active' ? '#f0fdf4' : m.status === 'pending' ? '#eff6ff' : '#f8fafc',
                        border: `1px solid ${m.status === 'active' ? '#bbf7d0' : m.status === 'pending' ? '#bfdbfe' : '#e2e8f0'}`,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
                            Tur {m.round_number} · Masa {m.table_number}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>
                            {u1?.full_name || '?'} <span style={{ color: '#94a3b8' }}>↔</span> {u2?.full_name || '?'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                            {u1?.company || ''} · {u2?.company || ''}
                          </div>
                          {m.icebreaker_question && (
                            <div style={{ fontSize: '10px', color: '#0891b2', marginTop: '3px' }}>💬 {m.icebreaker_question}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '100px' }}>
                          {m.status === 'pending' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              <span style={{ fontSize: '11px', color: '#3b82f6' }}>📱 QR Bekliyor</span>
                              <button onClick={() => manualStart(m.id)} style={{
                                padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0',
                                background: '#fff', color: '#334155', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                              }}>Manuel Başlat</button>
                            </div>
                          )}
                          {m.status === 'active' && timeLeft !== null && (
                            <div style={{
                              fontSize: '24px', fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: tc(timeLeft),
                            }}>
                              {fmt(timeLeft)}
                            </div>
                          )}
                          {m.status === 'completed' && (
                            <span style={{ color: '#10b981', fontSize: '11px' }}>✅ Tamamlandı</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Eşleşmemiş kişiler */}
              {unmatchedUsers.length > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>⚠️ Eşleşmemiş ({unmatchedUsers.length})</div>
                  {unmatchedUsers.map(p => (
                    <div key={p.id} style={{ fontSize: '11px', color: '#a16207' }}>{p.full_name} ({p.company})</div>
                  ))}
                </div>
              )}

              {/* Tüm turlar tamamlandı mesajı */}
              {allDone && (
                <div style={{ marginTop: '12px', padding: '10px', background: '#dcfce7', borderRadius: '8px', textAlign: 'center', fontSize: '13px', color: '#166534' }}>
                  ✅ Tüm görüşmeler tamamlandı! "Sonraki Tur" ile devam edebilirsiniz.
                </div>
              )}
            </div>

            {/* Geçmiş Turlar */}
            {curRound > 1 && (
              <div style={C}>
                <h3 style={T}>📜 Geçmiş Turlar</h3>
                {Array.from({ length: curRound - 1 }, (_, i) => curRound - 1 - i).map(rnd => {
                  const rndMatches = matches.filter(m => m.round_number === rnd);
                  return (
                    <div key={rnd} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Tur {rnd}</div>
                      {rndMatches.map(m => {
                        const u1 = getUser(m.user1_id);
                        const u2 = getUser(m.user2_id);
                        return (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: '11px', color: '#64748b' }}>
                            <span>{u1?.full_name || '?'} ↔ {u2?.full_name || '?'}</span>
                            <span style={{ color: '#10b981' }}>✅</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ EŞLEŞME MATRİSİ ═══ */}
            {matches.length > 0 && users.length > 0 && (
              <div style={C}>
                <h3 style={T}>📊 Eşleşme Matrisi</h3>
                <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 10px' }}>Kimin kiminle hangi turda görüştüğü</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th style={th}></th>
                        {users.map(p => (
                          <th key={p.id} style={{ ...th, writingMode: 'vertical-lr' as any, transform: 'rotate(180deg)', maxWidth: '30px', padding: '8px 4px' }}>
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
                            <td style={{ ...td, fontWeight: '600', whiteSpace: 'nowrap' as any, background: '#f8fafc' }}>
                              {row.full_name.split(' ')[0]}
                            </td>
                            {users.map(col => {
                              if (row.id === col.id) return <td key={col.id} style={{ ...td, background: '#e2e8f0' }}>—</td>;
                              const info = mx[row.id]?.[col.id];
                              if (!info) return <td key={col.id} style={{ ...td, color: '#cbd5e1' }}>✗</td>;
                              const bg = info.status === 'active' ? '#dbeafe' : info.status === 'pending' ? '#fef3c7' : '#dcfce7';
                              const clr = info.status === 'active' ? '#1d4ed8' : info.status === 'pending' ? '#92400e' : '#166534';
                              return (
                                <td key={col.id} style={{ ...td, background: bg, color: clr, fontWeight: 600 }}>
                                  T{info.round}
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

            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '12px' }}>
              Bu sayfa 5 saniyede bir otomatik güncelleniyor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Components ───
function StatBox({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</div>
    </div>
  );
}

// ─── Styles ───
const C: React.CSSProperties = { background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '16px', border: '1px solid #e2e8f0' };
const T: React.CSSProperties = { fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 12px' };
const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const };
const btnPrimary: React.CSSProperties = { padding: '10px 20px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', background: '#06b6d4', color: '#fff' };
const btnDanger: React.CSSProperties = { background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };
const th: React.CSSProperties = { padding: '6px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '11px', color: '#64748b' };
const td: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '11px' };
