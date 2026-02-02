'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Event { id: string; name: string; date: string; duration: number; status: string; }
interface User { id: string; full_name: string; company: string; title: string; email: string; event_id: string; }
interface Match { id: string; event_id: string; user1_id: string; user2_id: string; round_number: number; status: string; started_at: string | null; created_at?: string; }

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [sel, setSel] = useState<Event | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null);
  const [tick, setTick] = useState(0);
  const [evName, setEvName] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evDur, setEvDur] = useState('360');

  useEffect(() => { const t = setInterval(() => setTick(p => p + 1), 1000); return () => clearInterval(t); }, []);

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
  const flash = (text: string, type: 'ok' | 'err' | 'info') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 5000); };

  const createEvent = async () => {
    if (!evName.trim()) return flash('Etkinlik adı gerekli.', 'err');
    const { error } = await supabase.from('events').insert({ name: evName.trim(), date: evDate || new Date().toISOString().split('T')[0], duration: parseInt(evDur) || 360, status: 'draft' });
    if (error) flash('Hata: ' + error.message, 'err');
    else { flash('Etkinlik oluşturuldu.', 'ok'); setEvName(''); setEvDate(''); setEvDur('360'); loadEvents(); }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Etkinliği silmek istediğinize emin misiniz?')) return;
    await supabase.from('matches').delete().eq('event_id', id);
    await supabase.from('users').delete().eq('event_id', id);
    await supabase.from('events').delete().eq('id', id);
    if (sel?.id === id) { setSel(null); setUsers([]); setMatches([]); }
    loadEvents(); flash('Silindi.', 'info');
  };

  const doMatch = async () => {
    if (!sel) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/events/${sel.id}/match`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) flash(d.error || 'Hata', 'err');
      else { flash(d.message, 'ok'); await loadMatches(sel.id); }
    } catch (e: any) { flash(e.message, 'err'); }
    finally { setLoading(false); }
  };

  const resetAll = async () => {
    if (!sel || !confirm('TÜM eşleşmeler silinecek. Emin misiniz?')) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/events/${sel.id}/match`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) flash(d.error, 'err');
      else { flash(d.message, 'ok'); setMatches([]); }
    } catch (e: any) { flash(e.message, 'err'); }
    finally { setLoading(false); }
  };

  // Manuel başlat (admin'den)
  const manualActivate = async (matchId: string) => {
    const { error } = await supabase.from('matches').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', matchId).eq('status', 'pending');
    if (error) flash('Hata: ' + error.message, 'err');
    else { flash('Eşleşme başlatıldı!', 'ok'); if (sel) loadMatches(sel.id); }
  };

  // Hesaplamalar
  const curRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number || 1)) : 0;
  const curMatches = matches.filter(m => (m.round_number || 1) === curRound);
  const activeC = curMatches.filter(m => m.status === 'active').length;
  const pendingC = curMatches.filter(m => m.status === 'pending').length;
  const completedC = curMatches.filter(m => m.status === 'completed').length;

  const matchedIds = new Set<string>();
  curMatches.forEach(m => { matchedIds.add(m.user1_id); matchedIds.add(m.user2_id); });
  const unmatchedUsers = curRound > 0 ? users.filter(p => !matchedIds.has(p.id)) : [];

  const getTimeLeft = (m: Match): number | null => {
    if (m.status !== 'active' || !m.started_at || !sel) return null;
    return Math.max((sel.duration || 360) - Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000), 0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const tc = (s: number) => s <= 30 ? '#ef4444' : s <= 60 ? '#f59e0b' : '#10b981';

  // Eşleşme Matrisi
  const buildMatrix = () => {
    const mx: Record<string, Record<string, { round: number; status: string; dur: number }>> = {};
    matches.forEach(m => {
      if (!mx[m.user1_id]) mx[m.user1_id] = {};
      if (!mx[m.user2_id]) mx[m.user2_id] = {};
      const dur = m.started_at
        ? Math.min(Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000), sel?.duration || 360)
        : 0;
      const info = { round: m.round_number, status: m.status, dur };
      mx[m.user1_id][m.user2_id] = info;
      mx[m.user2_id][m.user1_id] = info;
    });
    return mx;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 2px' }}>TEKNOPARK ANKARA</p>
          <h1 style={{ color: '#0f172a', fontSize: '20px', fontWeight: '700', margin: '0' }}>🛠️ Admin Paneli</h1>
        </div>

        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: '500',
            background: msg.type === 'ok' ? '#dcfce7' : msg.type === 'err' ? '#fee2e2' : '#dbeafe',
            color: msg.type === 'ok' ? '#166534' : msg.type === 'err' ? '#991b1b' : '#1e40af',
          }}>{msg.text}</div>
        )}

        {/* Yeni Etkinlik */}
        <div style={C}>
          <h3 style={T}>Yeni Etkinlik</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input placeholder="Etkinlik adı" value={evName} onChange={e => setEvName(e.target.value)} style={I} />
            <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} style={I} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input type="number" placeholder="Süre (sn)" value={evDur} onChange={e => setEvDur(e.target.value)} style={I} />
            <button onClick={createEvent} style={BP}>+ Etkinlik Oluştur</button>
          </div>
        </div>

        {/* Etkinlikler */}
        <div style={C}>
          <h3 style={T}>Etkinlikler</h3>
          {events.map(ev => (
            <div key={ev.id} onClick={() => setSel(ev)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer',
              border: sel?.id === ev.id ? '2px solid #06b6d4' : '1px solid #e2e8f0',
              background: sel?.id === ev.id ? '#f0fdfa' : '#fff',
            }}>
              <div>
                <span style={{ fontWeight: '600', fontSize: '13px' }}>{ev.name}</span>
                <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '8px' }}>{ev.duration}s &bull; {ev.status}</span>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id); }} style={BD}>🗑️</button>
            </div>
          ))}
        </div>

        {sel && (
          <>
            {/* Katılımcılar */}
            <div style={C}>
              <h3 style={T}>👥 Katılımcılar ({users.length})</h3>
              {users.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                  <div><b>{p.full_name}</b> <span style={{ color: '#94a3b8', fontSize: '11px' }}>{p.company}</span></div>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>{p.email}</span>
                </div>
              ))}
            </div>

            {/* Tur Kontrol */}
            <div style={C}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ ...T, margin: '0' }}>🏆 Tur {curRound || 0}</h3>
                {curRound > 0 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {pendingC > 0 && <span style={{ ...badge, background: '#fef3c7', color: '#92400e' }}>📱 {pendingC} QR bekliyor</span>}
                    {activeC > 0 && <span style={{ ...badge, background: '#dbeafe', color: '#1d4ed8' }}>⏱️ {activeC} aktif</span>}
                    {completedC > 0 && <span style={{ ...badge, background: '#dcfce7', color: '#166534' }}>✅ {completedC} bitti</span>}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {users.length >= 2 && (
                  <button onClick={doMatch} disabled={loading} style={{ ...BP, opacity: loading ? 0.6 : 1 }}>
                    {loading ? '⏳...' : curRound === 0 ? '🚀 Eşleştir' : '🔄 Yeni Tur'}
                  </button>
                )}
                {curRound > 0 && (
                  <button onClick={resetAll} disabled={loading} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    🗑️ Tümünü Sıfırla
                  </button>
                )}
              </div>
            </div>

            {/* Eşleşme Kartları */}
            {curMatches.length > 0 && (
              <div style={C}>
                <h3 style={T}>Eşleşmeler (Tur {curRound})</h3>
                {curMatches.map(m => {
                  const u1 = u(m.user1_id);
                  const u2 = u(m.user2_id);
                  const tl = getTimeLeft(m);
                  const dur = sel.duration || 360;
                  const isPend = m.status === 'pending';
                  const isAct = m.status === 'active';
                  const isDone = m.status === 'completed';
                  const isExp = isAct && tl !== null && tl <= 0;

                  return (
                    <div key={m.id} style={{
                      padding: '14px', borderRadius: '10px', marginBottom: '8px',
                      background: isPend ? '#fffbeb' : isAct ? (isExp ? '#fef2f2' : '#f0fdfa') : '#f8fafc',
                      border: `1px solid ${isPend ? '#fde68a' : isAct ? (isExp ? '#fecaca' : '#99f6e4') : '#e2e8f0'}`,
                    }}>
                      {/* İsimler + Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (isPend || isAct) ? '10px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={nameBox}>{u1?.full_name || '?'} <span style={{ color: '#94a3b8', fontSize: '10px', marginLeft: '4px' }}>{u1?.company || ''}</span></span>
                          <span style={{ color: '#94a3b8' }}>↔</span>
                          <span style={nameBox}>{u2?.full_name || '?'} <span style={{ color: '#94a3b8', fontSize: '10px', marginLeft: '4px' }}>{u2?.company || ''}</span></span>
                        </div>
                        <span style={{
                          ...badge, marginLeft: '8px',
                          background: isDone ? '#dcfce7' : isExp ? '#fee2e2' : isAct ? '#dbeafe' : '#fef3c7',
                          color: isDone ? '#166534' : isExp ? '#991b1b' : isAct ? '#1d4ed8' : '#92400e',
                        }}>
                          {isDone ? '✅ Bitti' : isExp ? '⏰ Süre Doldu' : isAct ? '⏱️ Aktif' : '📱 QR Bekliyor'}
                        </span>
                      </div>

                      {/* Pending: Manuel başlat butonu */}
                      {isPend && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: '8px', padding: '8px 12px', border: '1px solid #fde68a' }}>
                          <span style={{ color: '#92400e', fontSize: '12px' }}>Katılımcılar QR okutmayı bekliyor</span>
                          <button onClick={() => manualActivate(m.id)} style={{
                            padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#06b6d4', color: '#fff',
                            fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                          }}>▶️ Manuel Başlat</button>
                        </div>
                      )}

                      {/* Active: Canlı timer */}
                      {isAct && tl !== null && !isExp && (
                        <div style={{ background: '#fff', borderRadius: '8px', padding: '8px 14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>Kalan süre:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '800', color: tc(tl), fontFamily: "'JetBrains Mono', monospace" }}>{fmt(tl)}</span>
                            <div style={{ width: '60px', height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${(tl / dur) * 100}%`, height: '100%', background: tc(tl), borderRadius: '3px', transition: 'width 1s linear' }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expired */}
                      {isAct && isExp && (
                        <div style={{ background: '#fff', borderRadius: '8px', padding: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
                          <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>⏰ Süre doldu!</span>
                        </div>
                      )}

                      {/* Completed: duration */}
                      {isDone && m.started_at && (
                        <div style={{ marginTop: '6px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                            Görüşme süresi: {fmt(Math.min(Math.floor((new Date(m.started_at).getTime() + (dur * 1000) - new Date(m.started_at).getTime()) / 1000), dur))}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Beklemede */}
                {unmatchedUsers.length > 0 && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', marginTop: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>⏳ Beklemede ({unmatchedUsers.length})</div>
                    {unmatchedUsers.map(p => (
                      <div key={p.id} style={{ fontSize: '12px', color: '#a16207' }}>{p.full_name} ({p.company})</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* EŞLEŞME MATRİSİ */}
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
                            <td style={{ ...td, fontWeight: '600', whiteSpace: 'nowrap' as any, background: '#f8fafc' }}>{row.full_name.split(' ')[0]}</td>
                            {users.map(col => {
                              if (row.id === col.id) return <td key={col.id} style={{ ...td, background: '#e2e8f0' }}>—</td>;
                              const info = mx[row.id]?.[col.id];
                              if (!info) return <td key={col.id} style={{ ...td, color: '#cbd5e1' }}>✗</td>;
                              const bg = info.status === 'active' ? '#dbeafe' : info.status === 'pending' ? '#fef3c7' : '#dcfce7';
                              const clr = info.status === 'active' ? '#1d4ed8' : info.status === 'pending' ? '#92400e' : '#166534';
                              return (
                                <td key={col.id} style={{ ...td, background: bg, color: clr, fontWeight: '600' }}>
                                  T{info.round}
                                  {info.dur > 0 && <div style={{ fontSize: '9px', fontWeight: '400' }}>{fmt(info.dur)}</div>}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '10px' }}>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#dcfce7', borderRadius: '2px', marginRight: '4px' }}></span>Tamamlandı</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#dbeafe', borderRadius: '2px', marginRight: '4px' }}></span>Aktif</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#fef3c7', borderRadius: '2px', marginRight: '4px' }}></span>QR Bekliyor</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '2px', marginRight: '4px' }}></span>Görüşmedi</span>
                </div>
              </div>
            )}

            {/* Geçmiş Turlar */}
            {curRound > 1 && (
              <div style={C}>
                <h3 style={T}>📋 Geçmiş Turlar</h3>
                {Array.from({ length: curRound - 1 }, (_, i) => curRound - 1 - i).map(rn => {
                  const rm = matches.filter(m => (m.round_number || 1) === rn);
                  return (
                    <div key={rn} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Tur {rn} ({rm.length} eşleşme)</div>
                      {rm.map(m => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', marginBottom: '3px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                          <span>{u(m.user1_id)?.full_name || '?'} ↔ {u(m.user2_id)?.full_name || '?'}</span>
                          <span style={{ color: '#10b981' }}>✅</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '6px' }}>Bu sayfa 5 saniyede bir otomatik güncelleniyor.</p>
          </>
        )}
      </div>
    </div>
  );
}

// Styles
const C: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e2e8f0' };
const T: React.CSSProperties = { fontSize: '14px', fontWeight: '600', color: '#334155', margin: '0 0 10px' };
const I: React.CSSProperties = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const };
const BP: React.CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: '#06b6d4', color: '#fff' };
const BD: React.CSSProperties = { background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '4px 8px', color: '#dc2626', fontSize: '11px', cursor: 'pointer' };
const badge: React.CSSProperties = { padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap' as const };
const nameBox: React.CSSProperties = { background: '#fff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '600' };
const th: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontWeight: '600' };
const td: React.CSSProperties = { padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center' };
