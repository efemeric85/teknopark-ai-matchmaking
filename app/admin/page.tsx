'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Event { id: string; name: string; date: string; duration: number; round_duration_sec?: number; max_rounds?: number; status: string; created_at?: string; }
interface User { id: string; full_name: string; company: string; position: string; email: string; event_id: string; current_intent?: string; }
interface Match { id: string; event_id: string; user1_id: string; user2_id: string; round_number: number; status: string; started_at: string | null; table_number?: number; compatibility_score?: number; }

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; }
function fmtTimer(s: number) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }
function timerColor(s: number) { return s <= 30 ? '#ef4444' : s <= 60 ? '#f59e0b' : '#10b981'; }

export default function AdminPage() {
  // ═══ Auth State ═══
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ═══ App State ═══
  const [events, setEvents] = useState<Event[]>([]);
  const [sel, setSel] = useState<Event | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState(360);
  const [newMaxRounds, setNewMaxRounds] = useState(5);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [tick, setTick] = useState(0);
  const pastRoundsRef = useRef<HTMLDivElement>(null);
  const matrixRef = useRef<HTMLDivElement>(null);

  // ═══ Settings State ═══
  const [showSettings, setShowSettings] = useState(false);
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsPw, setSettingsPw] = useState('');
  const [settingsConfirmPw, setSettingsConfirmPw] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  const flash = (text: string, type: string) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };
  const getDuration = () => sel?.round_duration_sec || sel?.duration || 360;
  const getMaxRounds = () => sel?.max_rounds || 5;

  const getUserById = useCallback((id: string): User | undefined => users.find(u => u.id === id), [users]);

  // ═══ Auth: check localStorage on mount ═══
  useEffect(() => {
    const saved = localStorage.getItem('adminToken');
    if (saved) {
      // Validate saved token with server
      fetch('/api/admin/auth', { headers: { 'x-admin-token': saved } })
        .then(r => r.json())
        .then(d => {
          if (d.valid) setAuthToken(saved);
          else localStorage.removeItem('adminToken');
          setAuthChecked(true);
        })
        .catch(() => { localStorage.removeItem('adminToken'); setAuthChecked(true); });
    } else {
      setAuthChecked(true);
    }
  }, []);

  // ═══ Timer tick ═══
  useEffect(() => {
    if (!authToken) return;
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [authToken]);

  // ═══ Auto-refresh data ═══
  useEffect(() => {
    if (!authToken) return;
    loadEvents();
  }, [authToken]);

  useEffect(() => {
    if (!sel || !authToken) return;
    loadUsers(sel.id);
    loadMatches(sel.id);
    const iv = setInterval(() => { loadUsers(sel.id); loadMatches(sel.id); }, 5000);
    return () => clearInterval(iv);
  }, [sel?.id, authToken]);

  // ═══ Auth handlers ═══
  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPw.trim()) { setLoginErr('Email ve şifre girin.'); return; }
    setLoginLoading(true);
    setLoginErr('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPw }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginErr(data.error || 'Giriş başarısız.'); setLoginLoading(false); return; }
      setAuthToken(data.token);
      localStorage.setItem('adminToken', data.token);
    } catch (e: any) {
      setLoginErr(e.message || 'Bağlantı hatası.');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem('adminToken');
    setSel(null); setEvents([]); setUsers([]); setMatches([]);
  };

  const handleChangeCredentials = async () => {
    if (!settingsEmail.trim() && !settingsPw.trim()) { flash('Email veya şifre girin.', 'err'); return; }
    if (settingsPw && settingsPw !== settingsConfirmPw) { flash('Şifreler eşleşmiyor.', 'err'); return; }
    if (settingsPw && settingsPw.length < 4) { flash('Şifre en az 4 karakter olmalı.', 'err'); return; }
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': authToken || '' },
        body: JSON.stringify({
          action: 'change_credentials',
          newEmail: settingsEmail.trim() || undefined,
          newPassword: settingsPw.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.error || 'Güncelleme hatası.', 'err'); setSettingsLoading(false); return; }
      // Update token
      setAuthToken(data.token);
      localStorage.setItem('adminToken', data.token);
      setSettingsEmail(''); setSettingsPw(''); setSettingsConfirmPw('');
      setShowSettings(false);
      flash('Admin bilgileri güncellendi.', 'ok');
    } catch (e: any) { flash(e.message, 'err'); }
    setSettingsLoading(false);
  };

  // ═══ Data loaders ═══
  const loadEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) {
      setEvents(data);
      if (sel) {
        const updated = data.find(e => e.id === sel.id);
        if (updated) setSel(updated);
      }
    }
  };

  const loadUsers = async (eventId: string) => {
    const { data } = await supabase.from('users').select('*').eq('event_id', eventId).order('full_name');
    if (data) setUsers(data);
  };

  const loadMatches = async (eventId: string) => {
    const { data } = await supabase.from('matches').select('*').eq('event_id', eventId).order('round_number').order('table_number');
    if (data) setMatches(data);
  };

  // ═══ Event CRUD ═══
  const createEvent = async () => {
    if (!newName.trim()) { flash('Etkinlik adı gerekli.', 'err'); return; }
    setLoading('create');
    const { error } = await supabase.from('events').insert({
      name: newName.trim(),
      date: newDate || new Date().toISOString().split('T')[0],
      duration: newDuration,
      round_duration_sec: newDuration,
      max_rounds: newMaxRounds,
      status: 'draft',
    });
    if (error) flash('Hata: ' + error.message, 'err');
    else { flash('Etkinlik oluşturuldu.', 'ok'); setNewName(''); setNewDate(''); setNewDuration(360); setNewMaxRounds(5); loadEvents(); }
    setLoading(null);
  };

  const toggleEventStatus = async (ev: Event) => {
    const s = ev.status === 'active' ? 'draft' : 'active';
    await supabase.from('events').update({ status: s }).eq('id', ev.id);
    loadEvents();
    if (sel?.id === ev.id) setSel({ ...sel, status: s });
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

  const updateMaxRounds = async (val: number) => {
    if (!sel) return;
    const clamped = Math.max(1, Math.min(50, val));
    await supabase.from('events').update({ max_rounds: clamped }).eq('id', sel.id);
    setSel({ ...sel, max_rounds: clamped });
    flash(`Maksimum tur: ${clamped}`, 'ok');
  };

  // ═══ Match operations (with auth) ═══
  const apiHeaders = () => ({ 'Content-Type': 'application/json', 'x-admin-token': authToken || '' });

  const doMatch = async () => {
    if (!sel) return;
    setLoading('match');
    try {
      const res = await fetch(`/api/events/${sel.id}/match`, { method: 'POST', headers: apiHeaders() });
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
      const { error } = await supabase.from('matches').delete().eq('event_id', sel.id);
      if (error) throw error;
      setMatches([]);
      flash('Tüm eşleşmeler sıfırlandı.', 'ok');
    } catch (e: any) { flash(e.message, 'err'); }
    setLoading(null);
  };

  const handleManualStart = async (matchId: string) => {
    await supabase.from('matches')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', matchId).eq('status', 'pending');
    if (sel) loadMatches(sel.id);
  };

  const handleStartAll = async () => {
    const pendingIds = currentRoundMatches.filter(m => m.status === 'pending').map(m => m.id);
    if (pendingIds.length === 0) return;
    const now = new Date().toISOString();
    await supabase.from('matches')
      .update({ status: 'active', started_at: now })
      .in('id', pendingIds);
    if (sel) loadMatches(sel.id);
  };

  const handleExportPdf = async () => {
    if (!sel || matches.length === 0 || users.length === 0) return;
    if (!pastRoundsRef.current || !matrixRef.current) return;

    // Load html2canvas + jsPDF from CDN
    const loadScript = (src: string) => new Promise<void>((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src;
      s.onload = () => res(); s.onerror = () => rej();
      document.head.appendChild(s);
    });
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    const h2c = (window as any).html2canvas;
    const { jsPDF } = (window as any).jspdf;

    // Capture screenshots at 2x for crisp rendering
    const [pastCanvas, matrixCanvas] = await Promise.all([
      h2c(pastRoundsRef.current, { backgroundColor: '#ffffff', scale: 2 }),
      h2c(matrixRef.current, { backgroundColor: '#ffffff', scale: 2 }),
    ]);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sel.name, margin, y + 6); y += 12;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Tarih: ${fmtDate(sel.date)}`, margin, y); y += 5;
    pdf.text(`Katılımcı: ${users.length} kişi`, margin, y); y += 5;
    const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b);
    pdf.text(`Toplam Tur: ${rounds.length}`, margin, y); y += 10;

    // Geçmiş Turlar screenshot
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Geçmiş Turlar', margin, y); y += 6;

    const pastImg = pastCanvas.toDataURL('image/png');
    const pastRatio = pastCanvas.height / pastCanvas.width;
    const pastW = Math.min(contentW, pastCanvas.width / 2 * 0.264583); // px to mm at 2x
    const pastH = pastW * pastRatio;
    const finalPastW = contentW;
    const finalPastH = finalPastW * pastRatio;

    // Check if it fits, otherwise add page
    if (y + finalPastH > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage(); y = margin;
    }
    pdf.addImage(pastImg, 'PNG', margin, y, finalPastW, finalPastH);
    y += finalPastH + 10;

    // Eşleşme Matrisi screenshot
    if (y + 20 > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage(); y = margin;
    }
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Eşleşme Matrisi', margin, y); y += 6;

    const matImg = matrixCanvas.toDataURL('image/png');
    const matRatio = matrixCanvas.height / matrixCanvas.width;
    const finalMatW = contentW;
    const finalMatH = finalMatW * matRatio;

    if (y + finalMatH > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage(); y = margin;
    }
    pdf.addImage(matImg, 'PNG', margin, y, finalMatW, finalMatH);

    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    pdf.save(`${sel.name.replace(/\s+/g, '_')}_eslesme_${ts}.pdf`);
  };

  // ═══ Timer & round helpers ═══
  const calcRemaining = (m: Match): number => {
    if (!m.started_at) return getDuration();
    const elapsed = (Date.now() - new Date(m.started_at).getTime()) / 1000;
    return Math.max(0, Math.ceil(getDuration() - elapsed));
  };

  const isExpired = (m: Match): boolean => m.status === 'active' && calcRemaining(m) <= 0;
  const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : 0;
  const currentRoundMatches = matches.filter(m => m.round_number === currentRound);
  const allCurrentDone = currentRound > 0 && currentRoundMatches.every(m => m.status === 'completed' || isExpired(m));
  const hasRunning = currentRoundMatches.some(m => (m.status === 'pending' || m.status === 'active') && !isExpired(m));
  const maxPossibleRounds = users.length < 2 ? 0 : (users.length % 2 === 0 ? users.length - 1 : users.length);
  const effectiveMaxRounds = Math.min(getMaxRounds(), maxPossibleRounds);
  const maxRoundsReached = currentRound >= effectiveMaxRounds;

  const pendingCount = currentRoundMatches.filter(m => m.status === 'pending').length;
  const activeCount = currentRoundMatches.filter(m => m.status === 'active' && !isExpired(m)).length;
  const completedCount = currentRoundMatches.filter(m => m.status === 'completed' || isExpired(m)).length;

  // Find unmatched/waiting user (odd number participant)
  const matchedUserIds = new Set<string>();
  currentRoundMatches.forEach(m => { matchedUserIds.add(m.user1_id); matchedUserIds.add(m.user2_id); });
  const waitingUser = currentRound > 0 ? users.find(u => !matchedUserIds.has(u.id)) : null;

  const pastRounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b);

  // ═══════════════════════════════════════
  // RENDER: LOADING
  // ═══════════════════════════════════════
  if (!authChecked) return <div style={pageStyle}><p style={{ color: '#94a3b8' }}>Yükleniyor...</p></div>;

  // ═══════════════════════════════════════
  // RENDER: LOGIN SCREEN
  // ═══════════════════════════════════════
  if (!authToken) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
            <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>Admin Girişi</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Teknopark Ankara Speed Networking</p>
          </div>
          <div style={cardDark}>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('pw')?.focus()}
              style={{ ...inputDark, marginBottom: '12px' }}
              autoFocus
            />
            <input
              id="pw"
              type="password"
              placeholder="Şifre"
              value={loginPw}
              onChange={e => setLoginPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputDark}
            />
            {loginErr && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                <p style={{ color: '#fca5a5', fontSize: '13px', margin: 0 }}>{loginErr}</p>
              </div>
            )}
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              style={{ ...btnCyan, width: '100%', marginTop: '16px', padding: '14px', fontSize: '16px', opacity: loginLoading ? 0.5 : 1 }}
            >
              {loginLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // RENDER: MAIN ADMIN PANEL
  // ═══════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>⚡ Admin Paneli</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {msg.text && (
            <span style={{ fontSize: '13px', padding: '4px 12px', borderRadius: '8px', background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2', color: msg.type === 'ok' ? '#166534' : '#991b1b' }}>
              {msg.text}
            </span>
          )}
          <a href="/" style={{ ...btnSmall, background: '#f0fdfa', color: '#0e7490', border: '1px solid #06b6d4', textDecoration: 'none', display: 'inline-block' }}>🏠 Anasayfa</a>
          <button onClick={handleLogout} style={{ ...btnSmall, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>Çıkış</button>
          <button onClick={() => setShowSettings(!showSettings)} style={{ ...btnSmall, background: showSettings ? '#dbeafe' : '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>⚙️</button>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        {/* ═══ Settings Panel ═══ */}
        {showSettings && (
          <div style={{ ...C, marginBottom: '16px', borderColor: '#93c5fd' }}>
            <h2 style={T}>Admin Bilgilerini Güncelle</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Boş bırakılan alan değiştirilmez.</p>
            <div style={{ display: 'grid', gap: '10px', maxWidth: '400px' }}>
              <input
                type="email" placeholder="Yeni email (boş bırakırsan değişmez)"
                value={settingsEmail} onChange={e => setSettingsEmail(e.target.value)}
                style={inputLight}
              />
              <input
                type="password" placeholder="Yeni şifre"
                value={settingsPw} onChange={e => setSettingsPw(e.target.value)}
                style={inputLight}
              />
              <input
                type="password" placeholder="Yeni şifre (tekrar)"
                value={settingsConfirmPw} onChange={e => setSettingsConfirmPw(e.target.value)}
                style={inputLight}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleChangeCredentials}
                  disabled={settingsLoading}
                  style={{ ...btnCyan, opacity: settingsLoading ? 0.5 : 1 }}
                >
                  {settingsLoading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button onClick={() => { setShowSettings(false); setSettingsEmail(''); setSettingsPw(''); setSettingsConfirmPw(''); }} style={btnSmall}>
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ═══ Create Event ═══ */}
        <div style={C}>
          <h2 style={T}>Yeni Etkinlik</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input placeholder="Etkinlik adı *" value={newName} onChange={e => setNewName(e.target.value)} style={inputLight} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputLight} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>Tur süresi (sn):</label>
              <input type="number" value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value) || 360)} style={{ ...inputLight, width: '80px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>Maks tur:</label>
              <input type="number" value={newMaxRounds} onChange={e => setNewMaxRounds(parseInt(e.target.value) || 5)} min={1} max={50} style={{ ...inputLight, width: '80px' }} />
            </div>
          </div>
          <button onClick={createEvent} disabled={loading === 'create'} style={{ ...btnCyan, marginTop: '12px', opacity: loading === 'create' ? 0.5 : 1 }}>
            + Etkinlik Oluştur
          </button>
        </div>

        {/* ═══ Event List ═══ */}
        <div style={{ ...C, marginTop: '16px' }}>
          <h2 style={T}>Etkinlikler</h2>
          {events.length === 0 && <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz etkinlik yok.</p>}
          {events.map(ev => (
            <div
              key={ev.id}
              onClick={() => setSel(ev)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer',
                border: sel?.id === ev.id ? '2px solid #06b6d4' : '1px solid #e2e8f0',
                background: sel?.id === ev.id ? '#f0fdfa' : '#fff', transition: 'all 0.15s',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>{ev.name}</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '2px', fontSize: '12px', color: '#64748b' }}>
                  {ev.date && <span>{fmtDate(ev.date)}</span>}
                  <span>{ev.round_duration_sec || 360}sn</span>
                  <span>{ev.max_rounds || 5} tur</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: ev.status === 'active' ? '#dcfce7' : '#fee2e2', color: ev.status === 'active' ? '#166534' : '#991b1b' }}>
                  {ev.status === 'active' ? 'Yayında' : 'Taslak'}
                </span>
                <button onClick={(e) => { e.stopPropagation(); toggleEventStatus(ev); }} style={{ ...btnSmall, background: ev.status === 'active' ? '#fef3c7' : '#dcfce7', color: ev.status === 'active' ? '#92400e' : '#166534' }}>
                  {ev.status === 'active' ? '⏸' : '▶'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }} style={{ ...btnSmall, background: '#fee2e2', color: '#dc2626' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ Selected Event Details ═══ */}
        {sel && (
          <>
            {/* Participants */}
            <div style={{ ...C, marginTop: '16px' }}>
              <h3 style={T}>Katılımcılar ({users.length})</h3>
              {users.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>Henüz katılımcı yok.</p>
              ) : (
                <div style={{ display: 'grid', gap: '4px' }}>
                  {users.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{p.full_name}</span>
                        <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>{p.company}</span>
                        <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '8px' }}>{p.email}</span>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.current_intent || ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Match Controls */}
            <div style={{ ...C, marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ ...T, margin: 0 }}>Eşleştirme Yönetimi</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '10px', background: maxRoundsReached ? '#fef3c7' : '#f0fdfa', border: `1px solid ${maxRoundsReached ? '#fbbf24' : '#06b6d4'}` }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: maxRoundsReached ? '#92400e' : '#0e7490' }}>
                      Tur {currentRound} / {effectiveMaxRounds}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>Maks:</label>
                    <input
                      type="number" min={1} max={maxPossibleRounds} value={getMaxRounds()}
                      onChange={e => updateMaxRounds(parseInt(e.target.value) || 5)}
                      style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', textAlign: 'center' }}
                    />
                  </div>
                </div>
              </div>

              {getMaxRounds() > maxPossibleRounds && users.length > 0 && (
                <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
                  <p style={{ color: '#92400e', fontSize: '12px', margin: 0 }}>⚠️ {users.length} katılımcı ile en fazla {maxPossibleRounds} tur yapılabilir.</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={doMatch}
                  disabled={loading === 'match' || (hasRunning && currentRound > 0) || (maxRoundsReached && !allCurrentDone)}
                  style={{ ...btnCyan, opacity: loading === 'match' || (hasRunning && currentRound > 0) ? 0.5 : 1 }}
                >
                  {loading === 'match' ? 'Eşleştiriliyor...' :
                    currentRound === 0 ? 'AI Eşleştir' :
                    maxRoundsReached && allCurrentDone ? 'Tüm Turlar Bitti' :
                    allCurrentDone ? `Tur ${currentRound + 1} Başlat` :
                    'Tur Devam Ediyor'}
                </button>
                <button onClick={resetMatches} disabled={loading === 'reset'} style={{ ...btnDanger, opacity: loading === 'reset' ? 0.5 : 1 }}>
                  {loading === 'reset' ? '...' : 'Tümünü Sıfırla'}
                </button>
              </div>

              {currentRound > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: waitingUser ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '10px', marginTop: '16px' }}>
                  <StatBox label="Bekleyen" value={pendingCount} color="#f59e0b" />
                  <StatBox label="Aktif" value={activeCount} color="#10b981" />
                  <StatBox label="Tamamlanan" value={completedCount} color="#06b6d4" />
                  {waitingUser && <StatBox label="Beklemede" value={1} color="#8b5cf6" />}
                </div>
              )}

              {waitingUser && currentRound > 0 && (
                <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '10px 14px', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>⏳</span>
                  <span style={{ fontSize: '13px', color: '#5b21b6', fontWeight: 600 }}>{waitingUser.full_name}</span>
                  <span style={{ fontSize: '12px', color: '#7c3aed' }}>({waitingUser.company}) bu turda beklemede</span>
                </div>
              )}

              {currentRound > 0 && currentRoundMatches.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0 }}>Tur {currentRound} Eşleşmeleri</h4>
                    {pendingCount > 0 && (
                      <button onClick={handleStartAll} style={{ ...btnSmall, background: '#10b981', color: '#fff', fontWeight: 600, padding: '6px 16px' }}>
                        ▶ Hepsini Başlat ({pendingCount})
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {currentRoundMatches.map(m => {
                      const u1 = getUserById(m.user1_id);
                      const u2 = getUserById(m.user2_id);
                      const remaining = calcRemaining(m);
                      const expired = isExpired(m);
                      const isDone = m.status === 'completed' || expired;

                      return (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', borderRadius: '12px',
                          background: isDone ? '#f0fdf4' : m.status === 'active' ? '#fff' : '#fffbeb',
                          border: `1px solid ${isDone ? '#86efac' : m.status === 'active' ? '#e2e8f0' : '#fde68a'}`,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>{u1?.full_name || '?'}</span>
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>({u1?.company || ''})</span>
                              <span style={{ color: '#06b6d4' }}>↔</span>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>{u2?.full_name || '?'}</span>
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>({u2?.company || ''})</span>
                            </div>
                            {m.compatibility_score != null && m.compatibility_score > 0 && (
                              <span style={{ fontSize: '11px', color: '#0891b2', background: '#ecfeff', padding: '2px 8px', borderRadius: '6px', marginTop: '4px', display: 'inline-block' }}>
                                Uyum: %{Math.round(m.compatibility_score * 100)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isDone ? (
                              <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 600 }}>Bitti</span>
                            ) : m.status === 'active' ? (
                              <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', color: timerColor(remaining) }}>
                                {fmtTimer(remaining)}
                              </span>
                            ) : (
                              <>
                                <span style={{ color: '#f59e0b', fontSize: '12px' }}>QR Bekliyor</span>
                                <button onClick={() => handleManualStart(m.id)} style={{ ...btnSmall, background: '#dbeafe', color: '#1e40af' }}>Başlat</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pastRounds.length > 1 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0 }}>Geçmiş Turlar</h4>
                    <button onClick={handleExportPdf} style={{ ...btnSmall, background: '#059669', color: '#fff', fontWeight: 600, padding: '6px 14px', fontSize: '12px' }}>
                      📥 PDF İndir
                    </button>
                  </div>
                  <div ref={pastRoundsRef}>
                  {pastRounds.filter(r => r < currentRound).map(r => {
                    const rm = matches.filter(m => m.round_number === r);
                    return (
                      <div key={r} style={{ padding: '8px 12px', borderRadius: '8px', background: '#f8fafc', marginBottom: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>Tur {r}</span>
                        <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '12px' }}>{rm.length} eşleşme</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {rm.map(m => {
                            const u1 = getUserById(m.user1_id);
                            const u2 = getUserById(m.user2_id);
                            return (
                              <span key={m.id} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1' }}>
                                {u1?.full_name || '?'} ↔ {u2?.full_name || '?'}
                                {m.compatibility_score ? ` (%${Math.round(m.compatibility_score * 100)})` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}

              {matches.length > 0 && users.length > 0 && (
                <div style={{ marginTop: '20px', overflowX: 'auto' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>Eşleşme Matrisi</h4>
                  <div ref={matrixRef}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}></th>
                        {users.map(u => <th key={u.id} style={{ ...thStyle, whiteSpace: 'nowrap', fontSize: '10px', padding: '4px 6px' }}>{u.full_name.split(' ')[0]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(row => (
                        <tr key={row.id}>
                          <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.full_name.split(' ')[0]}</td>
                          {users.map(col => {
                            if (row.id === col.id) return <td key={col.id} style={{ ...tdStyle, background: '#334155' }}></td>;
                            const m = matches.find(m =>
                              (m.user1_id === row.id && m.user2_id === col.id) ||
                              (m.user2_id === row.id && m.user1_id === col.id)
                            );
                            return (
                              <td key={col.id} style={{ ...tdStyle, background: m ? '#dcfce7' : '#fff', textAlign: 'center' }}>
                                {m ? m.round_number : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '24px' }}>
          V9 AI Matching
        </p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '14px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</div>
    </div>
  );
}

// ═══ Styles ═══
const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '20px',
};

const cardDark: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
  borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', padding: '24px',
};

const inputDark: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
  color: '#e2e8f0', fontSize: '16px', outline: 'none',
};

const C: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '20px',
  border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const T: React.CSSProperties = { fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' };

const inputLight: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
  fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const btnCyan: React.CSSProperties = {
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

const thStyle: React.CSSProperties = {
  padding: '4px 6px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
  fontWeight: 600, fontSize: '10px', color: '#64748b',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 6px', border: '1px solid #f1f5f9', fontSize: '11px', color: '#334155',
};
