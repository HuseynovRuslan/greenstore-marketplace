# GreenStore: verilənlər bazası

**Status:** təsdiqlənib (22 noyabr 2026). Faza 1-in cədvəlləri yaradılıb (miqrasiya `AddCatalogueTables`): `categories`, `cities`, `users`, `photos`, `sellers`, `listings` (`pending_promotion_option_id` faza 5-də, `promotion_options` ilə birlikdə), `listing_photos`, `listing_counters` və `listing_number_seq`. Faza 2-də (miqrasiya `AddAccounts`, sonra `AddOtpCreatedIndex`) `sessions`, `otp_challenges`, `favorites` və `saved_searches` gəlib; `users` faza 1-dən tamdır. Faza 3-də (miqrasiya `AddListingLifecycle`) `listing_drafts`, `listing_revisions`, `moderation_decisions`, `listing_daily_stats`, `listing_seen` (UNLOGGED), `outbox`, `audit_log` və `idempotency_keys` gəlib. Faza 4-də (miqrasiya `AddReportsRequestsSupport`) `reports`, `service_requests`, `service_request_recipients`, `support_messages` və `service_request_number_seq`, `support_ticket_seq` ardıcıllıqları gəlib. Faza 5-də (miqrasiya `AddPromotions`) `promotion_packages`, `promotion_options` (seed: `src/data/promotions.ts`-dən, adlar üç dildə), `promotion_orders`, `payment_events`, `listing_promotions`, `promotion_order_number_seq`, `listings.pending_promotion_option_id` və `listings.promoted_at` (`ix_listings_feed` onu da daxil edir) gəlib. `devices` mobil tətbiqi gözləyir. 24 noyabr 2026-da (miqrasiya `RemoveServiceRequests`) «Usta çağır» çıxarılıb: `service_requests`, `service_request_recipients` və `service_request_number_seq` silinib, göndərilməmiş `sms-notice` outbox sətirləri də ([remove-usta-cagir.md](../docs/handoff/remove-usta-cagir.md)).
**Əlaqəli sənədlər:** [ARCHITECTURE.md](ARCHITECTURE.md) (ümumi arxitektura), [backend-contract.md](../docs/handoff/backend-contract.md) (frontend müqaviləsi).

Aşağıdakı SQL hədəf sxemdir. Real cədvəllər EF Core miqrasiyaları ilə yaradılacaq, amma nəticə bu sxemlə eyni olmalıdır. Hər miqrasiyanın SQL-i bu sənədlə müqayisə olunur.

## 1. Ümumi xəritə

```
users
 ├─ 0..1 sellers                    biznes profili (fərdi satıcının profili yoxdur)
 ├─ N sessions ── N devices         giriş; devices mobil tətbiq gələndə
 ├─ N listing_drafts                «Elan yerləşdir»in yarımçıq vəziyyəti
 ├─ N listings ─► categories        category_id və subcategory_id (alt kateqoriya da categories-dədir)
 │    │        ─► cities
 │    │        ─► sellers           biznes hesabında
 │    ├─ 1 listing_counters         baxış, nömrə göstərmə, seçilmiş
 │    ├─ N listing_daily_stats      14 günlük qrafik
 │    ├─ N listing_photos ─► photos
 │    ├─ N listing_revisions ── N moderation_decisions
 │    └─ N listing_promotions ─► promotion_orders ─► promotion_options ─► promotion_packages
 ├─ N favorites ─► listings
 ├─ N saved_searches
 └─ N reports ─► listings | sellers

Müstəqil: otp_challenges, support_messages, payment_events, outbox, audit_log, idempotency_keys
```

## 2. Konvensiyalar

| Mövzu | Qayda | Niyə |
|---|---|---|
| Adlar | snake_case, cəm halda cədvəl adları | EF `EFCore.NamingConventions` ilə avtomatik |
| Açarlar | `uuid` (UUIDv7, tətbiq yaradır). Taksonomiya (`categories`, `cities`, paketlər) üçün mətn açar: `agaclar`, `baki`, `one-cixar` | UUIDv7 zamanla artır, indeksə yaxşı düşür. Taksonomiya açarları URL-də artıq işlənir |
| Mətn | `text` və `CHECK (char_length(...) <= N)` | `varchar(N)` ilə eyni sürətdir, amma limiti dəyişmək asandır |
| Enum-lar | `text` və `CHECK (x IN (...))`. PostgreSQL-in öz `enum` tipi istifadə olunmur | Öz `enum`-dan dəyəri silmək və adını dəyişmək çətindir. Dəyərlər `src/types`-dakı kebab-case sətirlərlə eynidir |
| Çoxdilli ad | `jsonb` (`LocalizedText`): `{ "az": "Güllər", "ru": "Розы", "en": "Roses" }`, `CHECK (name ? 'az')` | `az` məcburidir, qalan dillər yoxdursa `az` göstərilir |
| Vaxt | `timestamptz`, UTC. Gün sərhədləri (statistika) Bakı vaxtı ilə (UTC+4) hesablanır | |
| Pul | `numeric(10,2)`, yalnız AZN | `float` qəpikləri itirir |
| Telefon | E.164: `CHECK (phone ~ '^\+994[0-9]{9}$')` | Bütün nömrələr bir formada, `+994501234567` |
| Hash | `bytea`: tokenlər SHA-256, SMS kodu və IP HMAC-SHA256 (server açarı ilə) | 4 rəqəmli kodun cəmi 10 000 variantı var. Sadə hash baza sızanda bir anda açılardı, HMAC açarsız açılmır |
| Silmə | elanlarda `deleted_at` (sətir qalır). Sahibə bağlı alt cədvəllərdə `ON DELETE CASCADE`, qalan yerlərdə FK silməyə icazə vermir | Nömrələmə, şikayət və ödəniş tarixçəsi qırılmır |
| Məntiq | trigger və stored procedure yoxdur. Baza yalnız bütövlüyü (`CHECK`, FK, `UNIQUE`) qoruyur, qayda C#-dadır | Bütün qaydalar bir yerdə, testlərlə |
| `updated_at` | EF-in `SaveChanges` interceptor-u yazır | trigger lazım olmur |
| Rəqabətli yazma | `xmin` sistem sütunu concurrency token kimi (`listings`, `sellers`, `categories`) | İki nəfər eyni anda redaktə edəndə ikincisi xəta alır, birincinin dəyişikliyi itmir |

**Baza belə yaradılır:** `ENCODING 'UTF8'`, lokal `C.UTF-8` (və ya ICU). Bu vacibdir: `C` lokalında `pg_trgm` kiril hərflərini söz hərfi saymır və rusca axtarış işləmir. Satıcı adlarını Azərbaycan əlifbası ilə sıralamaq üçün (ç, ə, ğ, ı, ö, ş, ü) sorğuda `COLLATE "az-x-icu"` işlədilir.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SEQUENCE listing_number_seq          START 10001;  -- «Elan № 10001»
CREATE SEQUENCE support_ticket_seq          START 1001;
CREATE SEQUENCE promotion_order_number_seq  START 1001;
```

## 3. Cədvəllər

### 3.1 Taksonomiya

```sql
CREATE TABLE categories (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,80}$'),  -- 'agaclar', 'agaclar-meyve'; URL-də də budur
  parent_id   text REFERENCES categories (id),                    -- NULL: əsas kateqoriya; dolu: alt kateqoriya
  kind        text NOT NULL CHECK (kind IN ('product', 'service')),
  form        text CHECK (form IN ('plant', 'pack', 'goods', 'grass', 'service')),  -- «Elan yerləşdir» forması
  name        jsonb NOT NULL CHECK (jsonb_typeof(name) = 'object' AND name ? 'az'),
  description jsonb,
  icon        text,                                               -- IconName (lucide)
  filters     jsonb NOT NULL DEFAULT '[]',                        -- [{ "id": "hundurluk", "enabled": true }, …] admin sırası ilə
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,                      -- false: saytdan çıxarılıb, köhnə elanlar qalır
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((parent_id IS NULL) = (form IS NOT NULL))                -- forma yalnız əsas kateqoriyada olur
);

CREATE TABLE cities (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),  -- 'baki', 'abseron'
  name        jsonb NOT NULL CHECK (jsonb_typeof(name) = 'object' AND name ? 'az'),
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);
```

- **Alt kateqoriya** eyni cədvəldədir: iki səviyyə, `parent_id` ilə. Xidmət növləri («Landşaft dizaynı», «Əkin», «Bağ baxımı») `landsaft-xidmetleri`-nin alt kateqoriyalarıdır. Indi onlar frontend-də ayrıca siyahıdır.
- **Atributlar** (hündürlük, yaş, kök sistemi…) bazada təyin olunmur, `form`-a görə kodda təyin olunur, indiki `src/features/posting/attributes.ts` kimi. Admin yalnız hansı filtrin görünəcəyini seçir (`filters`), indiki admin səhifəsi də belədir. Bax: qərar 2.
- **Rayon və kəndlər** hələlik elanda sərbəst mətndir (`listings.area`). Bakı rayonları üzrə filtr lazım olsa, `districts` cədvəli əlavə olunur.

### 3.2 Hesablar

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  phone         text UNIQUE CHECK (phone ~ '^\+994[0-9]{9}$'),     -- silinmiş hesabda NULL
  email         text CHECK (char_length(email) <= 254),
  email_verified_at timestamptz,
  password_hash text,                                             -- PBKDF2 (Identity hasher)
  full_name     text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 60),
  account_type  text NOT NULL CHECK (account_type IN ('individual', 'business')),
  role          text NOT NULL DEFAULT 'user'   CHECK (role IN ('user', 'moderator', 'admin')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'deleted')),
  locale        text NOT NULL DEFAULT 'az'     CHECK (locale IN ('az', 'ru', 'en')),  -- SMS və e-poçtun dili
  failed_logins smallint NOT NULL DEFAULT 0,
  locked_until  timestamptz,                                      -- çoxlu səhv şifrədən sonra
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CHECK (status = 'deleted' OR (phone IS NOT NULL AND password_hash IS NOT NULL))
);
CREATE UNIQUE INDEX ux_users_email ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE sessions (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,                             -- SHA-256(token); tokenin özü heç yerdə saxlanmır
  client       text NOT NULL CHECK (client IN ('web', 'ios', 'android')),
  device_name  text CHECK (char_length(device_name) <= 80),       -- «Chrome, Windows», «iPhone 15»
  ip_hash      bytea,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),                -- ən çox 5 dəqiqədən bir yazılır
  expires_at   timestamptz NOT NULL,                              -- son istifadədən 30 gün sonra (sürüşən)
  revoked_at   timestamptz                                        -- çıxış, «bu cihazdan çıx», şifrə dəyişməsi
);
CREATE INDEX ix_sessions_user ON sessions (user_id);

CREATE TABLE otp_challenges (
  id          uuid PRIMARY KEY,
  phone       text NOT NULL,
  purpose     text NOT NULL CHECK (purpose IN ('register', 'login', 'reset-password', 'change-phone')),
  code_hash   bytea NOT NULL,                                     -- HMAC-SHA256(server açarı, id + kod)
  attempts    smallint NOT NULL DEFAULT 0 CHECK (attempts <= 5),
  ip_hash     bytea,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,                               -- +5 dəqiqə
  verified_at timestamptz,
  consumed_at timestamptz                                         -- qeydiyyat və ya bərpa onu bir dəfə işlədir
);
CREATE INDEX ix_otp_phone ON otp_challenges (phone, created_at DESC);   -- «saatda 5, gündə 10» limitləri
CREATE INDEX ix_otp_ip    ON otp_challenges (ip_hash, created_at DESC);
CREATE INDEX ix_otp_created ON otp_challenges (created_at);             -- bütün saytın gündəlik limiti və 7 günlük təmizləmə

-- Mobil tətbiq gələndə (ARCHITECTURE.md §9)
CREATE TABLE devices (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_id   uuid REFERENCES sessions (id) ON DELETE CASCADE,
  platform     text NOT NULL CHECK (platform IN ('ios', 'android')),
  push_token   text NOT NULL UNIQUE,
  app_version  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
```

- **Bir telefon, bir hesab.** Nömrə SMS kodu ilə təsdiqlənmədən hesab yaranmır. Ona görə `users.phone` həmişə təsdiqlənmiş nömrədir.
- **SMS kodu outbox-dan getmir.** Kod istifadəçi gözləyərkən birbaşa provayderə göndərilir. Beləcə açıq kod heç vaxt bazaya yazılmır.

### 3.3 Satıcılar və şəkillər

```sql
CREATE TABLE sellers (
  id               uuid PRIMARY KEY,
  owner_user_id    uuid NOT NULL UNIQUE REFERENCES users (id),   -- bir istifadəçiyə bir biznes profili (qərar 1)
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,80}$'),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  business_kinds   text[] NOT NULL CHECK (cardinality(business_kinds) >= 1
                     AND business_kinds <@ ARRAY['nursery', 'garden-centre', 'landscaping']::text[]),  -- bir və ya bir neçəsi, hər biri bir dəfə, bu sırada
  city_id          text NOT NULL REFERENCES cities (id),
  address          text CHECK (char_length(address) <= 200),
  lat              numeric(8,6),
  lng              numeric(9,6),
  about            text CHECK (char_length(about) <= 2000),       -- satıcının yazdığı dildə
  terms            text CHECK (char_length(terms) <= 1000),
  hours            jsonb,                                         -- OpeningHours[]: [{ "day": 1, "open": "09:00", "close": "18:00" }, …]
  offers           text[] NOT NULL DEFAULT '{}'
                   CHECK (offers <@ ARRAY['delivery', 'planting', 'design', 'wholesale', 'care']::text[]),
  phone            text CHECK (phone ~ '^\+994[0-9]{9}$'),        -- biznesin nömrəsi; boşdursa sahibinin nömrəsi
  whatsapp         boolean NOT NULL DEFAULT false,
  email            text,
  contact_person   text,
  instagram        text,
  website          text,
  response_minutes int CHECK (response_minutes > 0),              -- «Adətən 1 saat ərzində cavab verir»
  logo_photo_id    uuid REFERENCES photos (id),
  cover_photo_id   uuid REFERENCES photos (id),
  verified_at      timestamptz,                                   -- «Təsdiqlənmiş satıcı»; NULL = təsdiqlənməyib
  verified_by      uuid REFERENCES users (id),
  created_at       timestamptz NOT NULL DEFAULT now(),            -- «2021-dən GreenStore-da» buradan
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((lat IS NULL) = (lng IS NULL))
);

CREATE TABLE photos (
  id                uuid PRIMARY KEY,
  owner_user_id     uuid NOT NULL REFERENCES users (id),
  purpose           text NOT NULL CHECK (purpose IN ('listing', 'seller-logo', 'seller-cover')),
  status            text NOT NULL CHECK (status IN ('awaiting-upload', 'processing', 'ready', 'failed')),
  upload_token_hash bytea,                                        -- birdəfəlik yükləmə tokeni (10 dəqiqə)
  upload_expires_at timestamptz,
  content_type      text,
  bytes             int CHECK (bytes <= 10485760),                -- 10 MB
  width             int,
  height            int,
  storage_key       text,                                         -- 'p/2026/11/<id>'
  variants          jsonb,                                        -- { "320": "…/320.webp", "640": "…", "1280": "…" }
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  attached_at       timestamptz                                   -- elana və ya profilə bağlananda; 24 saat NULL qalsa silinir
);
CREATE INDEX ix_photos_unattached ON photos (created_at) WHERE attached_at IS NULL;
```

- **Kontrakta uyğunluq.** `Seller.kind` («Tingçilik təsərrüfatı · Bağ mərkəzi») bazada saxlanmır. API onu `business_kinds`-dən sorğunun dilində doldurur. Biznesin bir neçə növü ola bilər (24 noyabr 2026, miqrasiya `MultipleBusinessKinds`): siyahı həmişə `nursery`, `garden-centre`, `landscaping` sırasındadır. Kataloqun `?businessKind=` süzgəci «bu növ də var» deməkdir: `'nursery' = ANY (business_kinds)`.
- **Hesablanan sahələr.** `Seller.memberSince` `created_at`-ın ilidir. `activeListings` sorğu ilə sayılır və 60 saniyə keşlənir.

### 3.4 Elanlar

```sql
CREATE TABLE listings (
  id                     uuid PRIMARY KEY,
  number                 bigint NOT NULL UNIQUE DEFAULT nextval('listing_number_seq'),
  slug                   text NOT NULL UNIQUE,                    -- 'zeytun-agaci-10482'
  kind                   text NOT NULL CHECK (kind IN ('product', 'service')),
  owner_user_id          uuid NOT NULL REFERENCES users (id),
  seller_id              uuid REFERENCES sellers (id),            -- biznes hesabında doldurulur
  category_id            text NOT NULL REFERENCES categories (id),
  subcategory_id         text REFERENCES categories (id),
  status                 text NOT NULL CHECK (status IN ('pending', 'active', 'rejected', 'expired', 'inactive')),

  title                  text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  description            text NOT NULL DEFAULT '' CHECK (char_length(description) <= 3000),

  -- Qiymət
  price_type             text NOT NULL CHECK (price_type IN ('fixed', 'negotiable', 'agreement')),
  price                  numeric(10,2) CHECK (price >= 0),        -- 'agreement'-də NULL (API 0 göndərir); xidmətdə «…-dən»
  price_unit             text CHECK (price_unit IN ('piece', 'kg', 'litre', 'sqm', 'bag', 'set', 'metre', 'hour', 'job')),
  wholesale_price        numeric(10,2) CHECK (wholesale_price > 0),
  wholesale_min_qty      int CHECK (wholesale_min_qty >= 2),
  quantity_available     int CHECK (quantity_available >= 0),
  availability           text CHECK (availability IN ('in-stock', 'on-order')),   -- «Satışdadır» / «Sifarişlə»
  pending_promotion_option_id text REFERENCES promotion_options (id),             -- yerləşdirəndə seçilib, təsdiqdən sonra ödənilir

  -- Yer və çatdırılma
  city_id                text NOT NULL REFERENCES cities (id),
  area                   text CHECK (char_length(area) <= 80),    -- «Məhəmmədi qəsəbəsi»
  delivery_available     boolean NOT NULL DEFAULT false,
  delivery_areas         text CHECK (char_length(delivery_areas) <= 120),
  planting_available     boolean NOT NULL DEFAULT false,

  -- Əlaqə
  contact_name           text NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 60),
  contact_phone          text NOT NULL CHECK (contact_phone ~ '^\+994[0-9]{9}$'),
  contact_phone_verified boolean NOT NULL,                        -- hesabın təsdiqlənmiş nömrəsidirmi (qərar 3)
  whatsapp               boolean NOT NULL DEFAULT false,
  phone_hidden           boolean NOT NULL DEFAULT false,

  -- Bitki: filtrə düşən faktlar ayrıca sütunda
  species                text CHECK (char_length(species) <= 60), -- 'Olea europaea'
  height_min_cm          int CHECK (height_min_cm > 0),
  height_max_cm          int,
  age_years              smallint CHECK (age_years >= 0),
  root_system            text CHECK (root_system IN ('container', 'rootball', 'bare-root')),
  plant                  jsonb,                                   -- qalan PlantFacts: potLitres, sun, water, frostHardinessC, foliage, plantingMonths
  attributes             jsonb NOT NULL DEFAULT '{}',             -- formanın xam dəyərləri (ListingInput.attributes)
  care_tips              text[] NOT NULL DEFAULT '{}',

  -- Xidmət
  service_city_ids       text[] NOT NULL DEFAULT '{}',            -- Service.areas; ad yox, id (adı dilə görə API verir)
  includes               text[] NOT NULL DEFAULT '{}',            -- «✓ …» siyahısı

  -- Axtarış, sıralama, reklam
  search_text            text NOT NULL DEFAULT '',                -- §4
  is_promoted            boolean NOT NULL DEFAULT false,          -- API-də `vip`
  promoted_until         timestamptz,                             -- boş: sonsuz (demo elanlar)
  promoted_at            timestamptz,                             -- işləyən «Önə çıxan» nə vaxt başlayıb: «Önə çıxan» qrupunun sırası (faza 5)
  sort_at                timestamptz,                             -- greatest(published_at, bumped_at): «Ən yenilər»

  -- Moderasiya
  rejection_reason_code  text CHECK (rejection_reason_code IN
                           ('wrong-category', 'wrong-price', 'unverified-contact', 'bad-photos', 'duplicate', 'other')),
  rejection_note         text CHECK (char_length(rejection_note) <= 500),

  -- Tarixlər
  created_at             timestamptz NOT NULL DEFAULT now(),
  edited_at              timestamptz,                             -- sahibin son redaktəsi və ya yeniləməsi: «Yeniləndi»
  submitted_at           timestamptz,                             -- son dəfə yoxlamaya göndərilib
  published_at           timestamptz,                             -- ilk təsdiq
  bumped_at              timestamptz,                             -- son «İrəli çək»
  expires_at             timestamptz,
  deleted_at             timestamptz,

  CHECK (price_type = 'agreement' OR price IS NOT NULL),
  CHECK (price_type <> 'agreement' OR price IS NULL),
  CHECK ((wholesale_price IS NULL) = (wholesale_min_qty IS NULL)),
  CHECK (height_max_cm IS NULL OR height_max_cm >= height_min_cm),
  CHECK (NOT phone_hidden OR whatsapp),                           -- nömrə gizlidirsə, alıcı yalnız WhatsApp-a yazır
  CHECK (status <> 'active' OR (published_at IS NOT NULL AND expires_at IS NOT NULL AND sort_at IS NOT NULL)),
  CHECK (status <> 'rejected' OR rejection_reason_code IS NOT NULL),
  CHECK (kind = 'service' OR (cardinality(service_city_ids) = 0 AND cardinality(includes) = 0)),
  CHECK (is_promoted = (promoted_at IS NOT NULL))                 -- ck_listings_promoted_at (faza 5)
);

-- Public sorğular (yalnız aktiv elanlar)
CREATE INDEX ix_listings_feed     ON listings (kind, is_promoted DESC, promoted_at DESC, sort_at DESC) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX ix_listings_category ON listings (category_id, sort_at DESC)            WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX ix_listings_search   ON listings USING gin (search_text gin_trgm_ops)   WHERE status = 'active' AND deleted_at IS NULL;
-- Kabinet, satıcı səhifəsi, moderasiya, fon işləri
CREATE INDEX ix_listings_owner      ON listings (owner_user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_listings_seller     ON listings (seller_id)             WHERE seller_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_listings_moderation ON listings (submitted_at)          WHERE status = 'pending' AND deleted_at IS NULL;
CREATE INDEX ix_listings_expiry     ON listings (expires_at)            WHERE status = 'active' AND deleted_at IS NULL;
```

**Niyə belə.**
- **Filtrə düşən bitki faktları ayrıca sütundadır:** növ, hündürlük, yaş, kök sistemi. Belə sütunu indeksləmək və `CHECK` ilə yoxlamaq olur. Yalnız göstərilən faktlar (günəş, su, şaxta) `plant` jsonb-dədir. Yeni bir fakt filtr olsa, sütuna keçirilir.
- **Qaralamalar `listings`-də deyil, `listing_drafts`-dadır** (§3.5). Qaralamada hər sahə boş ola bilər. Ayrı cədvəl sayəsində `listings`-in bütün `CHECK`-ləri sərt qalır. Kabinetdə qaralama yenə `status: 'draft'` kimi görünür, müqavilə dəyişmir.
- **Sayğaclar `listings`-də deyil, `listing_counters`-dədir** (§3.6). Hər baxış `listings` sətrini dəyişsəydi, `xmin` da dəyişərdi və elanı redaktə edən sahib ya moderator boş yerə «elan dəyişib» xətası alardı.
- **İndekslər.** 10 min sətirdə PostgreSQL çox vaxt cədvəli tam oxuyur və bu millisaniyələr çəkir. Yuxarıdakı indekslər əsas sorğular və 100 min+ üçün hazırlıqdır. Şəhər və qiymət indeksi indi lazım deyil. Yeni indeks yalnız `EXPLAIN ANALYZE` göstərəndə əlavə olunur.

**Həyat dövrü** ([ARCHITECTURE.md §6](ARCHITECTURE.md#6-elanın-həyat-dövrü)) C#-dakı `ListingLifecycle`-dadır. Baza yalnız nəticənin düzgün olmasını qoruyur. Məsələn, `active` elanda `expires_at` boş ola bilməz, `rejected` elanda səbəb boş ola bilməz.

### 3.5 Qaralamalar, şəkillər, tarixçə, moderasiya

```sql
CREATE TABLE listing_drafts (
  id            uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  listing_id    uuid REFERENCES listings (id) ON DELETE CASCADE,  -- mövcud elanın redaktəsidirsə
  data          jsonb NOT NULL,                                   -- wizard-ın vəziyyəti, olduğu kimi
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_drafts_owner ON listing_drafts (owner_user_id);

CREATE TABLE listing_photos (
  listing_id uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  position   smallint NOT NULL CHECK (position BETWEEN 0 AND 11),  -- 0 = örtük; ən çox 12 şəkil
  photo_id   uuid NOT NULL UNIQUE REFERENCES photos (id),
  PRIMARY KEY (listing_id, position)
);

CREATE TABLE listing_revisions (
  listing_id uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  revision   int NOT NULL,                                        -- 1, 2, 3 … hər göndərişdə
  data       jsonb NOT NULL,                                      -- göndərilən ListingInput və şəkil id-ləri
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, revision)
);

CREATE TABLE moderation_decisions (
  id           uuid PRIMARY KEY,
  listing_id   uuid NOT NULL,
  revision     int NOT NULL,
  moderator_id uuid NOT NULL REFERENCES users (id),
  decision     text NOT NULL CHECK (decision IN ('approve', 'reject')),
  reason_code  text CHECK (reason_code IN ('wrong-category', 'wrong-price', 'unverified-contact', 'bad-photos', 'duplicate', 'other')),
  note         text CHECK (char_length(note) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (listing_id, revision) REFERENCES listing_revisions (listing_id, revision),
  CHECK (decision = 'approve' OR reason_code IS NOT NULL)
);
CREATE INDEX ix_decisions_listing ON moderation_decisions (listing_id, created_at DESC);
```

- **`listing_revisions`** hər göndərişin surətini saxlayır (bax: qərar 4). Bunun üç faydası var:
  - moderator əvvəlki təsdiqlənmiş versiya ilə fərqi görür, məsələn «qiymət 145 → 120 ₼, 2 şəkil əlavə olunub», və tez qərar verir;
  - mübahisədə «elanda nə yazılmışdı» sualına cavab var;
  - turbo.az tətbiqindəki qiymət tarixçəsi sonra əlavə iş tələb etmədən buradan gəlir.
- **Admin-dəki `ModerationKind`** buradan hesablanır: `revision = 1` olanda `new` («Yoxlamada»), yoxsa `recheck` («Təkrar yoxlama»).
- **Şəkillərin sırası** dəyişəndə elanın `listing_photos` sətirləri bir tranzaksiyada silinib yenidən yazılır.
- **Versiyası (revision) olmayan köhnə elanlar** (seed-in demo elanları): redaktə olunanda və ya moderator qərar verəndə onların cari məzmunu əvvəlcə versiya 1 kimi yazılır. Beləcə qərar həmişə mövcud versiyaya bağlanır (FK), moderator da fərqi görür.
- **Elandan çıxarılan şəkil** silinmir: köhnə versiyalar ona istinad edir. Silinmiş elanın şəkilləri 6 aylıq saxlamadan sonra (§5) silinəcək; bu təmizləmə hələ yazılmayıb.

### 3.6 Sayğaclar və statistika

```sql
CREATE TABLE listing_counters (
  listing_id    uuid PRIMARY KEY REFERENCES listings (id) ON DELETE CASCADE,
  views         int NOT NULL DEFAULT 0,
  phone_reveals int NOT NULL DEFAULT 0,
  favourites    int NOT NULL DEFAULT 0
);

CREATE TABLE listing_daily_stats (
  listing_id    uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  day           date NOT NULL,                                    -- Bakı vaxtı ilə
  views         int NOT NULL DEFAULT 0,
  phone_reveals int NOT NULL DEFAULT 0,
  favourites    int NOT NULL DEFAULT 0,
  PRIMARY KEY (listing_id, day)
);

-- Eyni ziyarətçinin eyni gün təkrar baxışı bir dəfə sayılsın deyə. UNLOGGED: sürətlidir; çöküşdə itsə, problem deyil
CREATE UNLOGGED TABLE listing_seen (
  listing_id   uuid NOT NULL,
  visitor_hash bytea NOT NULL,                                    -- HMAC(sessiya, yoxdursa IP + brauzer)
  day          date NOT NULL,
  action       text NOT NULL CHECK (action IN ('view', 'reveal')),
  PRIMARY KEY (listing_id, visitor_hash, day, action)
);
```

**Bir baxış belə sayılır** (bir tranzaksiyada):

1. `INSERT INTO listing_seen … ON CONFLICT DO NOTHING` icra olunur.
2. Sətir yazılıbsa (bu gün ilk dəfədir), `listing_counters.views + 1` və `listing_daily_stats`-da günün sətrinə upsert edilir (`views + 1`).
3. Yazılmayıbsa, heç nə dəyişmir.

«Nömrəni göstər» də eyni yolla, `action = 'reveal'` ilə sayılır. Seçilmişlər sayğacı `favorites`-ə yazan tranzaksiyanın içində dəyişir. Günün `favourites` sütunu həmin gün əlavə olunan seçilmişləri sayır (silinmə onu azaltmır). Satıcı səhifəsində «Nömrəni göstər» sayılmır: onun üçün cədvəl yoxdur. Kod: `Modules/Listings/ListingCountersEndpoints.cs`, bir SQL ifadəsi (CTE) ilə.

### 3.7 Seçilmişlər, axtarışlar, şikayətlər

```sql
CREATE TABLE favorites (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,   -- xidmət də elandır
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX ix_favorites_listing ON favorites (listing_id);

CREATE TABLE saved_searches (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  query            text NOT NULL CHECK (char_length(query) <= 500), -- 'kateqoriya=agaclar&seher=baki'
  filter           jsonb NOT NULL,                                -- eyni sorğu, API-nin axtarış modelində
  alerts           boolean NOT NULL DEFAULT false,
  last_opened_at   timestamptz NOT NULL DEFAULT now(),            -- newCount: bundan sonra çıxan uyğun elanlar
  last_notified_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_saved_searches_user ON saved_searches (user_id);

CREATE TABLE reports (
  id               uuid PRIMARY KEY,
  target_kind      text NOT NULL CHECK (target_kind IN ('listing', 'seller', 'service')),
  listing_id       uuid REFERENCES listings (id),                 -- elan və ya xidmət
  seller_id        uuid REFERENCES sellers (id),
  reason_code      text NOT NULL CHECK (reason_code IN ('sold', 'wrong-price', 'wrong-photos', 'wrong-info', 'unreachable',
                     'duplicate', 'fraud', 'misconduct', 'not-provided', 'stolen-photos', 'other')),  -- backend-contract.md 4.1
  comment          text CHECK (char_length(comment) <= 500),
  reporter_user_id uuid REFERENCES users (id),                    -- qonaq da şikayət edə bilər
  reporter_ip_hash bytea,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  resolution       text CHECK (resolution IN ('action-taken', 'no-violation')),
  handled_by       uuid REFERENCES users (id),
  handled_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(listing_id, seller_id) = 1),
  CHECK ((target_kind = 'seller') = (seller_id IS NOT NULL)),
  CHECK (reason_code <> 'other' OR comment IS NOT NULL),
  CHECK (status <> 'resolved' OR resolution IS NOT NULL)
);
CREATE INDEX ix_reports_open    ON reports (created_at) WHERE status <> 'resolved';
CREATE INDEX ix_reports_listing ON reports (listing_id) WHERE listing_id IS NOT NULL;
```

**Şikayətin hədəfi iki ayrı FK sütunundadır:** `listing_id` və ya `seller_id`, həmişə yalnız biri dolu. Tək bir `target_id` sütunundan daha yaxşıdır, çünki silinmiş və ya mövcud olmayan hədəfə şikayət yazmaq olmur.

`status` dəyərləri admin-in indiki `ComplaintStatus`-u ilə eynidir. Səbəb kodu da başqa enum-lar kimi `CHECK` ilə yoxlanır (§2); hansı hədəfin hansı kodu seçə bildiyini C# (`ReportRules`) yoxlayır. Moderatorun qeydi və şikayətin tarixçəsi ayrıca sütunda deyil, `audit_log`-dadır (`report.update`: yeni status, əvvəlki status, `resolution`, qeyd).

### 3.8 Dəstək

«Usta çağır»ın `service_requests` və `service_request_recipients` cədvəlləri burada idi; 24 noyabr 2026-da çıxarılıb.

```sql
CREATE TABLE support_messages (
  id             uuid PRIMARY KEY,
  ticket         bigint NOT NULL UNIQUE DEFAULT nextval('support_ticket_seq'),
  topic          text NOT NULL CHECK (topic IN ('listing', 'account', 'payment', 'complaint', 'other')),
  name           text NOT NULL CHECK (char_length(name) <= 60),
  contact        text NOT NULL CHECK (char_length(contact) <= 254),  -- telefon və ya e-poçt
  message        text NOT NULL CHECK (char_length(message) <= 2000),
  listing_number bigint,
  user_id        uuid REFERENCES users (id),
  status         text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'answered', 'closed')),
  ip_hash        bytea,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

### 3.9 Reklam və ödəniş

```sql
CREATE TABLE promotion_packages (
  id         text PRIMARY KEY CHECK (id IN ('one-cixar', 'ireli-cek', 'paket')),
  name       jsonb NOT NULL,
  summary    jsonb NOT NULL,
  benefits   jsonb NOT NULL DEFAULT '[]',                         -- LocalizedText[]
  sort_order int NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE promotion_options (
  id         text PRIMARY KEY,                                    -- 'one-cixar-7'
  package_id text NOT NULL REFERENCES promotion_packages (id),
  label      jsonb NOT NULL,                                      -- «7 gün», «1 dəfə»
  price      numeric(10,2) NOT NULL CHECK (price > 0),
  days       smallint CHECK (days > 0),
  bumps      smallint CHECK (bumps > 0),
  sort_order int NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  CHECK (days IS NOT NULL OR bumps IS NOT NULL)
);

CREATE TABLE promotion_orders (
  id           uuid PRIMARY KEY,
  number       bigint NOT NULL UNIQUE DEFAULT nextval('promotion_order_number_seq'),
  listing_id   uuid NOT NULL REFERENCES listings (id),
  user_id      uuid NOT NULL REFERENCES users (id),
  option_id    text NOT NULL REFERENCES promotion_options (id),
  amount       numeric(10,2) NOT NULL CHECK (amount > 0),         -- alış anındakı qiymət; sonra qiymət dəyişsə də dəyişmir
  status       text NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  provider     text NOT NULL,                                     -- 'fake' (dev, staging), sonra real provayder
  provider_ref text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz,
  UNIQUE (provider, provider_ref),                                -- eyni ödəniş iki dəfə hesablanmır
  CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);
CREATE INDEX ix_orders_listing ON promotion_orders (listing_id);

CREATE TABLE payment_events (                                     -- provayderin hər callback-i olduğu kimi
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider     text NOT NULL,
  provider_ref text,
  event_type   text,
  payload      jsonb NOT NULL,
  signature_ok boolean NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE listing_promotions (
  id           uuid PRIMARY KEY,
  listing_id   uuid NOT NULL REFERENCES listings (id),
  order_id     uuid NOT NULL REFERENCES promotion_orders (id),
  kind         text NOT NULL CHECK (kind IN ('feature', 'bump')), -- «Önə çıxar» / «İrəli çək»; «paket» iki sətir yaradır
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  bumps_left   smallint NOT NULL DEFAULT 0,
  next_bump_at timestamptz,
  CHECK (ends_at > starts_at)
);
CREATE INDEX ix_promotions_listing ON listing_promotions (listing_id, ends_at);
CREATE INDEX ix_promotions_bump    ON listing_promotions (next_bump_at) WHERE bumps_left > 0;
```

- **`listings.is_promoted`, `promoted_until` və `promoted_at`** `listing_promotions`-dan hesablanan, sürət üçün təkrarlanan sahələrdir. Onları ödəniş təsdiqlənəndə və `Promotions` fon işi yeniləyir. Demo elanların `is_promoted`-i sonsuzdur (`promoted_until` boşdur): fon işi onlara toxunmur, «Önə çıxar» alanda da sonsuz qalır.
- **«Önə çıxan» qrupunun sırası** (faza 5, nəzərdən keçirmədən sonra): «Ən yenilər» və ana səhifənin «Önə çıxan elanlar» bloku (4 elan) `is_promoted DESC, promoted_at DESC, sort_at DESC, number DESC` ilə sıralanır. `promoted_at` yeni «Önə çıxar» başlayanda «indi» olur, işləyənin üstünə alınan günlər onu dəyişmir, nişan götürüləndə boşalır (`ck_listings_promoted_at`: yalnız `is_promoted` olanda dolu). Belə ki, son ödəyən elan, tarixi köhnə olsa da, ana səhifənin blokunda və kataloqun birinci səhifəsində olur; paketin vədi budur. Miqrasiya mövcud «Önə çıxan» elanlara `coalesce(published_at, submitted_at, created_at)` yazır, seed də elə edir, yəni demo elanların öz aralarında sırası dəyişmir. Rotasiya (çox ödəyən olanda ana səhifədə növbə ilə göstərmək) indi yoxdur: blokda son 4 ödəyən görünür.
- **Faza 5-də sxemə əlavələr** (yuxarıdakı SQL-dən əlavə, hamısı bütövlük üçün): adlarda `CHECK (name ? 'az')` (§2-nin qaydası: `ck_promotion_packages_name`, `…_summary`, `ck_promotion_options_label`), `benefits` massivdir, `promotion_options.id ~ '^[a-z0-9-]{1,40}$'`, `listing_promotions`-da `bumps_left >= 0`, `feature` sətrinin qaldırması yoxdur, qalan qaldırmanın vaxtı var, və `UNIQUE (order_id, kind)` (`ux_listing_promotions_order_kind`): ödənilmiş sifariş hər növü bir dəfə başladır, təkrar callback ikinci sətir yarada bilməz. `promotion_orders.number` `ux_promotion_orders_number`, `UNIQUE (provider, provider_ref)` `ux_promotion_orders_provider_ref` adlı unikal indeksdir.
- **Qaydalar** (`Modules/Promotion/PromotionRules.cs`): «Önə çıxar» işləyən «Önə çıxar»ın sonundan başlayır (günlər üst-üstə düşmür); «İrəli çək» ödənişlə dərhal qaldırır, qalanlar `days / bumps` fasilə ilə (`next_bump_at`), saytda olmayan elanın qaldırmaları elan qayıdana qədər gözləyir; `expires_at` ödənilən hər şeyin sonuna qədər uzanır və təsdiq onu qısaltmır.
- **`payment_events`** mübahisə və yoxlama üçündür: provayder nə göndərib və nə vaxt.
- **Balans** (turbo.az-dakı kimi) gələcəkdə `wallet_transactions` cədvəli ilə əlavə olunur. İndi lazım deyil.

### 3.10 Platforma

```sql
CREATE TABLE outbox (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type            text NOT NULL,                                  -- 'revalidate', 'email', 'push', 'sms-notice'
  payload         jsonb NOT NULL,
  attempts        smallint NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);
CREATE INDEX ix_outbox_due ON outbox (next_attempt_at) WHERE sent_at IS NULL;

CREATE TABLE audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES users (id),
  action        text NOT NULL,                                    -- 'listing.approve', 'category.update', 'user.block'
  target_type   text NOT NULL,
  target_id     text NOT NULL,
  data          jsonb,                                            -- nə dəyişdi
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_target ON audit_log (target_type, target_id, created_at DESC);
CREATE INDEX ix_audit_actor  ON audit_log (actor_user_id, created_at DESC);

CREATE TABLE idempotency_keys (
  scope           text NOT NULL,                                  -- istifadəçinin id-si, qonaqda IP hash
  key             text NOT NULL CHECK (char_length(key) <= 80),
  request_hash    bytea NOT NULL,                                 -- eyni açarla başqa sorğu gəlsə, 422
  response_status smallint,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);
```

`outbox` bazaya yazan əməliyyatla **eyni tranzaksiyada** doldurulur. Məsələn, moderator təsdiqləyəndə elanın statusu və «keşi yenilə» sətri birlikdə yazılır. Beləcə əməliyyat uğurlu olub xəbər itə bilməz və ya əksinə. SMS kodları bura yazılmır (§3.2).

## 4. Axtarış

**`search_text` necə yığılır.** Elan yazılanda və ya dəyişəndə C# `ListingSearchText.Build(...)` bu hissələri birləşdirir və normallaşdırır:
- başlıq;
- Latın növ adı;
- atributların göstərilən dəyərləri;
- kateqoriya, alt kateqoriya və şəhər adları **üç dildə**;
- `area`.

**Normallaşdırma:**
- kiçik hərfə çevirmək;
- ə→e, ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g;
- ё→е;
- qalan diakritikləri silmək.

Frontend-in `normalizeSearch` funksiyası da eyni işi görür. Test nümunələri hər iki tərəfdə eynidir, o cümlədən çətin hallar: «İ», «I», «ı» və «AĞAC» → «agac».

**Sorğu.** Axtarış sətri eyni üsulla normallaşdırılır və sözlərə bölünür. Hər söz üçün `search_text LIKE '%söz%'` şərti yazılır və şərtlər `AND` ilə birləşir. Bu, mock-dakı «hər söz tapılmalıdır» məntiqidir. `pg_trgm` GIN indeksi `LIKE '%…%'`-i sürətləndirir. 3 hərfdən qısa sözdə indeks kömək etmir, amma 10 min sətirdə bu fərq etmir.

**Yenidən yığmaq.** Admin kateqoriya və ya alt kateqoriya adını dəyişəndə həmin kateqoriyanın elanlarının `search_text`-i yenidən yığılır. Faza 4-də bu fon işində yox, adminin sorğusunun içində, 500-lük hissələrlə bir SQL ifadəsi ilə gedir (`Modules/Admin/SearchTextRebuilder.cs`): bir kateqoriyada ən çoxu bir neçə min elan olur və admin nəticəni dərhal görür. Şəhər adlarını dəyişən admin səhifəsi hələ yoxdur.

**Filtr sayları** (`getFacetCounts`) eyni filtrlə, `GROUP BY category_id` və `GROUP BY city_id` ilə hesablanır və 60 saniyə keşlənir.

## 5. Saxlama müddətləri və silmə (təklif)

| Məlumat | Nə qədər saxlanır | Sonra |
|---|---|---|
| `otp_challenges` | 7 gün | silinir |
| `sessions` | bitəndən və ya ləğvdən 30 gün sonra | silinir |
| `listing_seen` | 2 gün | silinir |
| `listing_daily_stats` | 13 ay | silinir (cəmi `listing_counters`-də qalır) |
| `photos` (elana bağlanmayan) | 24 saat | fayl və sətir silinir |
| `idempotency_keys` | 24 saat | silinir |
| `outbox` (göndərilib) | 30 gün | silinir |
| `payment_events` (imzası səhv) | 30 gün | silinir; yalnız ilk 2048 simvolu saxlanır (faza 5). İmzalı callback-lər «Ödəniş qeydləri»dir |
| Silinmiş elan | 6 ay | şəkillər yaddaşdan silinir, `contact_phone` və təsvir təmizlənir, nömrə və tarixçə qalır |
| `audit_log`, `moderation_decisions` | 2 il | silinir |
| Ödəniş qeydləri | qanunun tələb etdiyi qədər | hüquqşünas deyəcək |

**Hesab silinəndə** (bax: qərar 6):
- `status = 'deleted'` olur, `phone`, `email`, `password_hash` təmizlənir, ad «Silinmiş istifadəçi»yə çevrilir;
- elanlar silinir, sessiyalar ləğv olunur;
- sətir özü qalır, çünki ödənişlər, şikayətlər və moderasiya tarixçəsi ona bağlıdır.

Müddətləri hüquqşünas təsdiqləməlidir (Azərbaycanın şəxsi məlumatlar haqqında qanunu).

## 6. Miqrasiyalar, rollar, backup

**Miqrasiyalar.**
- EF Core miqrasiyaları `Data/Migrations`-dadır. Hər PR-da `dotnet ef migrations script` ilə SQL-ə baxılır. Tarixçə cədvəli `__ef_migrations_history`-dir (snake_case, digər cədvəllər kimi).
- Tətbiq olunmuş miqrasiya heç vaxt dəyişdirilmir, yeni miqrasiya yazılır.
- Qıran dəyişiklik üç addımla edilir:
  1. yeni sütun boş ola bilən kimi əlavə olunur;
  2. köhnə məlumat doldurulur;
  3. sonra məcburi edilir, köhnə sütun silinir.

  Beləcə deploy zamanı köhnə və yeni kod eyni bazada işləyə bilir.
- Miqrasiya deploy-un ayrıca addımıdır: `dotnet GreenStore.Api.dll migrate`, lokalda `dotnet run -- migrate` (ARCHITECTURE.md §16). Staging və Prod-da tətbiq başlayanda işləmir.

**Baza rolları** (ən az icazə prinsipi):

| Rol | Nə edə bilər | Kim işlədir |
|---|---|---|
| `greenstore_migrator` | cədvəllərin sahibi, DDL | yalnız deploy-un miqrasiya addımı |
| `greenstore_app` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, sequence-lər; DDL yox | API |
| `greenstore_readonly` | yalnız `SELECT` | analitika, dəstək |

**Backup.**
- İdarə olunan PostgreSQL-də gündəlik backup və nöqtəyə qədər bərpa (PITR), ən azı 7 gün.
- Həftədə bir dəfə `pg_dump` başqa yerə (başqa provayder və ya region) köçürülür.
- Ayda bir dəfə bərpa sınağı keçirilir: backup-ı yoxlamadan ona güvənmək olmaz.

## 7. İstinad məlumatı və seed

| Nə | Haradan | Hansı mühitdə |
|---|---|---|
| Kateqoriyalar, alt kateqoriyalar, şəhərlər, reklam paketləri | `seed/reference/*.json`, indiki `src/data/categories.ts`, `cities.ts`, `promotions.ts`-dən | **hamısında**, prod daxil. Yalnız yoxdursa yazılır, adminin dəyişikliyinin üzərinə yazmır |
| Nümunə elanlar, satıcılar, xidmətlər, istifadəçilər | `seed/demo/*.json`, `src/data`-dan | **yalnız dev və staging** |

Rus və ingilis adlarını (kateqoriya, şəhər, paket) kim yazacaq, bax: qərar 7.

## 8. Həcm (birinci il, təxmini)

| Cədvəl | Sətir | Qeyd |
|---|---|---|
| `listings` | ~30 000 | 10 000 aktiv, qalanı köhnə və silinmiş |
| `photos`, `listing_photos` | ~150 000 | fayllar yaddaşda (~100 GB), bazada yalnız sətir |
| `listing_daily_stats` | ≤ 3,6 milyon | yalnız baxış olan günlər yazılır, ~200 MB |
| `listing_seen` | ~100 000 / gün | 2 gün saxlanır |
| `users`, `sessions` | on minlərlə | |

**Nəticə.** Birinci il baza 5 GB-dan kiçik olacaq. Ən kiçik idarə olunan PostgreSQL planı kifayətdir.

## 9. Qərarlar

**Təsdiqlənib** (22 noyabr 2026):

1. **Bir istifadəçi, bir biznes profili**, frontend-dəki kimi. Filial və işçi hesabları yoxdur. Lazım olanda `seller_locations` və `seller_members` cədvəlləri əlavə olunur və sxemi qırmır.
2. **Atributlar kodda, bazada yox**, frontend-dəki kimi. Admin yalnız filtrləri açıb-söndürür.
3. **Başqa əlaqə nömrəsi** yazmaq olar. Belə elan moderatora «nömrə təsdiqlənməyib» işarəsi ilə göstərilir.
4. **Hər göndərişin surəti saxlanır** (`listing_revisions`).
5. **«Yenilə» elanı yuxarı qaldırmır.**

**Açıq qalır:**

- **Saxlama müddətləri və hesabın silinməsi** (§5): hüquqşünas təsdiqləməlidir. Kod təklif olunan müddətlərlə yazılır, sonra dəyişmək asandır.
- **Rus və ingilis adları:** kateqoriya, alt kateqoriya, şəhər və paket adlarının qaralamasını mən hazırlayıram. Rus və ingilis dilini doğma bilən biri onları yoxlamalıdır.
