'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface EventItem { id: string; name: string; date: string; status: string; }

// ═══════════════════════════════════════════════════════════════
// KVKK METNİ - Bahtiyar'ın göndereceği metni buraya yapıştır
// ═══════════════════════════════════════════════════════════════
const KVKK_TEXT = `
Kişisel Verileri Koruma Kurumu 

Çalışan Özlük Dosyası Kişisel Verilerin İşlenmesi Aydınlatma Metni

Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanununun 10 uncu maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ kapsamında veri sorumlusu sıfatıyla Kişisel Verileri Koruma Kurumu (Kurum) tarafından hazırlanmıştır.
	
Kurum tarafından, insan kaynakları süreçlerinin yönetilmesi, çalışanlar için iş akdi ve mevzuattan kaynaklı yükümlülüklerin yerine getirilmesi, çalışanlar için yan haklar ve menfaatleri süreçlerinin yürütülmesi, eğitim faaliyetlerinin yürütülmesi, iş sağlığı ve güvenliği faaliyetlerinin yürütülmesi ile sözleşme süreçlerinin yürütülmesi amacıyla özlük dosyaları kapsamında çalışanlara ait kişisel veriler (ad soyad, TC kimlik no, iletişim, diploma, adli sicil kaydı, eğitim, sağlık, mesleğe ilişkin veriler, mal beyanı, askerlik durumu, fotoğraf, sosyal güvenlik bilgileri, güvenlik soruşturması, izin bilgisi, disiplin bilgisi, bakmakla yükümlü olduğu kişilerin çalışma durumu, kimlik verileri, okul ve sağlık verileri, çocukların öz üvey olma durum bilgisi, çocukların cinsiyeti verileri) işlenmektedir.

Söz konusu kişisel verilerden; 

- sağlık verileri kanunlarda öngörülme (6331 sayılı İş Sağlığı ve Güvenliği Kanunu), istihdam ve iş sağlığı ve güvenliği alanındaki hukuki yükümlülüklerin (Devlet Memurlarına Verilecek Hastalık Raporları ile Hastalık ve Refakat İznine İlişkin Usul ve Esaslar Hakkında Yönetmelik) yerine getirilmesi için zorunlu olması hukuki sebebine, Adli sicil kaydı verileri kanunlarda öngörülme (5352 sayılı Adli Sicil Kanunu) hukuki sebebine, Sendika üyeliğine ilişkin veriler kanunlarda öngörülme (6356 sayılı Sendikalar ve Toplu İş Sözleşmesi Kanunu, 4688 sayılı Kamu Görevlileri Sendikaları ve Toplu Sözleşme Kanunu) hukuki sebebine,

- diğer kişisel veriler ise kanunlarda öngörülme (4857 sayılı İş Kanunu, 657 sayılı Devlet Memurları Kanunu, 5510 sayılı Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu, 5188 sayılı Özel Güvenlik Hizmetlerine Dair Kanun ve ilgili diğer kanunlar) ve hukuki yükümlülüğün yerine getirilmesi hukuki sebebine,

dayalı olarak elden teslim, posta, kargo aracılığıyla manuel yolla veya ilgili Kurum ve Kuruluşlarla entegrasyon aracılığıyla otomatik yolla işlenmektedir. 

Bu veriler ilgili kanunları gereği yetkili kamu kurum ve kuruluşları ile paylaşılabilecektir. Ayrıca hukuki uyuşmazlıkların giderilmesi veya ilgili mevzuatı gereği talep halinde adli makamlar veya ilgili kolluk kuvvetlerine aktarılabilecektir. 

Kanunun “ilgili kişinin haklarını düzenleyen” 11 inci maddesi kapsamındaki taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğe göre Kurumun Nasuh Akar Mahallesi 1407 Sokak No: 4 Çankaya /ANKARA adresine yazılı olarak iletebilirsiniz.


Kişisel Verileri Koruma Kurumunca hazırlanan Kişisel Verilerin İşlenmesi Aydınlatma Metnini okudum, bilgi edindim.

`;
// ═══════════════════════════════════════════════════════════════

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', company: '', position: '', current_intent: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fetching, setFetching] = useState(true);

  // KVKK state
  const [showKvkk, setShowKvkk] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const kvkkRef = useRef<HTMLDivElement>(null);

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

  // KVKK scroll detection
  const handleKvkkScroll = useCallback(() => {
    const el = kvkkRef.current;
    if (!el) return;
    // scrollTop + clientHeight >= scrollHeight - 20px tolerance
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolledToBottom(true);
    }
  }, []);

  // Form doğrulama ve KVKK adımına geçiş
  const handleContinueToKvkk = () => {
    if (!selectedEvent) { setError('Lütfen bir etkinlik seçin.'); return; }
    if (!form.full_name.trim() || !form.email.trim() || !form.company.trim()) {
      setError('Ad, e-posta ve şirket alanları zorunludur.');
      return;
    }
    setError('');
    setShowKvkk(true);
    setScrolledToBottom(false);
    setKvkkAccepted(false);
  };

  // Kayıt gönderimi
  const handleSubmit = async () => {
    if (!kvkkAccepted) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_id: selectedEvent!.id }),
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
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: '0 20px 40px',
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
      <div style={{ ...pageStyle, justifyContent: 'center' }}>
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
      {/* ═══ LOGO ═══ */}
      <div style={{ textAlign: 'center', marginTop: '32px', marginBottom: '24px' }}>
        <img
          src="/logo-white.png"
          alt="Teknopark Ankara Yapay Zeka Kümelenmesi"
          style={{
            width: '300px',
            height: 'auto',
            display: 'block',
            margin: '0 auto',
          }}
        />
      </div>

      {/* ═══ Başlık ve Açıklama ═══ */}
      <div style={{ textAlign: 'center', marginBottom: '32px', maxWidth: '520px', width: '100%' }}>
        <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, margin: '0 0 10px' }}>
          🤝 Speed Networking
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0, lineHeight: '1.5' }}>
          Yapay Zeka Destekli Networking Eşleştirme Uygulaması
        </p>
      </div>

      {/* ═══ İçerik ═══ */}
      <div style={{ maxWidth: '520px', width: '100%' }}>
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
        ) : !showKvkk ? (
          /* ═══ KAYIT FORMU ═══ */
          <div>
            {events.length > 1 && (
              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => { setSelectedEvent(null); setError(''); }}
                  style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: '13px' }}
                >← Geri</button>
              </div>
            )}

            <div style={cardStyle}>
              <h3 style={{ color: '#06b6d4', fontSize: '16px', fontWeight: 600, margin: '0 0 12px', textAlign: 'center' }}>
                {selectedEvent.name}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px', textAlign: 'center' }}>
                🎯 Rastgele değil, akıllı eşleşme. Yapay zeka, verdiğiniz bilgilere göre size en uyumlu kişilerle görüşme sırası oluşturur. Ne kadar detaylı yazarsanız, eşleşmeniz o kadar isabetli olur.
              </p>
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
                  onClick={handleContinueToKvkk}
                  style={{
                    padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    color: '#fff', fontSize: '16px', fontWeight: 700,
                  }}
                >
                  Devam Et →
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ═══ KVKK ONAYI ═══ */
          <div>
            <div style={{ marginBottom: '12px' }}>
              <button
                onClick={() => { setShowKvkk(false); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: '13px' }}
              >← Bilgileri Düzenle</button>
            </div>

            <div style={cardStyle}>
              <h3 style={{ color: '#06b6d4', fontSize: '16px', fontWeight: 600, margin: '0 0 4px', textAlign: 'center' }}>
                Kişisel Verilerin Korunması
              </h3>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 16px', textAlign: 'center' }}>
                Lütfen aşağıdaki metni sonuna kadar okuyunuz.
              </p>

              {/* Scrollable KVKK text */}
              <div
                ref={kvkkRef}
                onScroll={handleKvkkScroll}
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  marginBottom: '16px',
                }}
              >
                <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {KVKK_TEXT}
                </p>
              </div>

              {/* Scroll indicator */}
              {!scrolledToBottom && (
                <p style={{ color: '#f59e0b', fontSize: '12px', textAlign: 'center', margin: '0 0 12px' }}>
                  ↓ Metni sonuna kadar kaydırınız
                </p>
              )}

              {/* Kabul checkbox - only visible after scroll */}
              {scrolledToBottom && (
                <label
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    cursor: 'pointer', marginBottom: '16px',
                    padding: '12px', borderRadius: '10px',
                    background: kvkkAccepted ? 'rgba(6,182,212,0.1)' : 'transparent',
                    border: kvkkAccepted ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={kvkkAccepted}
                    onChange={e => setKvkkAccepted(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: '#06b6d4', width: '18px', height: '18px', flexShrink: 0 }}
                  />
                  <span style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '1.5' }}>
                    Yukarıdaki aydınlatma metnini okudum, kişisel verilerimin belirtilen amaçlarla işlenmesini kabul ediyorum.
                  </span>
                </label>
              )}

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                  <p style={{ color: '#fca5a5', fontSize: '13px', margin: 0 }}>{error}</p>
                </div>
              )}

              {/* Kayıt butonu - only active after acceptance */}
              <button
                onClick={handleSubmit}
                disabled={!kvkkAccepted || loading}
                style={{
                  width: '100%',
                  padding: '14px', borderRadius: '12px', border: 'none',
                  cursor: (!kvkkAccepted || loading) ? 'not-allowed' : 'pointer',
                  background: (!kvkkAccepted || loading) ? '#334155' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
                  color: (!kvkkAccepted || loading) ? '#64748b' : '#fff',
                  fontSize: '16px', fontWeight: 700,
                  transition: 'all 0.3s',
                }}
              >
                {loading ? '⏳ Kaydediliyor...' : '🚀 Kayıt Ol'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
