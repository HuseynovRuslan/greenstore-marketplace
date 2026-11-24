# Deploy: sayt Vercel-də, API Railway-də (24 noyabr 2026)

Bu sənəd GreenStore-u işlədən və yeniləyən komanda üçündür: hansı hissə haradadır, necə yenilənir, loqlar haradadır, necə geri qaytarılır və nə açıq qalıb. Gizli dəyərlər burada yoxdur. Onlar yalnız Railway və Vercel-in dəyişənlərindədir.

## 1. Qısaca

| Hissə | Harada | Ünvan |
|---|---|---|
| Sayt (Next.js) | Vercel, `huseynovruslan` hesabı, layihə `greenstore-preview`, branch `main` | <https://greenstore-preview.vercel.app> |
| API (ASP.NET Core) | Railway, «BAX MMC's Projects» → layihə `greenstore` → servis `api`, branch `main`, qovluq `/backend`, region `europe-west4` | <https://api-production-dc0137b1.up.railway.app> |
| Baza | Railway, eyni layihədə servis `Postgres` (PostgreSQL 16) | yalnız Railway-in daxili şəbəkəsindən |
| Şəkillər | Railway, `api` servisinin `media` volume-u (`/data/media`, 500 MB) | `…/media` |

- Sayt `DATA_SOURCE=api` rejimindədir: məlumatı API-dən alır. Demo elanlar API-nin bazasındadır (`Seed__Demo=true`).
- SMS göndərilmir: `Sms__Provider=log`, kod yalnız API-nin loquna yazılır (§5).
- Əvvəlcə API QRLog-un VPS-inə qurulmuşdu. Sonra qərar dəyişdi: API Railway-də qalır. VPS-dəki GreenStore silinib (§8).

## 2. Railway: `api` servisi

- **Build:** `backend/Dockerfile`. Yalnız `/backend/**` dəyişəndə yenidən build olunur.
- **Deploy-dan əvvəl:** `dotnet GreenStore.Api.dll migrate` işləyir. Bu, miqrasiyaları tətbiq edir və seed-i yazır. Seed yalnız olmayan sətirləri əlavə edir, mövcud sətrə toxunmur.
- **Healthcheck:** `/health/ready`. Baza əlçatan deyilsə və ya miqrasiya qalıbsa, 503 qaytarır.

Dəyişənlər (gizli olanların yalnız adı yazılıb):

| Dəyişən | Dəyər |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__Default`, `Internal__ApiKey`, `Otp__HmacKey`, `Revalidation__Secret` | gizli |
| `Frontend__BaseUrl` | `https://greenstore-preview.vercel.app` (24 noyabrda əlavə olundu) |
| `Media__Storage` / `Media__LocalPath` | `local` / `/data/media` |
| `Media__BaseUrl` | `https://api-production-dc0137b1.up.railway.app/media` |
| `Media__UploadBaseUrl`, `Payments__PublicBaseUrl` | `https://api-production-dc0137b1.up.railway.app` |
| `Seed__Reference` / `Seed__Demo` / `Seed__DevAccounts` | `true` / `true` (24 noyabrda yandırıldı) / `false` |
| `PORT` | `8080` |

`Sms__Provider`, `Payments__Provider` və `Otp__ExposeDemoCode` yazılmayıb. Ona görə `appsettings.json`-dakı standart dəyərlər işləyir: `log`, `fake`, `false`.

## 3. Vercel: `greenstore-preview` dəyişənləri

| Dəyişən | Production | Preview və Development |
|---|---|---|
| `DATA_SOURCE` | `api` | `mock` |
| `API_BASE_URL`, `API_PUBLIC_URL` | `https://api-production-dc0137b1.up.railway.app` | yoxdur |
| `MEDIA_BASE_URL` | `https://api-production-dc0137b1.up.railway.app/media` | yoxdur |
| `NEXT_PUBLIC_SITE_URL` | `https://greenstore-preview.vercel.app` | yoxdur |
| `API_INTERNAL_KEY` | Railway-in `Internal__ApiKey`-i (Sensitive) | yoxdur |
| `REVALIDATE_SECRET` | Railway-in `Revalidation__Secret`-i (Sensitive) | yoxdur |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | `true` |
| `SEO_INDEXABLE` | `false` | `false` |

Branch preview-ları əvvəlki kimi mock məlumatla işləyir. İki gizli açar Railway CLI-dan birbaşa `vercel env add`-a ötürülüb, heç yerdə göstərilməyib. Sensitive dəyişən Vercel-də sonradan oxunmur. Railway-də açar dəyişsə, Vercel-də də yenidən yazılmalıdır (§4).

## 4. Yeniləmə

- `main`-ə push edəndə hər iki tərəf avtomatik yenilənir. Railway `backend/` dəyişibsə API-ni yenidən qurur, Vercel isə saytı.
- Saytın build-i API-yə müraciət edir, ona görə build zamanı API işləməlidir. API-nin müqaviləsi dəyişirsə, əvvəl API deploy olunsun, sonra sayt.
- Dəyişəni dəyişdirəndən sonra saytı yenidən qurmaq üçün: `npx vercel redeploy <son production deployment-in ünvanı>`.
- Açarı yeniləmək üçün: Railway-də yeni dəyər yazın. Vercel-də isə köhnəni silib eyni dəyəri əlavə edin, məsələn `npx vercel env rm API_INTERNAL_KEY production` və `npx vercel env add API_INTERNAL_KEY --environment production --sensitive`. Sonra hər iki tərəfi redeploy edin.

## 5. Loqlar və əmrlər

Railway CLI-da girişiniz olmalıdır: `npx @railway/cli login`.

```bash
# API-nin loqu
npx @railway/cli logs -p 3222c104-bc3d-4f31-8b15-141c05859b71 -e production -s api -n 200

# SMS kodu: nömrə maskalıdır, kod mətnin içindədir (PowerShell-də: | Select-String "SMS not sent")
npx @railway/cli logs -p 3222c104-bc3d-4f31-8b15-141c05859b71 -e production -s api -n 500 | grep "SMS not sent"

# Saytın loqu
npx vercel logs https://greenstore-preview.vercel.app
```

Qeydiyyatdan sonra hesabı admin etmək. Postgres konteynerinə girin: `npx @railway/cli ssh -p 3222c104-bc3d-4f31-8b15-141c05859b71 -e production -s Postgres`. Orada `psql` açın və bu əmri yazın:

```sql
UPDATE users SET role='admin' WHERE phone='+994XXXXXXXXX';
```

Rollar: `user`, `moderator`, `admin`. Nömrə `+994` və 9 rəqəm formatındadır. Bu yol 24 noyabrda sınanmayıb. `psql` bazanı tapmasa, Railway-də Postgres servisinin Variables bölməsindəki `PGUSER` və `PGDATABASE` ilə qoşulun: `psql -U <PGUSER> -d <PGDATABASE>`.

## 6. Geri qaytarma

- **Saytı köhnə mock rejiminə qaytarmaq:** Vercel-də Production `DATA_SOURCE`-u `mock` edin (`npx vercel env add DATA_SOURCE --environment production --value mock --force`), sonra redeploy edin. Ya da Vercel-də əvvəlki production deployment-i "Promote" edin, məsələn `greenstore-preview-kn82eiufz-huseynovruslan.vercel.app`.
- **API:** Railway → `api` → Deployments → əvvəlki deploy → Rollback. Miqrasiyalar geri qaytarılmır.
- **Demo məlumat:** `Seed__Demo=false` yeni demo sətrinin yaranmasının qarşısını alır, amma mövcud demo sətirləri silmir.

## 7. Açıq risklər

| Risk | Nə etmək |
|---|---|
| Vercel funksiyaları `iad1` regionunda (ABŞ, Vaşinqton) işləyir, API isə Avropadadır (`europe-west4`). Səhifənin hər API sorğusu okeanı keçir | Vercel → Settings → Functions → Region: `fra1` |
| API `Production` rejimindədir: saxta ödəniş işləmir, «Önə çıxar» almaq `503 payment.unavailable` qaytarır. İlk plan Staging idi | demo üçün `ASPNETCORE_ENVIRONMENT=Staging` (OpenAPI də açılır) və ya real ödəniş provayderi |
| SMS getmir, kod yalnız loqdadır. Loqa girişi olmayan heç kim qeydiyyatdan keçə bilməz | real SMS provayderi ([backend-status.md](backend-status.md) §9.1) |
| `Seed__Demo=true` açıqdır: silinmiş demo elan növbəti deploy-da geri qayıdır | ilk yoxlamadan sonra `false` |
| Şəkillər bir volume-dadır (500 MB), CDN və backup yoxdur | S3 və CDN ([backend/README.md](../../backend/README.md) §13) |
| Bazanın backup-ı yoxlanmayıb | Railway-in backup ayarı və ya gündəlik `pg_dump` |
| Vercel layihəsi şəxsi Hobby hesabındadır. Başqa üzv əlavə etmək olmur, giriş hesabın özü ilə edilir | Pro komanda və ya layihəni komandaya köçürmək |
| `API_INTERNAL_KEY` ilə `Internal__ApiKey`-in eyniliyi ötürmə zamanı təmin olunub, sonradan yoxlana bilmir (Sensitive). Uyğun gəlməsə, API ziyarətçinin IP-sini qəbul etmir və bütün sayt bir IP sayılır | açarı dəyişəndə hər iki tərəfi birlikdə yeniləyin (§4) |
| DataProtection açarları konteynerin içindədir (loqda xəbərdarlıq var). API sessiyaları bazadadır, ona görə indi təsiri yoxdur | lazım olsa, açarları volume-a yazmaq |

## 8. VPS cəhdi (arxiv)

- API 24 noyabrda QRLog-un VPS-inə (`greenstore-api.qrlog.az`) qurulub yoxlanmışdı: konteynerlər işləyirdi, `/health/ready` 200 idi, Caddy bloku hələ əlavə olunmamışdı.
- Həmin gün qərar dəyişdi və server admini GreenStore-u sildi: konteynerlər, volume-lar və `/opt/greenstore`. Bazanın nüsxəsi serverdə `~/backups-greenstore/greenstore-vps-20261124_125941.sql.gz` faylındadır.
- `backend/deploy/` qovluğu (compose, `deploy.sh`, README) yalnız `deploy/vps` branch-indədir və indi işlədilmir. VPS-ə qayıtmaq lazım olsa, oradan başlamaq olar. QRLog serverinin qaydaları o README-dədir.
