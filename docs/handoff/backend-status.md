# Backend: gecə işinin nəticəsi (22–23 noyabr 2026)

Bu sənəd sahib üçündür: nə hazırdır, necə işə salınır, nə qalıb və sizin edəcəyiniz dörd iş (SMS, ödəniş, deploy, tərcümələr). Texniki təfərrüat: [backend/README.md](../../backend/README.md), [ARCHITECTURE.md](../../backend/ARCHITECTURE.md), [DATABASE.md](../../backend/DATABASE.md), müqavilə: [backend-contract.md](backend-contract.md).

## 1. Qısaca

- **Bütün 6 faza (0–5) yazılıb və yoxlanıb.** Sayt `DATA_SOURCE=api` rejimində real backend (ASP.NET Core 10 + PostgreSQL 16) ilə işləyir: qeydiyyat, giriş, «mağaza» açmaq, elan yerləşdirmək (şəkillə), moderasiya, kataloq, «Nömrəni göstər», seçilmişlər, şikayət, «Usta çağır», dəstək, admin paneli, reklam (saxta ödənişlə).
- **Sizin əsas istəyiniz** (insanlar elan yerləşdirə və mağaza aça bilsin) **kodda hazırdır**: bu gecə brauzerdə həm biznes, həm fərdi hesabla başdan sona yoxlandı (§2).
- **Real istifadəçilər üçün internetdə açmaqdan əvvəl iki şey mütləqdir:** hostinq (§9.3) və real SMS provayderi (§9.1). SMS olmadan heç kim qeydiyyatdan keçə bilməz: Development-dən başqa mühitdə kod ekranda göstərilmir, yalnız API-nin loquna yazılır.
- `DATA_SOURCE=mock` (standart) əvvəlki kimi işləyir, köhnə testlərin hamısı yaşıldır.

## 2. Gecə yoxlaması (end-to-end)

API `:5080`-də (Development, seed edilmiş dev bazası, əvvəl `migrate`), sayt `:3100`-də (`DATA_SOURCE=api`, production build + `next start`). Brauzer avtomatik idarə olundu (Playwright, ekran şəkli çəkilmədi), əlavə yoxlamalar `curl` ilə.

| # | Addım | Nəticə |
|---|---|---|
| 1 | Biznes hesabı: `/qeydiyyat`, ekrandakı demo SMS kodu ilə | keçdi |
| 2 | `/kabinet/profil`-də mağazanın şəhəri, ünvanı, «haqqında» mətni | keçdi («Dəyişikliklər saxlanıldı») |
| 3 | `/saticilar/<slug>` açılır, məlumatlar görünür; `/saticilar?seher=quba`-da var | keçdi |
| 4 | Biznes elanı şəkillə (sihirbaz, şəkil brauzerdən birbaşa API-yə) | keçdi (Elan № 20338) |
| 5 | «Elanlarım»da «Yoxlamada» | keçdi |
| 6 | Fərdi hesab: qeydiyyat və iki şəkilli elan | keçdi (Elan № 20339) |
| 7 | Yoxlamadakı elan saytda görünmür | keçdi |
| 8 | Dev moderator `/idareetme/moderasiya`-da hər ikisini təsdiqləyir | keçdi |
| 9 | Hər iki elan `/elanlar`-da, öz səhifəsində (yüklənən şəkillə, HTML-də nömrə yoxdur); biznesinki mağaza səhifəsində | keçdi |
| 10 | Ana səhifə | keçdi |
| 11 | Kataloq filtrləri: kateqoriya + şəhər, axtarış, `/kateqoriyalar/agaclar/quba` | keçdi (ikinci cəhddə, aşağıya bax) |
| 12 | «Nömrəni göstər» (qonaq) düzgün nömrəni verir | keçdi |
| 13 | Şikayət («Elandan şikayət et») qonaq kimi; admin onu `/idareetme/sikayetler`-də görür | keçdi (ikinci cəhddə) |
| 14 | «Usta çağır» xidmət səhifəsindən | keçdi (Sorğu № 3009, ustaya SMS xəbəri outbox-dan getdi) |
| 15 | Telefon və şifrə ilə giriş | keçdi |
| 16 | Seçilmişlərə əlavə; yenidən yükləmədən sonra `/secilmisler`-də | keçdi |
| 17 | Reklam: `/reklam` → «9 ₼ ödə» → «Test ödənişi» səhifəsi → «Ödə» → `/kabinet/odenis` «Ödəniş qəbul olundu»; elan «Önə çıxan» və siyahıda birinci | keçdi (Sifariş № 1001) |
| 18 | Admin paneli (`/idareetme`, «İcmal» rəqəmləri) | keçdi |
| 19 | `curl`: sahibin statistikası (1 baxış, 1 «Nömrəni göstər»), dəstək (bilet № 1006), keş xəbərləri sayta çatdı, elanın silinməsi (sonra 404) | keçdi |

**Brauzerdəki 26 addımın hamısı keçdi, `curl` yoxlamaları da.** Üç addım (11, 13 və ona bağlı admin yoxlaması) ilk dəfə yoxlama skriptinin öz xətası ilə alınmadı: skript səhifənin axınla yüklənməsini gözləmədən mətni oxumuşdu və gizli radio düyməsinə birbaşa klikləmişdi. Skript düzəldildi, ikinci dəfə keçdi; saytda dəyişiklik lazım olmadı.

**Dev bazasında qalanlar** (yoxlamadan sonra): iki test hesabı, «Yoxlama Tingçilik 3345» (+994 55 542 16 74) və «Tural Məmmədov» (+994 50 651 29 53), şifrələri `Yoxlama-2026`; onların elanları (№ 20338, № 20339) silinib. Şikayət, sorğu № 3009, bilet № 1006 və ödənilmiş sifariş № 1001 də qalıb. Əvvəlki fazaların test hesabları və elanları da dev bazasındadır (məsələn № 20322–20333).

## 3. Nə hazırdır (fazalar üzrə)

| Faza | Nə edir | API | Sayt |
|---|---|---|---|
| **0. Skelet** | layihə, baza, sağlamlıq yoxlaması, xəta formatı, dil seçimi (az/ru/en), testlər, CI | ✓ | — |
| **1. Oxuma** | kateqoriyalar, şəhərlər, ana səhifə, kataloq və filtrlər, elan, satıcı, xidmət, sitemap; nömrələr səhifədə yoxdur | ✓ | ✓ |
| **2. Hesablar** | SMS kodu, qeydiyyat (biznes «mağaza»nı dərhal açır), şifrə və SMS ilə giriş, şifrə bərpası, profil, «mağaza»nın redaktəsi, seçilmişlər, axtarışlar | ✓ | ✓ |
| **3. Elan dövrü** | şəkil yükləmə və emalı, elan yerləşdirmə, «Elanlarım» (redaktə, yenilə, deaktiv, sil), moderasiya, 30 günlük müddət, statistika, «Nömrəni göstər», keşin yenilənməsi | ✓ | ✓ |
| **4. Qalanlar** | şikayətlər, «Usta çağır» (ustalara SMS xəbəri), ustanın «Gələn sorğular» səhifəsi (`/kabinet/sorgular`), dəstək, admin paneli: rəqəmlər, şikayətlər, kateqoriyalar (üç dildə), satıcı təsdiqi, bloklama | ✓ | ✓ |
| **5. Ödəniş** | reklam paketləri, sifariş, saxta ödəniş səhifəsi, «Önə çıxan» və «İrəli çək», fon işi | ✓ | ✓ |

Hər fazanı ayrıca agent yazdı, başqa agent yoxladı; tapılan ciddi xətalar düzəldildi, kiçik qeydlər §7-dədir.

## 4. Lokalda necə işə salmaq

1. **Baza (PostgreSQL 16).** Docker varsa, `backend/`-da: `docker compose up -d postgres`. Docker yoxdursa, bir dəfə (superuser ilə):
   ```sql
   CREATE ROLE greenstore LOGIN PASSWORD 'greenstore_dev' CREATEDB;
   CREATE DATABASE greenstore OWNER greenstore TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C.UTF-8';
   ```
2. **API.** `cd backend && dotnet run --project src/GreenStore.Api` → <http://localhost:5080>. Development-də miqrasiyalar və nümunə məlumat özü yazılır. Saytı `3100`-də yoxlayacaqsınızsa, əvvəlinə `Frontend__BaseUrl=http://localhost:3100` yazın (keş xəbərləri və ödənişdən qayıdış üçün).
3. **Sayt API ilə** (repo kökündən, başqa terminalda):
   ```bash
   DATA_SOURCE=api API_BASE_URL=http://localhost:5080 API_INTERNAL_KEY=dev-internal-key REVALIDATE_SECRET=dev-revalidate-secret npm run dev
   ```
   Production kimi yoxlamaq: eyni dəyişənlərlə `npm run build`, sonra `npm start -- -p 3100`. API build zamanı da işləməlidir. Mock və API build-ləri eyni `.next` qovluğunu paylaşır: rejimi dəyişəndə əvvəlki `next start`-ı dayandırın.
4. **Hesablar** (yalnız Development):
   - admin: `admin@greenstore.local` / `Admin-dev-2026` (tel. +994 50 000 00 01);
   - moderator: `moderator@greenstore.local` / `Moderator-dev-2026` (tel. +994 50 000 00 02);
   - demo satıcı «Abşeron Tingçilik»: +994 50 555 12 34, SMS kodu ilə giriş;
   - yeni hesab: `/qeydiyyat`, SMS kodu ekranda «SMS göndərilmir, kod: 1234» kimi görünür.

## 5. Testlər

| Yoxlama | Nəticə (bu gecə, son işdə) |
|---|---|
| `dotnet test backend` | **1426** test keçdi, 0 xəta (unit + real PostgreSQL-də inteqrasiya) |
| `npm test` | **628** test keçdi (60 fayl) |
| `npm run lint`, `npm run typecheck`, `npm run build` | keçdi |
| `dotnet build backend` (0 xəbərdarlıq), `dotnet format backend --verify-no-changes` | keçdi |

Qeyd: faza 5-in yoxlamasında `dotnet test`-in 5 işindən biri bütün testlər keçsə də «catalogue» test bazasının təmizlənməsində xəta ilə bitdi; təkrarlanmadı, səbəbi tapılmadı (§7).

## 6. Nə hazır deyil və ya müvəqqətidir

**Sizin qərarınızı gözləyənlər** (dediyiniz kimi, özünüz edəcəksiniz):
- **Real SMS:** kodlar indi loqa yazılır (`Sms:Provider = log`). §9.1.
- **Real ödəniş:** saxta provayder işləyir, yalnız Development və Staging-də. Production-da reklam satılmır (paketlər boş, sifariş `503`). §9.2.
- **Hostinq və deploy:** server seçilməyib. `Dockerfile` və `docker-compose.yml`-in `api` servisi yazılıb, amma **yoxlanmayıb** (burada Docker işləmir). §9.3, §12.
- **Rus və ingilis mətnləri:** qaralamadır, sayt hələ yalnız Azərbaycan dilindədir. §9.4.
- **Hüquqi baxış:** məlumatların saxlanma müddətləri (DATABASE.md §5), şəxsi məlumatların hansı ölkədə saxlanacağı, ödəniş qeydlərinin müddəti hüquqşünas gözləyir.

**Yazılmayan və ya yarımçıq qalanlar:**
- «Gələn sorğular» (ustanın sorğuları) **hazırdır**: əvvəlki planda yox idi, SMS yalnız loqda olduğu üçün faza 4-də `/kabinet/sorgular` əlavə olundu.
- Mağazanın loqo və örtük şəkli: şəkil yüklənir, amma mağazaya bağlamaq olmur (`PATCH /me/seller`-də sahə yoxdur), ona görə yeni mağaza şəkilsizdir (səhifə bunu düzgün göstərir).
- Silinmiş elanların 6 aydan sonra təmizlənməsi (şəkil faylları, nömrə) yazılmayıb; digər təmizləmələr işləyir.
- İstifadəçinin öz hesabını silməsi, «Aktiv cihazlar» səhifəsi (API var, UI yox), adminin «Elanı dayandır» düyməsi, «İstifadəçilər» siyahısı, dəstək mesajlarının admin siyahısı (yalnız sayı var), sorğunu «bağlandı/spam» etmək, reklamın geri qaytarılması (`refunded`) və ləğvi.
- Sihirbazın serverdə saxlanan qaralamaları (API var, sayt qaralamanı brauzerdə saxlayır), admin yaratdığı kateqoriyaların sayt menyusunda və sihirbazda görünməsi (sayt kateqoriyaları hələ `src/data`-dan oxuyur).
- «Bu cihazda məni xatırla» işarəsi heç nə etmir (sessiya həmişə 30 gün).
- Fərdi ustaların «təsdiqlənmiş» nişanı API rejimində yoxdur (bazada belə sahə yoxdur); xidmət səhifəsinin portfolio və iş saatları API rejimində görünmür.
- Qonaq API rejimində seçilmişlərini kart kimi görmür, giriş etməlidir (ürəklər qalır, girişdə hesaba keçir).
- S3 şəkil yaddaşı yazılıb, amma real bucket ilə yoxlanmayıb.
- Mobil tətbiq üçün push və cihazlar (sonrakı mərhələ).

## 7. Gecə agentlərin verdiyi qərarlar (əsasları)

Tam siyahı hər fazanın yoxlama hesabatındadır; burada sizin bilməli olduqlarınız:

1. **Müqavilə dəyişiklikləri** (`src/types`, `repository.ts`): backend-contract.md-dəki bütün bəndləri siz 22 noyabrda gecə işini başladanda təsdiq etdiniz («Frontend qoşulsun, backend-contract.md-dəki dəyişikliklər təsdiqlənir» sualına «Bəli, qoş»). Gecə agentləri bunu yalnız tapşırığın mətnində gördükləri üçün yenidən təsdiq istəyirdilər; lazım deyil. **Diqqət (Issue #5):** issue «mövcud `MarketplaceRepository` müqaviləsini sabit saxla, əlavə dəyişikliyə üstünlük ver» deyir, amma ⚠ ilə işarələnmiş bəndlər geri uyğun deyil: 1.1 (hər şeyi birdən qaytaran metodlar), 1.2 (slug-da nömrə, köhnə ünvanlar `permanentRedirect` ilə yönləndirilir), 2.2 (`listOwnListings()` parametrsiz), 3.1 (nömrələr public tiplərdən çıxıb, `revealPhone`/`revealSellerPhone`), 3.5 (rədd səbəbləri kod) və 4.1 (şikayət səbəbi kod). Bunlar repodakı bütün çağırışlarla birlikdə dəyişdirilib, testlər yaşıldır; başqa istehlakçı (məsələn, ayrıca mobil tətbiq) hələ yoxdur.
2. **Telefon nömrələri** səhifənin HTML-ində yoxdur, yalnız «Nömrəni göstər» basanda verilir (mock rejimində də).
3. **Biznes qeydiyyatı** «mağaza»nı dərhal açır; ünvanı şirkət adından yaranır (`yoxlama-tingcilik-3345`) və ad dəyişəndə dəyişmir.
4. **SMS kodu:** 4 rəqəm, 5 dəqiqə, 5 cəhd; nömrəyə 60 saniyədə bir, saatda 5, gündə 10; yalnız +994 mobil nömrələr; bütün sayt üçün gündə 2000 kod.
5. **Şifrə:** 8–128 simvol, hərf və rəqəm. 5 səhvdən sonra hesab 15 dəqiqə bağlanır. Sessiya son istifadədən 30 gün yaşayır.
6. **Elan:** hər yeni və redaktə olunan elan moderasiyadan keçir (aktiv elan yoxlanana qədər gizlənir); 30 gün; dərc olunandan sonra kateqoriyası dəyişmir; hesabdan gündə ən çox 30 yeni elan.
7. **Şəkillər:** JPEG, PNG, WebP; ≤ 10 MB; qısa tərəf ≥ 600 px. EXIF və GPS silinir, 320/640/1280 px WebP saxlanır, orijinal saxlanmır.
8. **Ana səhifə** avtomatik qurulur: 4 ən yeni «Önə çıxan», 8 son elan, ən çox elanı olan 3 təsdiqlənmiş satıcı, 3 yeni xidmət.
9. **«Razılaşma ilə»** qiymətli elanlar qiymət filtrinə düşmür və qiymət sıralamasında sonda gəlir.
10. **«Usta çağır»:** usta seçilməyibsə həmin növün və şəhərin ən çox 10 ustasına gedir; ustalara gündə ən çox 500 SMS xəbəri.
11. **Bloklama:** hesabın sessiyaları bağlanır, elanları saytdan çıxır; açanda geri qayıdır.
12. **Reklam:** «Önə çıxan» qrupunda son ödəyən birinci olur; ödəniş xəbəri təkrar gəlsə, bir dəfə tətbiq olunur. Qiymətlər mock-dakıdır (məsələn «Önə çıxar 7 gün» 9 ₼).
13. **Profil:** fərdi hesabın «Şəhər» və «Ünvan» sahələri API rejimində gizlədilib (bazada yeri yoxdur); bildiriş açarları brauzerdə saxlanır.
14. **CI** (`.github/workflows/backend.yml`) push-da yalnız `main` üçün işləyir; iş budağında yalnız PR açılanda.
15. **Test üçün frontend dəyişikliyi:** `src/components/motion/MotionFeatures.tsx` və `MotionProvider.tsx`-ə test mühitinin bir problemi üçün kiçik kod əlavə olunub; brauzerdə heç nə dəyişmir, `MotionConfig reducedMotion="user"` qalıb.
16. **CLAUDE.md:** ARCHITECTURE.md qərar 6 (backend dəyişəndə `dotnet build backend`, `dotnet test backend`) sizin razılığınızla gecədən əvvəl, `409c20c` commit-ində CLAUDE.md-yə yazılıb. Gecə agentləri CLAUDE.md-yə toxunmayıb.
17. **Commit-lər:** hər fazanın commit agenti CLAUDE.md-dəki «Commit yalnız mənim OK-dan sonra» qaydasına görə commit etməkdən imtina etdi (icazənizi yalnız tapşırığın mətnində görürdü). Ona görə commit və push-u əsas sessiya sizin «Hər fazadan sonra commit + push» cavabınızla etdi, hər dəfə müstəqil yoxlama 7 yoxlamanı yaşıl tapandan sonra: `8f54328` (faza 0–3 birlikdə), `47bcd61` (faza 4), `332febd` (faza 5), sonra bu hesabat. Hamısı `ccr-ad73023d-p9lu9p` budağındadır, `main`-ə heç nə birləşdirilməyib.

**Bu son addımda:** test hesablarının elanları yoxlamadan sonra silindi ki, lokalda sizə qarışmasın; hesablar qaldı. `docker-compose.yml`-ə `api-migrate` (miqrasiya, sonra çıxır) və `api` servisləri əlavə olundu, `postgres` servisi dəyişmədi; README-də `docker compose up -d` artıq `docker compose up -d postgres`-dir.

## 8. Növbəti addımlar

1. Hostinqi seçin (§9.3) və Staging qurun; `Dockerfile`-ı ilk dəfə orada build edin.
2. SMS provayderi ilə müqavilə, sinfi yazmaq (§9.1), Staging-də real nömrəyə yoxlama.
3. Staging-də bütün yolu əl ilə keçin: qeydiyyat → mağaza → elan → moderasiya → kataloq.
4. Production: `NEXT_PUBLIC_DEMO_MODE=false`, `SEO_INDEXABLE=true`, `Seed__Demo=false`, backup-lar (§9.3).
5. Ödəniş provayderi (§9.2) və real reklam qiymətləri.
6. Rus və ingilis mətnlərini doğma danışana yoxlatmaq (§9.4), sonra saytın tərcüməsi.
7. Kiçik qalan işlər: mağazanın loqosu, «Məni xatırla», silinmiş elanların təmizlənməsi, §11-dəki risklər.

## 9. Sizin edəcəyiniz dörd iş

### 9.1 Real SMS provayderi

Ətraflı: [backend/README.md §8](../../backend/README.md#8-sms-provayderi).

1. **Sinif:** `backend/src/GreenStore.Api/Modules/Accounts/Sms/<Ad>SmsSender.cs` (məsələn `AcmeSmsSender`), `ISmsSender`-i həyata keçirir. Yeganə metod: `Task SendAsync(SmsMessage message, CancellationToken ct)`. `message.Phone` `+994505551234` formatındadır, `message.Text` artıq alıcının dilindədir. Provayderin API-sini `HttpClient` ilə çağırın, ayarları `IOptions<SmsOptions>` ilə alın.
2. **Xəta:** provayder qəbul etməsə, istisna atın. Sayt onda «kod göndərilmədi» deyir (`503 otp.unavailable`), cəhd istifadəçinin limitinə sayılmır.
3. **Qeydiyyat:** `Modules/Accounts/Sms/SmsSetup.cs`: `Providers` siyahısına adı (`"acme"`), `AddSms`-ə `services.AddHttpClient<AcmeSmsSender>(...)`, `switch`-ə `"acme" => sp.GetRequiredService<AcmeSmsSender>()`.
4. **Ayarlar** (mühit dəyişənləri): `Sms__Provider=acme`, `Sms__ApiUrl`, `Sms__Login`, `Sms__Password` və ya `Sms__ApiKey` (gizli), `Sms__Sender` (standart `GreenStore`), `Sms__TimeoutSeconds`.
5. **Production:** `Otp__ExposeDemoCode=false` (standart), `Otp__HmacKey` ən azı 32 simvol. SMS mətnləri `Modules/Accounts/Sms/SmsTexts.cs`-dədir.
6. Ustalara gedən «Usta çağır» xəbərləri də eyni sinifdən keçir (outbox ilə, alınmasa təkrar edir).

### 9.2 Real ödəniş provayderi

Ətraflı: [backend/README.md §16](../../backend/README.md#16-ödəniş-provayderi).

1. **Sinif:** `Modules/Promotion/Payments/<Ad>PaymentGateway.cs`, `IPaymentGateway`-i həyata keçirir:
   - `Name`: URL-dəki ad (kiçik hərflər, məsələn `acme`);
   - `StartAsync(PaymentStartRequest)`: provayderdə ödəniş yaradır (məbləğ AZN, qayıdış ünvanı `ReturnUrl`, callback `{ApiBaseUrl}/api/v1/payments/acme/callback`), `PaymentStart(providerRef, paymentUrl)` qaytarır;
   - `Read(PaymentCallbackRequest)`: imzanı yoxlayır, `PaymentCallback` (imza düzdürmü, `ProviderRef`, nəticə `Paid`/`Failed`, məbləğ) qaytarır; səhv gövdədə istisna atmır.
2. **Qeydiyyat:** `Modules/Promotion/PromotionSetup.cs`-də `services.AddSingleton<IPaymentGateway, AcmePaymentGateway>();` (saxta provayder də qala bilər; aktiv olanı ayar seçir).
3. **Ayarlar:** `Payments__Provider=acme`, `Payments__PublicBaseUrl=https://<api ünvanı>`, provayderin açarları `Payments__Acme__...` (yalnız mühit dəyişəni). Provayderin kabinetində callback: `https://<api>/api/v1/payments/acme/callback`.
4. **Qiymətlər:** bazanın `promotion_options` cədvəlindədir; seed mövcud qiymətin üstünə yazmır, ona görə real qiymət bazada dəyişdirilir.
5. Geri qaytarma və ləğv statusları bazada var, endpoint-ləri provayderlə birlikdə yazılacaq.

### 9.3 Deploy və Staging/Production yoxlama siyahısı

**Hissələr:** idarə olunan PostgreSQL 16 (UTF-8, `C.UTF-8` lokal), API konteyneri (`backend/Dockerfile`), Next.js sayt (Vercel və ya proxy arxasında Node server), şəkillər üçün S3-uyğun yaddaş və CDN, SMS və ödəniş provayderi. API və baza saytın serverinə yaxın regionda olmalıdır.

**Ardıcıllıq** (hər deploy):
1. Gizli dəyərləri hostinqin gizli dəyişənlərinə yazın (repoya heç vaxt).
2. Miqrasiya addımı: `docker run --rm <env> greenstore-api migrate` (və ya `dotnet GreenStore.Api.dll migrate`). Staging və Production-da API başlayanda miqrasiya etmir.
3. API-ni işə salın, `GET /health/ready` → `200` gözləyin (miqrasiya qalıbsa `503`).
4. Saytı build edin (build zamanı API əlçatan olmalıdır), sonra işə salın.
5. Qısa yoxlama: qeydiyyat, elan, moderasiya, kataloq.

**API dəyişənləri:**

| Dəyişən | Staging | Production |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Staging` | `Production` |
| `ConnectionStrings__Default` | gizli | gizli |
| `Internal__ApiKey` | uzun təsadüfi açar | uzun təsadüfi açar (saytın `API_INTERNAL_KEY`-i ilə eyni) |
| `Otp__HmacKey` | gizli | gizli, ≥ 32 simvol |
| `Otp__ExposeDemoCode` | `false` (`true` olsa API başlamır) | `false` |
| `Sms__Provider` və açarları | real provayder (yoxsa kodu heç kim almır) | real provayder |
| `Seed__Reference` / `Seed__Demo` / `Seed__DevAccounts` | `true` / `true` / `false` | `true` / **`false`** / `false` |
| `Frontend__BaseUrl` | saytın ünvanı | `https://greenstore.az` kimi |
| `Revalidation__Secret` | gizli (saytın `REVALIDATE_SECRET`-i ilə eyni) | eyni |
| `Media__Storage`, `Media__S3__*`, `Media__BaseUrl`, `Media__UploadBaseUrl` | `s3`, bucket açarları, CDN, API-nin ictimai ünvanı | eyni |
| `Payments__Provider`, `Payments__PublicBaseUrl` | `fake` (və ya provayderin test rejimi); bir neçə nüsxədə `Payments__Fake__Secret` | real provayder |

**Sayt dəyişənləri** (build-də və serverdə eyni):

| Dəyişən | Staging | Production |
|---|---|---|
| `DATA_SOURCE` | `api` | `api` |
| `API_BASE_URL` | API-nin daxili ünvanı | eyni |
| `API_PUBLIC_URL`, `MEDIA_BASE_URL` | API-nin ictimai ünvanı, CDN | eyni |
| `API_INTERNAL_KEY` | API-nin `Internal__ApiKey`-i | eyni (yoxsa bütün sayt bir IP sayılır və limitlər hamıya birdən düşür) |
| `REVALIDATE_SECRET` | API-nin `Revalidation__Secret`-i | eyni |
| `NEXT_PUBLIC_SITE_URL` | Staging ünvanı | `https://greenstore.az` kimi |
| `NEXT_PUBLIC_DEMO_MODE` | `true` olar | **`false`** («Demo versiya» bannerı gizlənir) |
| `SEO_INDEXABLE` | **`false`** | `true` (yalnız burada) |
| `CLIENT_IP_HEADER` və ya `TRUSTED_PROXY_HOPS` | hostinqin proxy-sinə görə (kök README.md, «Visitor IP behind the hosting's proxy») | eyni |

**Yoxlama siyahısı:**
- [ ] Hər yer HTTPS ilə (giriş cookie-si `Secure`-dur, HTTP-də sessiya itir).
- [ ] `next start` internetə proxy-siz açılmayıb.
- [ ] `Internal__ApiKey` = `API_INTERNAL_KEY`, `Revalidation__Secret` = `REVALIDATE_SECRET`.
- [ ] Saytın ünvanı `Frontend__BaseUrl`-də və ya `Media__UploadOrigins`-dədir (yoxsa şəkil yükləmə CORS-dan keçmir).
- [ ] Miqrasiya addımı deploy-un içindədir; `/health/ready` 200.
- [ ] Production: `Seed__Demo=false`, `NEXT_PUBLIC_DEMO_MODE=false`, `SEO_INDEXABLE=true`; Staging: `SEO_INDEXABLE=false`.
- [ ] SMS provayderi qoşulub, `Sms__Provider` `log` deyil (`log` kodları və müştəri nömrələrini loqa yazır).
- [ ] Şəkillər S3-də, `Media__BaseUrl` CDN-dir (konteynerin diski yenidən başlayanda itə bilər).
- [ ] **Backup:** idarə olunan bazada gündəlik backup və nöqtəyə qədər bərpa (≥ 7 gün), həftədə bir `pg_dump` başqa yerə, ayda bir bərpa sınağı; bucket üçün versiyalar və ya ayrıca kopya.
- [ ] Baza rolları: miqrasiya üçün ayrıca, API üçün DDL-siz rol (DATABASE.md §6; indi bir rol işlədilir).
- [ ] Loqlar JSON-dur; loq xidmətinə gedirsə, SMS provayderi qoşulmadan oraya kod düşür.
- [ ] Bir neçə Next.js serveri olsa: keş xəbəri hər birinə çatmalıdır və ya ortaq keş lazımdır.
- [ ] Hüquqşünas: saxlanma müddətləri, məlumatların ölkəsi, hüquqi səhifələr.

### 9.4 Rus və ingilis tərcümələri (qaralama)

| Mətn | Harada |
|---|---|
| Kateqoriya, alt kateqoriya, şəhər adları və təsvirləri | `backend/seed/buildSeed.ts`: `categoryNames`, `categoryDescriptions`, `cityNames` |
| Reklam paketlərinin adları, təsvirləri, üstünlükləri | `backend/seed/buildSeed.ts`: `promotionTexts` |
| Kartın atribut sətri, xidmətin qiymət mətni | `backend/src/GreenStore.Api/Modules/Listings/ListingTexts.cs` |
| Biznes növlərinin adları | `backend/src/GreenStore.Api/Modules/Sellers/SellerDtos.cs` (`SellerTexts`) |
| SMS mətnləri | `backend/src/GreenStore.Api/Modules/Accounts/Sms/SmsTexts.cs` |

**Necə düzəltmək:**
1. `buildSeed.ts`-də düzəldin, repo kökündən `node backend/seed/export.mjs` işə salın (JSON faylları yenilənir), `npm test` və `dotnet test backend`.
2. **Mövcud bazaya bu keçmir:** seed yalnız olmayan sətirləri yazır. Kateqoriyaları admin `/idareetme/kateqoriyalar`-da üç dildə dəyişə bilər; reklam paketləri üçün admin səhifəsi yoxdur, onlar bazada (`promotion_packages`, `promotion_options`) və ya ayrıca miqrasiya ilə dəyişdirilir. Yeni (boş) bazada düzəldilmiş fayllar dərhal işləyir.
3. `.cs` fayllarındakı mətnlər koddur: düzəliş, test və yeni deploy.

## 10. Modullar və endpoint-lər

Bütün endpoint-lər `/api/v1` altındadır (modullarda cəmi 87 marşrut, üstəlik `/health/live`, `/health/ready`, Development və Staging-də `/openapi/v1.json`). Kod: `backend/src/GreenStore.Api/Modules/<Modul>/`.

| Modul | Nə edir | Endpoint-lər |
|---|---|---|
| Taxonomy | kateqoriyalar, şəhərlər | `GET /categories`, `/categories/{id}`, `/cities` |
| Listings | kataloq, elan və xidmət, yerləşdirmə, «Elanlarım», qaralamalar, sayğaclar, sitemap | `GET /home`, `/listings`, `/listings/facets`, `/listings/count`, `/listings/{slug}`, `/listings/{id}/related`, `/services`, `/services/{slug}`, `/services/{id}/related`, `/sitemap/{kind}`; `POST /listings`, `/listings/{id}/views`, `/listings/{id}/phone-reveals`, `/sellers/{id}/phone-reveals`; `/me/listings` (siyahı, bir elan, redaktə, `renew`, `deactivate`, `activate`, sil, `stats`); `/me/drafts` |
| Sellers | satıcılar, ustalar, öz «mağaza» | `GET /sellers`, `/sellers/{slug}`, `/sellers/by-id/{id}`, `/providers/{id}`, `/providers/{id}/services`; `GET`, `PATCH /me/seller` |
| Accounts | SMS kodu, qeydiyyat, giriş, profil, sessiyalar | `POST /auth/otp`, `/auth/otp/verify`, `/auth/login`, `/auth/login/otp`, `/auth/logout`, `/accounts`, `/accounts/password-reset`; `GET`, `PATCH /me`; `POST /me/password`, `/me/phone`; `GET /me/sessions`, `DELETE /me/sessions/{id}` |
| Engagement | seçilmişlər, axtarışlar, şikayət, «Usta çağır», dəstək | `/me/favorites` (+ `items`, `merge`), `/me/saved-searches` (+ `opened`), `POST /reports`, `POST /service-requests`, `GET /me/service-requests` (+ `seen`), `POST /support` |
| Media | şəkil yükləmə və emalı | `POST /photos`, `PUT /photo-uploads/{token}`; fayllar `/media/...` |
| Admin | moderasiya, panel, şikayətlər, kateqoriyalar, təsdiq, bloklama | `/admin/moderation` (+ `decision`), `/admin/overview`, `/admin/reports`, `/admin/categories`, `POST /admin/sellers/{id}/verify`, `POST /admin/users/{id}/block` |
| Promotion | reklam və ödəniş | `GET /promotion-packages`, `POST /promotion-orders`, `GET /me/promotion-orders/{id}`, `POST /payments/{provider}/callback`; saxta «Test ödənişi» `/payments/fake/checkout/{ref}` (Development, Staging) |
| Platform | outbox (keş xəbərləri, SMS xəbərləri), `audit_log`, `Idempotency-Key` | — |
| Jobs | fon işləri: `ExpireListings`, `Promotions`, `Outbox`, `Cleanup` | — |

## 11. Baza və miqrasiyalar

- **7 miqrasiya** (`backend/src/GreenStore.Api/Data/Migrations`): `Initial` (pg_trgm), `AddCatalogueTables`, `AddAccounts`, `AddOtpCreatedIndex`, `AddListingLifecycle`, `AddReportsRequestsSupport`, `AddPromotions`. Dev bazasında hamısı tətbiq olunub; yeni model dəyişikliyi qalmayıb.
- **29 cədvəl:**
  - kataloq: `categories`, `cities`, `users`, `sellers`, `listings`, `listing_photos`, `photos`, `listing_counters`;
  - hesablar: `sessions`, `otp_challenges`, `favorites`, `saved_searches`;
  - elan dövrü: `listing_drafts`, `listing_revisions`, `moderation_decisions`, `listing_daily_stats`, `listing_seen` (UNLOGGED), `outbox`, `audit_log`, `idempotency_keys`;
  - faza 4: `reports`, `service_requests`, `service_request_recipients`, `support_messages`;
  - faza 5: `promotion_packages`, `promotion_options`, `promotion_orders`, `payment_events`, `listing_promotions`.
- **Nömrələr:** elan `listing_number_seq` (demo-dan sonra davam edir), sorğu 3001-dən, dəstək bileti 1001-dən, reklam sifarişi 1001-dən.
- **Qaydalar:** tətbiq olunmuş miqrasiya dəyişdirilmir, yenisi yazılır; hər PR-da `dotnet ef migrations script` ilə SQL-ə baxılır; miqrasiya deploy-un ayrıca addımıdır.
- Sxemin təfərrüatı (sütunlar, CHECK, indekslər, axtarış): DATABASE.md.

## 12. Docker (yoxlanmayıb)

- `backend/Dockerfile`: iki mərhələli build (`dotnet/sdk:10.0` → `dotnet/aspnet:10.0`), port 8080, istifadəçi root deyil, şəkillər `/data/media`-da, seed faylları image-in içində. `docker build -t greenstore-api backend`, miqrasiya `docker run --rm ... greenstore-api migrate`.
- `backend/docker-compose.yml`: `postgres` (əvvəlki kimi), `api-migrate` (miqrasiya və seed, sonra çıxır) və `api` (<http://localhost:5080>, Development). `docker compose up -d --build`.
- **Bu fayllar heç vaxt build olunmayıb və işə salınmayıb:** bu maşında Docker daemon yoxdur, yalnız `docker compose config` sintaksisi yoxladı. İlk dəfə Docker olan maşında yoxlayın. Bilinən məhdudiyyət: konteynerin içində `localhost` konteynerin özüdür, ona görə compose-dakı API keş xəbərlərini hostdakı sayta çatdıra bilmir (səhifələr onsuz da 60 saniyəyə yenilənir).

## 13. Təhlükəsizlik riskləri

| Risk | Nə vaxt vacibdir | Nə etmək |
|---|---|---|
| `Sms:Provider = log` kodları və müştəri nömrələrini (ustalara xəbərdə) loqa yazır; Development-dən kənarda yalnız xəbərdarlıq var | Staging və Production | real provayder; loqları qoruyun |
| API özü `X-Forwarded-For`-u oxumur: saytdan gələn sorğularda IP-ni Next deyir (açarla), birbaşa gələn müştərilər (gələcək mobil tətbiq) proxy arxasında bir IP sayılır | public deploy, mobil tətbiq | hostinq seçiləndə proxy ayarı |
| `API_INTERNAL_KEY` boşdursa, bütün ziyarətçilər bir IP sayılır: SMS, şifrə və «Usta çağır» limitləri hamıya birdən düşür | deploy | açarı qoyun (§9.3) |
| `next start` proxy-siz açıq olsa, ziyarətçi öz IP-sini seçib limitlərdən yayına bilər | deploy | yalnız proxy arxasında |
| Limitlər hər API prosesində ayrıca sayılır | bir neçə API nüsxəsi | ortaq limit (Redis) və ya bir nüsxə |
| «Usta çağır»ın gündəlik 500 SMS limitini çox nömrə və IP ilə doldurmaq olar; onda ustalara SMS getmir (sorğular yenə «Gələn sorğular»dadır) | SMS qoşulandan sonra | limiti və loqu izləyin |
| Ödəniş callback-inə `\u0000` olan JSON göndərilsə, API 500 qaytarır və xəta loqu yazır (pul təhlükəsizliyinə təsiri yoxdur) | public API | kiçik düzəliş (NUL simvolunu atmaq) |
| Admin başqa admini bloklaya bilər; bloklanmış hesabın satıcısını təsdiqləmək olur | admin sayı artanda | qayda əlavə etmək |
| Silinmiş elanların nömrəsi və şəkilləri 6 aydan sonra silinmir | şəxsi məlumatlar qanunu | təmizləmə işi yazmaq, hüquqşünas |
| Backup və bərpa sınağı hələ qurulmayıb | ilk real istifadəçidən əvvəl | §9.3 |
| Saxta ödəniş: bir neçə Staging nüsxəsində `Payments__Fake__Secret` qoyulmasa, callback-lər uğursuz olur; Production-da saxta ödəniş işləmir | Staging | açarı qoyun |
| Cavablarda `Server: Kestrel` başlığı | kiçik | söndürmək |

Yaxşı tərəflər: nömrələr public cavablarda yoxdur; şifrə PBKDF2; sessiya tokeni bazada yalnız SHA-256; SMS kodu HMAC; daxili açar sabit vaxtda müqayisə olunur; dev hesabları və demo kod Development-dən kənarda API-ni başlatmır; OpenAPI Production-da bağlıdır; hər admin əməliyyatı `audit_log`-dadır; şəkillərdən EXIF və GPS silinir.
