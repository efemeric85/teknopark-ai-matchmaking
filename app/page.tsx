'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface EventItem { id: string; name: string; date: string; status: string; }

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', company: '', position: '', current_intent: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        const data = await res.json();
        const active = (data.events || []).filter((e: any) => e.status?.toLowerCase() === 'active');
        setEvents(active);
        if (active.length === 1) setSelectedEvent(active[0]);
      } catch (e) {
        console.error('Events fetch error:', e);
      }
      setFetching(false);
    };
    fetchEvents();
  }, []);

  const handleSubmit = async () => {
    if (!selectedEvent) { setError('Lütfen bir etkinlik seçin.'); return; }
    if (!form.full_name.trim() || !form.email.trim() || !form.company.trim()) {
      setError('Ad, e-posta ve şirket alanları zorunludur.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_id: selectedEvent.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.duplicate && data.redirect) {
          router.push(data.redirect);
          return;
        }
        setError(data.error || 'Kayıt sırasında bir hata oluştu.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/meeting/${encodeURIComponent(form.email.trim().toLowerCase())}`);
      }, 1500);
    } catch (e: any) {
      setError(e.message || 'Bağlantı hatası.');
    }
    setLoading(false);
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '20px',
  };
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
    borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', padding: '24px',
  };
  const formInputStyle: React.CSSProperties = {
    padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: '14px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

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
          <img
            src="/teknopark-ankara.png"
            alt="Teknopark Ankara"
            style={{ height: '80px', width: 'auto', display: 'block', margin: '0 auto 12px auto' }}
          />
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
            {fetching ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>Yükleniyor...</p>
            ) : events.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Şu anda aktif etkinlik bulunmuyor.</p>
              </div>
            ) : (
              events.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  style={{
                    display: 'block', width: '100%', padding: '18px', marginBottom: '10px',
                    borderRadius: '16px', border: '1px solid rgba(6,182,212,0.3)',
                    background: 'rgba(6,182,212,0.1)', color: '#e2e8f0', fontSize: '16px',
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {ev.name}
                  {ev.date && <span style={{ display: 'block', color: '#06b6d4', fontSize: '12px', marginTop: '4px' }}>{new Date(ev.date).toLocaleDateString('tr-TR')}</span>}
                </button>
              ))
            )}
          </div>
        ) : (
          <div>
            {/* Back button if multiple events */}
            {events.length > 1 && (
              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => { setSelectedEvent(null); setError(''); }}
                  style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: '13px' }}
                >← Geri</button>
              </div>
            )}

            {/* Form */}
            <div style={cardStyle}>
              <h3 style={{ color: '#06b6d4', fontSize: '16px', fontWeight: 600, margin: '0 0 16px', textAlign: 'center' }}>
                {selectedEvent.name}
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input placeholder="Ad Soyad *" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} style={formInputStyle} />
                <input placeholder="E-posta *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={formInputStyle} />
                <input placeholder="Şirket *" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={formInputStyle} />
                <input placeholder="Pozisyon" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} style={formInputStyle} />
                <textarea
                  placeholder="Bugün burada ne arıyorsunuz? (Yatırımcı, iş ortağı, müşteri, teknik bilgi...)"
                  value={form.current_intent}
                  onChange={e => setForm({ ...form, current_intent: e.target.value })}
                  rows={3}
                  style={{ ...formInputStyle, resize: 'vertical' as const }}
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
                  }}
                >
                  {loading ? '⏳ Kaydediliyor...' : '🚀 Kayıt Ol'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
