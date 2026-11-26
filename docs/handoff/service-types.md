# Xidmətin bir neçə növü (26 noyabr 2026)

Rəhbərliyin istəyi ilə xidmət elanı bir neçə növə aid ola bilər. Məsələn, bağ baxımı edən şirkət həm «Bağ baxımı», həm «Qazon salınması», həm də «Ağac əkilməsi» seçə bilər. Elan hər seçilmiş növün siyahısında görünür. Məhsul elanlarında dəyişiklik yoxdur: məhsulun yenə bir alt kateqoriyası olur.

## Saytda nə dəyişdi

- **«Elan yerləşdir», 1-ci addım:** «Xidmətin növü» indi seçim qutularıdır (checkbox). Bir və ya bir neçəsini seçmək olar. Seçilmiş növün yanında işarə görünür, yəni seçim təkcə rəngə bağlı deyil. Heç biri seçilməsə: «Ən azı bir xidmət növü seçin.» İlk seçilən növ əsas növdür.
- **Qaralama:** 26 noyabrdan əvvəl brauzerdə saxlanmış qaralamanın bir növü siyahıya çevrilir. Artıq təklif olunmayan növ siyahıdan düşür.
- **Xidmət səhifəsi (`/xidmetler/<slug>`):** başlığın altında xidmətin bütün növləri link kimi görünür, hər biri həmin növün siyahısını açır.
- **`/xidmetler`:** növə görə süzəndə bir neçə növü olan elan hər növün altında çıxır, ona görə tabların sayları cəmdə ümumi saydan çox ola bilər.
- **Elanın faktları, kabinet və moderasiya:** «Kateqoriya» sətri bütün növləri adlandırır, məsələn «Bağ xidmətləri / Bağ baxımı, Qazon salınması». Moderatorun dəyişiklik siyahısında növlərin dəyişməsi «Xidmətin növü» kimi görünür.
- **Redaktə:** dərc olunmuş elanın kateqoriyası formada dəyişmir (əvvəlki kimi): növlər oxunur, amma dəyişdirmək üçün yeni elan lazımdır.

## Müqavilə (`src/types`)

| Tip | Yeni sahə |
|---|---|
| `Listing` | `subcategoryIds?: string[]`: elanın bütün alt kateqoriyaları (xidmətin növləri, birincisi `subcategoryId`; məhsulun bir alt kateqoriyası). `subcategories?: string[]`: onların adları, eyni sırada |
| `Service` | `categoryIds?: string[]`: xidmətin bütün növləri, birincisi `categoryId` |
| `ListingInput` | `subcategoryIds?: string[]`: xidmətin növləri, 1–6 ədəd, hamısı `categoryId`-nin alt kateqoriyası. Məhsul ən çox birini göndərir. Varsa, `subcategoryId` və `subcategory`-dən üstündür; birinci id köhnə oxuyucular üçün `subcategoryId`-də də göndərilir |

Köhnə sahələr (`subcategory`, `subcategoryId`, `categoryId`) qalır və əsas növü göstərir, ona görə yeni sahələri tanımayan kod düz işləyir. `backend/contracts/frontend-types.json` yenidən yazıldı (`node backend/seed/export.mjs`).

## API

Ətraflı: [backend-contract.md](backend-contract.md) 1.3 və [DATABASE.md](../../backend/DATABASE.md).

- **Baza:** miqrasiya `ServiceTypes`. `listings` cədvəlinə `subcategory_ids text[]` əlavə olundu. Köhnə elanların siyahısı öz `subcategory_id`-si ilə dolduruldu. Yoxlama (`ck_listings_subcategory_ids`): siyahının birincisi həmişə `subcategory_id`-dir, ən çoxu 6 növ, məhsulda ən çoxu bir.
- **Yoxlama:** `subcategoryIds` göndərilibsə, `subcategoryId`-dən üstündür. Boş siyahı `required`, 6-dan çox `too-many`, başqa kateqoriyanın, söndürülmüş və ya tanınmayan id `invalid` qaytarır.
- **Redaktə:** dərc olunmuş elanın əsas növü dəyişmir (`categoryId: locked`). API qalan növlərin dəyişməsinə icazə verir, amma sayt formada onları kilidli saxlayır. `subcategoryIds` göndərməyən köhnə sayt bütün növləri saxlayır.
- **Kataloq:** `GET /services?categoryId=` xidməti hər növünün altında tapır. Saylar hər növü sayır. Axtarış bütün növlərin adlarını tanıyır.
- **Admin:** alt kateqoriya bir xidmətin ikinci növü olsa da silinmir (409 `category.in-use`). Adı dəyişəndə həmin elanların axtarış mətni yenidən yığılır.
- **Moderasiya:** növlərin dəyişməsi `changes`-də `subcategoryIds` sətri kimi gəlir.
