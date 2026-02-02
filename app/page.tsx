'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

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
}

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', company: '', position: '', current_intent: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: true, nullsFirst: false });
      if (data) setEvents(data);
    };
    fetchEvents();
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!selectedEvent) { setError('Lütfen bir etkinlik seçin.'); return; }
    if (!form.full_name.trim() || !form.email.trim() || !form.company.trim()) {
      setError('Ad, e-posta ve şirket alanları zorunludur.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_id: selectedEvent.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Kayıt sırasında bir hata oluştu.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/meeting/${encodeURIComponent(form.email)}`);
      }, 1500);
    } catch (e: any) {
      setError(e.message || 'Bağlantı hatası.');
    }
    setLoading(false);
  };

  // ─── Success screen ───
  if (success) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ color: '#06b6d4', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>Kayıt Başarılı!</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Eşleşme sayfanıza yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: '520px', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ color: '#06b6d4', fontSize: '12px', letterSpacing: '3px', margin: '0 0 4px' }}>TEKNOPARK ANKARA</p>
          <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>🤝 Speed Networking</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Yapay zeka destekli networking etkinliği</p>
        </div>

        {/* Event selection */}
        {!selectedEvent ? (
          <div>
            <p style={{ color: '#cbd5e1', fontSize: '14px', textAlign: 'center', marginBottom: '16px' }}>
              Katılmak istediğiniz etkinliği seçin:
            </p>
            {events.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Şu an aktif etkinlik bulunmuyor.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {events.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
                      borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)',
                      padding: '20px 24px', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = '#06b6d4'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>{ev.name}</h3>
                        {ev.date && <p style={{ color: '#06b6d4', fontSize: '13px', margin: 0 }}>📅 {formatDate(ev.date)}</p>}
                      </div>
                      <span style={{ color: '#06b6d4', fontSize: '24px' }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Registration form */
          <div>
            {/* Selected event header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(6,182,212,0.1)', borderRadius: '12px', padding: '12px 16px',
              border: '1px solid rgba(6,182,212,0.2)', marginBottom: '20px',
            }}>
              <div>
                <span style={{ color: '#06b6d4', fontSize: '12px', fontWeight: 600 }}>KAYIT</span>
                <p style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: '2px 0 0' }}>{selectedEvent.name}</p>
                {selectedEvent.date && <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0' }}>📅 {formatDate(selectedEvent.date)}</p>}
              </div>
              <button
                onClick={() => { setSelectedEvent(null); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
              >← Geri</button>
            </div>

            {/* Form */}
            <div style={cardStyle}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input
                  placeholder="Ad Soyad *"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="E-posta *"
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="Şirket *"
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="Pozisyon"
                  value={form.position}
                  onChange={e => setForm({ ...form, position: e.target.value })}
                  style={formInputStyle}
                />
                <textarea
                  placeholder="Bugün burada ne arıyorsunuz? (Yatırımcı, iş ortağı, müşteri, teknik bilgi...)"
                  value={form.current_intent}
                  onChange={e => setForm({ ...form, current_intent: e.target.value })}
                  rows={3}
                  style={{ ...formInputStyle, resize: 'vertical' }}
                />

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                    <p style={{ color: '#fca5a5', fontSize: '13px', margin: 0 }}>{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: '14px', borderRadius: '12px', border: 'none', cursor: loading ? 'wait' : 'pointer',
                    background: loading ? '#334155' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    color: '#fff', fontSize: '16px', fontWeight: 700,
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? 'Kaydediliyor...' : '🚀 Kayıt Ol'}
                </button>
              </div>
            </div>
          </div>
        )}

        <p style={{ color: '#475569', fontSize: '11px', textAlign: 'center', marginTop: '32px', letterSpacing: '1px' }}>
          TEKNOPARK ANKARA · AI MATCHMAKING
        </p>
      </div>
    </div>
  );
}

// ─── Styles ───
const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '24px',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
  borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)',
  padding: '24px',
};

const formInputStyle: React.CSSProperties = {
  padding: '12px 16px', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
  color: '#fff', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
};
