# Teknopark AI Matchmaking

Networking etkinlikleri için yapay zeka destekli katılımcı eşleştirme uygulaması. Katılımcıları mesleki hedeflerine göre akıllı eşleştirir, QR kod ile sohbet başlatır, tur bazlı yönetim ve gerçek zamanlı sayaç sunar.

**Canlı:** [atyzk.vercel.app](https://atyzk.vercel.app)

## Ne Yapar?

Etkinlik organizatörü katılımcıları kaydeder, sistem Türkçe NLP tabanlı TF-IDF algoritmasıyla en uyumlu çiftleri eşleştirir, her çifte masa numarası atar. Katılımcılar telefonlarında QR kod görür, partnerlerinin QR kodunu okutunca geri sayım sayacı başlar. Admin panelinden tüm süreç canlı takip edilir.

## Teknik Altyapı

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Veritabanı | Supabase (PostgreSQL) |
| NLP/Eşleştirme | Türkçe TF-IDF + Complementary Scoring |
| QR Kod | qrcode.react (render) + html5-qrcode (okuma) |
| PDF Export | html2canvas + jsPDF (CDN) |
| Deploy | Vercel |

## Proje Yapısı

```
app/
├── page.tsx                          # Landing page (kayıt formu + KVKK)
├── admin/page.tsx                    # Admin paneli (963 satır)
├── meeting/[userId]/page.tsx         # Katılımcı sayfası (QR + sayaç)
├── activate/[matchId]/
│   ├── page.tsx                      # QR okutma sayfası (isim seçimi)
│   └── go/route.ts                   # QR handshake API (race condition korumalı)
├── api/
│   ├── events/
│   │   ├── route.ts                  # Etkinlik CRUD
│   │   └── [id]/match/route.ts       # Eşleştirme motoru (601 satır)
│   ├── meeting/[userId]/route.ts     # Katılımcı veri API (V16)
│   ├── users/
│   │   ├── login/route.ts            # Email ile giriş
│   │   └── register/route.ts         # Kayıt (email validation)
│   ├── admin/auth/route.ts           # Admin login + credential management
│   └── debug/route.ts                # Debug endpoint (auth korumalı)
├── middleware.ts                      # Route bazlı auth kontrolü
└── lib/supabase.ts                   # Supabase client
```

## Eşleştirme Algoritması

Sistem OpenAI API kullanmaz. Eşleştirme tamamen sunucu tarafında Türkçe NLP ile çalışır:

1. Katılımcıların `current_intent` (networking hedefi) alanları Türkçe tokenizer ile parçalanır (stopword filtreleme, lowercase, 2+ karakter)
2. TF-IDF vektörleri hesaplanır, cosine similarity ile alan benzerliği (domain score) bulunur
3. Complementary scoring: "yatırımcı arıyorum" ile "yatırım yapıyorum" gibi tamamlayıcı çiftlere bonus puan verilir
4. Final skor: %30 domain similarity + %70 complementary score
5. Backtracking algoritması ile tekrarsız optimal eşleşme bulunur (küçük gruplarda)
6. Wait fairness: Tek kişi kalınca BYE round uygulanır, aynı kişi art arda beklememesi sağlanır

## Özellikler

### Admin Paneli
- Çoklu etkinlik yönetimi (oluştur, yayınla/taslağa al, sil)
- Tek tuşla AI eşleştirme
- Her eşleşme için canlı geri sayım sayacı (renk geçişli: yeşil > sarı > kırmızı)
- Manuel başlatma (QR beklemeden admin elle başlatabilir)
- Toplu başlatma ("Hepsini Başlat" butonu)
- Tur yönetimi (Sonraki Tur / Tümünü Sıfırla)
- Eşleşme matrisi (kimin kiminle hangi turda görüştüğü)
- PDF export (tüm turlar + matris)
- İstatistik kutuları (Bekleyen / Aktif / Tamamlanan / Beklemede)
- Masa numarası ataması
- Admin credential değiştirme

### Katılımcı Sayfası
- Eşleşme beklerken bekleme ekranı
- Eşleşme sonrası QR kod gösterimi
- Partner bilgileri (isim, şirket, pozisyon)
- Masa numarası (büyük kırmızı yazı)
- QR okutulunca otomatik sayaç başlangıcı
- Süre bitince otomatik tamamlanma

### QR Handshake Akışı
1. Katılımcı A telefonunda QR kodu gösterir
2. Katılımcı B QR kodu okutup kendi ismini seçer
3. `go/route.ts` match'i `pending` → `active` yapar
4. Race condition koruması: iki kişi aynı anda okutsa bile ikisi de meeting sayfasına yönlendirilir
5. Her iki telefondan da geri sayım sayacı senkronize çalışır

### Kayıt
- KVKK onay metni
- Email format doğrulaması
- Aynı etkinliğe mükerrer kayıt engeli
- Çoklu etkinlik desteği (landing page sadece aktif etkinlikleri gösterir)

## Supabase Tabloları

| Tablo | Açıklama |
|-------|----------|
| `users` | Katılımcılar (full_name, email, company, position, current_intent, event_id) |
| `events` | Etkinlikler (name, status, duration, round_duration_sec, max_rounds, event_date) |
| `matches` | Eşleşmeler (user1_id, user2_id, round_number, status, started_at, table_number, compatibility_score, icebreaker_question) |
| `admin_settings` | Admin credentials (email, password) |

## Kurulum

### Gereksinimler
- Node.js 18+
- Supabase hesabı
- Vercel hesabı (deploy için)

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Supabase Tablo Oluşturma

```sql
CREATE TABLE admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  email TEXT NOT NULL,
  password TEXT NOT NULL
);

INSERT INTO admin_settings (email, password) VALUES ('admin@teknopark.com', 'changeme');

CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  duration INTEGER DEFAULT 360,
  round_duration_sec INTEGER DEFAULT 360,
  max_rounds INTEGER DEFAULT 5,
  event_date DATE,
  event_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  position TEXT DEFAULT '',
  current_intent TEXT DEFAULT '',
  event_id UUID REFERENCES events(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, event_id)
);

CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  round_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  table_number INTEGER DEFAULT 1,
  compatibility_score FLOAT DEFAULT 0,
  icebreaker_question TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Local Geliştirme

```bash
git clone https://github.com/efemeric85/teknopark-ai-matchmaking.git
cd teknopark-ai-matchmaking
yarn install
cp .env.example .env  # env değişkenlerini doldur
yarn dev
```

Tarayıcıda `http://localhost:3000` adresini aç.

### Vercel Deploy

1. GitHub repo'sunu Vercel'e bağla
2. Environment variables'ları Vercel dashboard'dan ekle
3. Her push otomatik deploy olur

## API Endpoints

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/events` | Public | Aktif etkinlikleri listele |
| POST | `/api/events` | Admin | Yeni etkinlik oluştur |
| POST | `/api/events/[id]/match` | Admin | Eşleştirme başlat / sonraki tur |
| DELETE | `/api/events/[id]/match` | Admin | Tüm eşleşmeleri sıfırla |
| GET | `/api/meeting/[userId]` | Public | Katılımcı verisi (match, partner, event, timer) |
| POST | `/api/users/register` | Public | Katılımcı kaydı |
| POST | `/api/users/login` | Public | Email ile giriş |
| GET | `/api/activate/[matchId]/go` | Public | QR handshake (match aktifleştirme) |
| POST | `/api/admin/auth` | Mixed | Admin login + credential değiştirme |
| GET | `/api/debug` | Admin | Sistem durumu |

## Güvenlik

- Admin endpoint'leri `x-admin-token` header'ı gerektirir (middleware.ts)
- Token: SHA-256(email + password + "teknopark-2026")
- Katılımcı endpoint'leri public (email bazlı erişim)
- Service Role Key sadece server-side API route'larında kullanılır
- `.env` dosyası `.gitignore`'da, repoya commit edilmez

## Bilinen Kısıtlamalar

- Admin şifresi Supabase'de plaintext saklanır (hash yok)
- Supabase RLS (Row Level Security) aktif değil
- PDF export CDN bağımlı (html2canvas + jsPDF cloudflare CDN'den yüklenir)
- Admin token expire olmaz, session yönetimi yok
- `packageManager` alanı Corepack uyumsuzluğuna sebep olabilir

## Lisans

Bu proje özel kullanım içindir.

## Author

**Efe Meric** | [RichMe AI](https://richmeai.com)
05.02.2026
AI Automation & Process Optimization Consultant
