'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface EventItem { id: string; name: string; date: string; status: string; }

// ═══════════════════════════════════════════════════════════════
// KVKK METNİ - Bahtiyar'ın göndereceği metni buraya yapıştır
// ═══════════════════════════════════════════════════════════════
const KVKK_TEXT = `
TEKNOPARK ANKARA SPEED NETWORKİNG ETKİNLİĞİ
KİŞİSEL VERİLERİN İŞLENMESİ AYDINLATMA METNİ
Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanununun 10 uncu maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ kapsamında veri sorumlusu sıfatıyla Ankara Teknopark Teknoloji Geliştirme Bölgesi Yönetici Anonim Şirketi ("Teknopark Ankara") tarafından hazırlanmıştır.
1. İşlenen Kişisel Veriler
Speed Networking etkinliğine katılımınız kapsamında aşağıdaki kişisel verileriniz işlenmektedir:
Kimlik bilgileri: Ad soyad
İletişim bilgileri: E-posta adresi
Mesleki bilgiler: Şirket/kurum adı, pozisyon/unvan
Etkinlik bilgileri: Networking amacı/beklentisi, eşleşme tercihleri, katılım durumu, eşleşme geçmişi, QR kod okutma kayıtları
2. Kişisel Verilerin İşlenme Amaçları
Toplanan kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:
Etkinlik kaydının oluşturulması ve katılımcı yönetiminin sağlanması, yapay zeka destekli katılımcı eşleştirmesinin gerçekleştirilmesi, eşleşme uyumluluk analizinin yapılması, etkinlik süresince tur yönetimi ve masa atamalarının düzenlenmesi, sohbet başlatıcı soruların oluşturulması, etkinlik istatistiklerinin tutulması ve raporlanması.
3. Kişisel Verilerin İşlenme Yöntemi ve Hukuki Sebebi
Kişisel verileriniz, etkinlik kayıt formu aracılığıyla otomatik yolla toplanmakta ve dijital ortamda işlenmektedir.
Verileriniz, 6698 sayılı Kanunun 5 inci maddesinin 1 inci fıkrası kapsamında açık rızanıza dayalı olarak işlenmektedir.
Yapay zeka destekli eşleştirme sürecinde, kayıt sırasında belirttiğiniz networking amacı ve mesleki bilgileriniz, uyumlu katılımcılarla eşleştirilmeniz amacıyla otomatik olarak analiz edilmektedir. Bu süreçte herhangi bir profilleme veya otomatik karar alma mekanizması kullanılmamakta olup, nihai eşleştirme etkinlik yöneticisi tarafından onaylanmaktadır.
4. Kişisel Verilerin Aktarılması
Kişisel verileriniz, eşleştiğiniz katılımcılarla sınırlı olarak paylaşılmaktadır (ad soyad, şirket, pozisyon). Bunun dışında verileriniz, hukuki yükümlülüklerin yerine getirilmesi amacıyla yetkili kamu kurum ve kuruluşlarına veya adli makamlara yasal zorunluluk halinde aktarılabilecektir.
Eşleştirme sürecinde kullanılan yapay zeka altyapısı için verileriniz, veri işleyen sıfatıyla hizmet alınan teknoloji sağlayıcılarına (sunucu ve yapay zeka API hizmetleri) aktarılabilmektedir.
5. Kişisel Verilerin Saklanma Süresi
Kişisel verileriniz, etkinliğin sona ermesinin ardından etkinlik raporlaması amacıyla en fazla 30 (otuz) gün süreyle saklanacak, bu sürenin sonunda silinecek, yok edilecek veya anonim hale getirilecektir.
6. İlgili Kişi Olarak Haklarınız
6698 sayılı Kanunun 11 inci maddesi kapsamında aşağıdaki haklara sahipsiniz:
Kişisel verilerinizin işlenip işlenmediğini öğrenme, kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme, kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme, kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde bunların düzeltilmesini isteme, Kanunun 7 nci maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme, yapılan işlemlerin kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme, işlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme, kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme.
Haklarınıza ilişkin taleplerinizi bahtiyar.ozturk@tatgb.com adresine yazılı olarak iletebilirsiniz.
7. Açık Rıza
Yukarıdaki aydınlatma metnini okudum ve anladım. Speed Networking etkinliği kapsamında kişisel verilerimin belirtilen amaçlarla işlenmesine, yapay zeka destekli eşleştirme sürecinde kullanılmasına ve eşleştiğim katılımcılarla sınırlı bilgilerimin paylaşılmasına açık rızam ile onay veriyorum.

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
