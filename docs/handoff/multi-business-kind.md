# Biznesin bir neçə növü (24 noyabr 2026)

Komandanın qərarı ilə biznes hesabı bir neçə növ seçə bilər. Məsələn, GreenGarden həm ağac və fidan yetişdirir, həm də bitki, dibçək və torpaq satır: «Tingçilik təsərrüfatı» və «Bağ mərkəzi»ni birlikdə seçir. Növlər əvvəlki üçdür: `nursery` («Tingçilik təsərrüfatı»), `garden-centre` («Bağ mərkəzi»), `landscaping` («Landşaft şirkəti»).

## Saytda nə dəyişdi

- **Qeydiyyat (`/qeydiyyat`, 1-ci addım):** «Biznesin növü» kartları indi seçim qutularıdır (checkbox). Bir və ya bir neçəsini seçmək olar. Heç biri seçilməsə: «Ən azı bir biznes növü seçin.»
- **Kabinet → Profil:** «Biznesin növü» açılan siyahı deyil, eyni kartlardır. Bütün növləri götürüb saxlamaq olmur.
- **Satıcı səhifəsi, satıcı kartı və elan səhifəsindəki satıcı bloku:** `Seller.kind` bütün növləri göstərir, məsələn «Tingçilik təsərrüfatı · Bağ mərkəzi».
- **`/saticilar` tabları:** «Bağ mərkəzi» tabı bağ mərkəzi seçmiş bütün şirkətləri göstərir. Bir neçə növü olan şirkət hər tabda çıxır, ona görə tabların sayları cəmdə ümumi saydan çox ola bilər.

## Müqavilə (`src/types`, `src/services/repository.ts`)

| Əvvəl | İndi |
|---|---|
| `Seller.businessKind?: BusinessKind` | `Seller.businessKinds?: BusinessKind[]` |
| `RegistrationInput.businessKind` | `RegistrationInput.businessKinds`: biznes üçün bir və ya bir neçəsi |
| `SellerProfilePatch.businessKind` | `SellerProfilePatch.businessKinds`: `[]` qəbul olunmur |
| `listSellers({ businessKind })` | dəyişmədi; mənası «bu növü də olan bizneslər» |

- **Sıra:** siyahı həmişə `nursery`, `garden-centre`, `landscaping` sırasındadır və hər növ bir dəfə olur. Təkrar göndərilən növ bir dəfə sayılır.
- **`Seller.kind`:** növlərin adlarını « · » ilə birləşdirir, sorğunun dilində.
- **Sayt tərəfində:** `AccountProfile.businessType` (yazı) əvəzinə `AccountProfile.businessKinds`. Növlərin sırası və adları `src/features/seller/businessKinds.ts`-dədir, seçim sahəsi `src/features/seller/BusinessKindsField.tsx`-dədir.

## API

- **`POST /accounts`:** biznes üçün `businessKinds` lazımdır. Boş və ya göndərilməyibsə: 400 `validation`, `errors.businessKinds: ["required"]`. Tanınmayan növ, məsələn `"shop"`: bütün sorğu 400 `bad-request` alır, başqa tanınmayan enum dəyərləri kimi.
- **`PATCH /me/seller`:** `businessKinds` göndərilibsə dəyişir. `[]` və ya `null`: `required`, köhnə növlər qalır.
- **`GET /sellers?businessKind=garden-centre`:** süzgəc bazada işləyir: `'garden-centre' = ANY (business_kinds)`.
- **Cavablar:** `Seller` və `OwnSeller`-də `businessKinds` siyahısı. `ServiceProvider.summary` də bütün növləri göstərir: «Tingçilik təsərrüfatı · Landşaft şirkəti · Bakı».

## Baza

- **Miqrasiya `MultipleBusinessKinds`:** `sellers.business_kind` (`text`) yerinə `sellers.business_kinds` (`text[] NOT NULL`) gəlir. Hər biznesin köhnə növü siyahının ilk elementi olur, məlumat itmir.
- **Yoxlama:** `ck_sellers_business_kinds` ən azı bir element tələb edir və yalnız üç növə icazə verir.
- **Geri qaytarma (`Down`):** siyahının birinci növü yenidən `business_kind` olur. Qalan növlər itir.

## Deploy və keçid dövrü

- Merge-də Railway (API) və Vercel (sayt) eyni anda build edir. Vercel-in build-i səhifələri API-dən qurur.
- Sayt API-nin hər iki cavabını oxuyur: yeni `businessKinds`, ya da hələ deploy olunmamış API-nin `businessKind`-i (`src/services/apiRepository.ts`, `withKinds`). Beləcə köhnə API-yə qarşı build yıxılmır.
- **Növbəti buraxılışda** bu keçid kodunu (`withKinds`-in `businessKind` hissəsini) silin, çünki hər API artıq `businessKinds` göndərir.
- Bir neçə dəqiqəlik keçid zamanı köhnə sayt yeni API-yə `businessKind` göndərsə, biznes qeydiyyatı `businessKinds: required` ilə dayanar. Canlıda istifadəçi azdır, risk kiçikdir.
- Bazada biznes yoxdursa (24 noyabrda demo məlumat silinib), miqrasiya heç bir sətri dəyişmir.
