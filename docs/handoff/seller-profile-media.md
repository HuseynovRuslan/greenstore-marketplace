# Biznes profili: loqo, üz şəkli və yeni profil səhifəsi (24 noyabr 2026)

Bu sənəd komanda üçündür: saytda nə dəyişdi, API-də və müqavilədə nə əlavə olundu, deploy zamanı nəyə baxmaq lazımdır.

## 1. Saytda nə dəyişdi

**Kabinet → Profil** (`/kabinet/profil`). Biznes hesabı səhifənin yuxarısında öz profilini alıcının gördüyü kimi görür. Bu, LinkedIn-in məntiqinə bənzəyir, amma eyni dizayn deyil.

- **Üz şəkli** 4:1 ölçüsündədir, telefonda 3:1 görünür. Şəkil yoxdursa, ortada «Üz şəkli əlavə et» düyməsi var. Şəkil varsa, küncdəki qələm menyu açır: «Üz şəklini dəyiş» və «Sil».
- **Loqo** yuvarlaq künclü kvadratdır və üz şəklinin aşağı sol küncünün üstündədir. Üzərindəki kamera düyməsi:
  - loqo yoxdursa, şəkil seçməyi dərhal açır;
  - loqo varsa, menyu açır: «Loqonu dəyiş» və «Sil».
- **Şəkli yerləşdirmək.** Şəkil seçiləndən sonra dialoq açılır. Çərçivə loqo üçün kvadrat, üz şəkli üçün 4:1-dir.
  - Şəkli sürüşdürərək yerini dəyişmək, sürgü və ya düymələrlə böyütmək olar.
  - Klaviatura: ox düymələri sürüşdürür (Shift ilə daha çox), + və − böyüdür, 0 sıfırlayır.
  - Loqoda yuvarlaq künclər, üz şəklində telefonda görünən hissə (qırıq xətlər) göstərilir.
- **Yükləmə.** «Yadda saxla» basılanda şəkil brauzerdə kəsilir: loqo ən çox 800 × 800, üz şəkli ən çox 2400 × 600 piksel, WebP və ya JPEG. Şəkil dərhal görünür, yüklənərkən üstündə «Yüklənir…» yazılır.
- **Seçimdən əvvəlki yoxlama.** Şəkil seçilən kimi yoxlanılır: JPG, PNG və ya WebP, ən çox 10 MB, ölçüsü kifayət etməlidir. Səhv olanda səbəb Azərbaycan dilində yazılır və köhnə şəkil qalır.
- **Silmə.** «Sil» əvvəl soruşur: «Loqonu silək?»
- **«Profilin tamlığı»** kartı faizi və beş bəndi göstərir: loqo, üz şəkli, şirkət haqqında, ünvan, e-poçt. Çatmayan bəndin «Əlavə et» düyməsi ya şəkil seçməyi açır, ya da həmin sahəyə aparır.
- **Forma** artıq kartlara bölünüb: «Şirkət» (ad, növlər, haqqında), «Əlaqə», «Ünvan». Altında bir ümumi «Dəyişiklikləri yadda saxla» düyməsi var. Loqo və üz şəkli formadan ayrı, dərhal saxlanılır.
- **İctimai səhifə** (`/saticilar/<slug>`). Üz şəkli varsa, banner 4:1 ölçüsündədir, telefonda 3:1. Loqo baş hərflərin yerinə görünür.

`DATA_SOURCE=mock` rejimində şəkillər yalnız bu brauzerin sessiyasında qalır (data: URL), ictimai səhifəyə düşmür.

## 2. Müqavilə (`src/types`, `repository.ts`)

- **`PhotoPurpose`:** yeni tip, `'listing' | 'seller-logo' | 'seller-cover'`.
- **`PhotoUploadRequest.purpose?`:** buraxılsa, `listing` olur. `createPhotoUpload` onu API-yə ötürür. Əvvəl həmişə `listing` göndərirdi.
- **`SellerProfilePatch`:** `logoPhotoId?: string | null` və `coverPhotoId?: string | null` əlavə olundu. `null` şəkli silir.
- **`OwnSeller`:** dəyişməyib. `logo` və `coverImage` onsuz da `Seller`-də var idi.
- **`AccountProfile`** (yalnız saytın içində): `sellerLogo` və `sellerCover` əlavə olundu.
- **Server Action-lar** (`src/features/account/actions.ts`):
  - `startProfilePhotoUpload({ slot, contentType, bytes })`;
  - `saveProfilePhoto(slot, photoId | null)`.

`backend/contracts/frontend-types.json` yenidən yaradılıb.

## 3. API

**`POST /photos`** iki yeni `purpose` qəbul edir:

| `purpose` | Ölçü qaydası | Nüsxələr (en, WebP) |
|---|---|---|
| `seller-logo` | ən azı 400 × 400 px, en/hündürlük 0,8–1,25 | 160, 320, 640 px |
| `seller-cover` | ən azı 1200 × 300 px, en/hündürlük 3,5–4,5 | 640, 1280, 1920 px |

Forma uyğun deyilsə, yeni xəta kodu qaytarılır: 422 `photo.wrong-shape`. Ölçü kiçikdirsə, əvvəlki kimi 422 `photo.too-small`. Sayt şəkli onsuz da kəsib göndərir, bu qaydalar birbaşa API-yə gələn sorğular üçündür.

**`PATCH /me/seller`** iki yeni sahə qəbul edir: `logoPhotoId` və `coverPhotoId`.
- Şəkil zəngi edənin öz şəkli olmalıdır, `purpose`-u uyğun gəlməli və statusu `ready` olmalıdır. Yoxsa 400 `validation` qaytarılır, sahə xətası `not-found` və ya `not-ready` olur, elanın `photoIds`-indəki kimi.
- Səhv şəkil olanda patch-in qalan hissəsi də saxlanılmır.
- Qoyulan şəklin `attached_at`-ı yazılır. Əvəz olunan və ya silinən şəkil buraxılır (`attached_at = null`), gündəlik təmizləmə onu bir gündən sonra faylları ilə silir.
- Cavabdakı `logo` ən böyük nüsxədir (640 px), `coverImage` da ən böyük nüsxədir (1920 px). `PhotoUrls.Of` artıq hər şəklin ən böyük nüsxəsini götürür; elan şəkilləri üçün bu, əvvəlki kimi 1280 px-dir.
- `PATCH /me/seller` indi sayta keş xəbəri də göndərir. Teqlər: `seller:<id>`, `seller:<slug>`, `sellers`, `home`, `services`, `provider:<owner>`. Əvvəl yalnız saytın öz `updateTag('sellers')` çağırışı var idi.

**Kod:**
- yeni `Modules/Sellers/SellerPhotos.cs`;
- `SellerProfileRules.cs` (`SellerPatch`-ə iki sahə), `SellerProfileEndpoints.cs`;
- `Modules/Media/PhotoRules.cs`, `PhotoProcessor.cs`, `PhotosEndpoints.cs`, `Photo.cs`;
- `Modules/Platform/Outbox.cs` (`Revalidation.TagsFor(Seller)`; admin də artıq onu işlədir).

**Baza:** miqrasiya yoxdur. `sellers.logo_photo_id` və `sellers.cover_photo_id` sütunları, `photos.purpose`-un `seller-logo` və `seller-cover` dəyərləri əvvəldən var idi.

## 4. Deploy və yoxlama

- Backend və sayt eyni PR-dadır və `main`-dən birlikdə deploy olunur. Köhnə sayt yeni API ilə işləyir: yeni sahələr könüllüdür. Yeni saytın şəkil yükləməsi isə yeni API olmadan `photo.too-small` ala bilər, çünki köhnə API hər şəkildən qısa tərəfi 600 px istəyir. Ona görə API əvvəl, sayt sonra deploy olunmalıdır, ya da ikisi bir-iki dəqiqə fərqlə.
- Railway-də Postgres-in volume-u 500 MB-dır. Bir üz şəkli üç nüsxə ilə təxminən 0,3–0,6 MB tutur.
- Yoxlama siyahısı:
  1. Biznes hesabı ilə `/kabinet/profil`-də loqo və üz şəkli yükləyin, `/saticilar/<slug>`-da görünsün.
  2. Loqonu dəyişin: köhnə şəkil bir gün sonra təmizlənir.
  3. Silin: ictimai səhifədə yenidən baş hərflər görünsün.
