# Seed məlumatı

API bazanı bu qovluqdakı JSON fayllarından doldurur ([DATABASE.md](../DATABASE.md) §7). Fayllar əl ilə yazılmır: onları `src/data`-dan ixrac skripti yaradır və onlar git-də saxlanır.

| Qovluq | Nə var | Harada yazılır |
|---|---|---|
| `reference/` | `categories.json` (kateqoriyalar alt kateqoriyaları ilə), `cities.json`, `promotions.json` | **hər mühitdə**, Production daxil (`Seed:Reference`, standart `true`) |
| `demo/` | `users.json`, `sellers.json`, `listings.json`, `services.json` | yalnız `Seed:Demo=true` olanda: Development-də standart, Staging-də `Seed__Demo=true` ilə |

> **Diqqət: rus və ingilis adları qaralamadır.** Kateqoriya, alt kateqoriya və şəhər adlarının `ru` və `en` dəyərləri (həmçinin API-dəki biznes növü adları, kartın atribut sətri və xidmətin qiymət mətni) maşın köməyi ilə hazırlanmış **qaralama tərcümələrdir**. Rus və ingilis dilini doğma bilən biri onları yoxlamalıdır (DATABASE.md, qərar 7). Mətnlər `buildSeed.ts`-dəki `categoryNames`, `categoryDescriptions`, `cityNames` cədvəllərindədir, API-dəkilər `Modules/Listings/ListingTexts.cs` və `Modules/Sellers/SellerDtos.cs`-dədir (`SellerTexts`).

## Faylları yenidən yaratmaq

Repo kökündən:

```bash
node backend/seed/export.mjs
```

- Əlavə npm paketi lazım deyil: skript Vite-ın `createServer` + `ssrLoadModule` funksiyaları ilə (`@` alias-ı ilə) TypeScript məlumat modullarını yükləyir. Vite artıq dev asılılığıdır.
- Skript bunları yazır:
  - `seed/reference/*.json` və `seed/demo/*.json`;
  - `contracts/frontend-types.json`: `src/types/index.ts` və `src/services/repository.ts`-dəki interfeyslər və union-lar (API-nin müqavilə testləri cavabları bununla müqayisə edir);
  - `contracts/listing-search-parity.json`, `contracts/service-search-parity.json`: mock-a verilmiş axtarış sorğuları və nəticələri (API testləri eyni sorğuları bazada işlədir və eyni elanları gözləyir).
- Məntiq `buildSeed.ts` və `../contracts/frontendTypes.ts`-dədir, `export.mjs` yalnız onları işə salıb faylları yazır.

**Nə vaxt işə salmaq lazımdır:** `src/data`, `src/types` və ya `src/services/repository.ts` dəyişəndə. `npm test`-dəki `src/test/backendSeed.test.ts` faylların köhnəldiyini görür və skript yenidən işə salınana qədər qırmızı qalır. Sonra `dotnet test backend` dəyişikliyin backend üçün nə demək olduğunu göstərir (məsələn, mock-un yeni nəticəsi ilə uyğunluq testi).

## Seeder necə işləyir

- `dotnet run --project src/GreenStore.Api -- migrate` miqrasiyaları tətbiq edir, sonra seed yazır və çıxır (deploy addımı). Development-də API başlayanda da eyni iş görülür.
- **Yalnız olmayan sətir yazılır.** Mövcud sətir heç vaxt dəyişdirilmir, ona görə adminin dəyişikliyi növbəti deploy-da itmir. Silinmiş istinad sətri (məsələn, alt kateqoriya) isə növbəti işdə yenidən yaranır.
  - istinad məlumatı id ilə tanınır (`agaclar`, `baki`);
  - demo istifadəçi telefonla, satıcı slug ilə, elan nömrə ilə tanınır.
- Hamısı bir tranzaksiyada və advisory lock altında gedir: iki proses eyni anda seed etsə, toqquşmur.
- Faylda dəyişiklik **mövcud bazaya keçmir** (məsələn, düzəldilmiş rus adı). Belə dəyişiklik admin panelindən (faza 4) və ya ayrıca miqrasiya ilə edilir.
- `promotions.json` faza 5-dən `promotion_packages` və `promotion_options` cədvəllərinə yazılır (id ilə: `one-cixar`, `one-cixar-7`). Adlar, qısa təsvirlər, üstünlüklər və seçimlərin adları üç dildədir; rus və ingilis mətnləri **qaralamadır** (`buildSeed.ts`-dəki `promotionTexts`), doğma danışan yoxlamalıdır. Qiymətlər mock-un qiymətləridir (AZN): real qiymətlər qərarlaşanda bazada dəyişdirilir, seed mövcud sətrin üstünə yazmır.

## Demo məlumatı necə qurulur

- **İstifadəçilər.** Hər satıcının sahibi (əlaqə şəxsi), satıcısız elanların əlaqə şəxsləri və xidmət göstərənlər demo hesab olur. Nömrəsi olmayan üç usta üçün nümunə nömrələr götürülüb (`+994500000101`…`103`). Demo hesablarla şifrə ilə daxil olmaq olmur (`password_hash` heç bir şifrəyə uyğun gəlmir); mobil nömrəsi olanlar SMS kodu ilə daxil ola bilər (faza 2, Development-də kod `demoCode`-dadır).
- **Dev işçi hesabları.** Faylda deyil, kodda: `Data/Seed/DevAccountsSeeder.cs` (admin və moderator, yalnız `Seed:DevAccounts=true` olanda, yəni Development-də). Telefonları, e-poçtları və parolları: [README.md §9](../README.md#9-dev-hesabları).
- **Elanlar və xidmətlər** `listings` cədvəlinə düşür: məhsul `kind = product`, xidmət `kind = service`. Xidmətin kateqoriyası `landsaft-xidmetleri`-dir, xidmət növü alt kateqoriyadır (`subcategoryId`), əraziləri şəhər id-ləridir.
- **Nömrələr.** Məlumatda nömrəsi olan elan onu saxlayır (`Elan № 10482`). Nömrəsizlər sıra ilə 10601-dən (elanlar) və 20317-dən (xidmətlər) nömrə alır. Bazanın `listing_number_seq` sayğacı seed-dən sonra ən böyük nömrədən davam edir.
- **Slug:** başlıq ASCII-yə çevrilir, sonra nömrə gəlir: «Zeytun ağacı — Olea europaea» → `zeytun-agaci-olea-europaea-10482`. Azərbaycan hərfləri latın hərfinə (ə→e, ı→i, ş→s, …), rus hərfləri translit ilə keçir.
- **Vaxtlar.** Məlumatdakı yerli vaxtlar Bakı vaxtıdır (UTC+4) və UTC-yə çevrilir. Müddəti seed anında bitmiş aktiv elan seed anından 30 gün alır.
- **Şəkillər** `/images/...` yolu ilə qalır, onları Next `public/`-dan verir. Satıcının sxemdə iki şəkli var (loqo və örtük): Figma-dakı kart şəkli örtük şəkli olmayanda örtük kimi yazılır.
- **Rədd səbəbi** mətndən koda çevrilir (`bad-photos`, tanınmayan mətn `other`), mətn moderatorun qeydi kimi qalır.
- **`search_text`** C#-da yığılır (`ListingSearchText`): başlıq, növün latın adı, kartın atribut sətri, kateqoriya, alt kateqoriya və şəhər adları üç dildə, ərazi; xidmətdə həm də usta, əraziləri, təsvir və «✓» siyahısı.

## Mock-dan bilərəkdən fərqlər

Uyğunluq faylları bu halları yoxlamır, çünki API burada mock-dan fərqli (və daha düzgün) işləyir:

- **Yaş filtri** API-də bitki faktlarından (`plant.ageYears`), mock-da kartın mətnindən oxunur.
- **«Fərdi satıcı»** mock-da heç nə tapmır, API-də biznes profili olmayan bütün elanları tapır.
- **Axtarış** API-də daha çox sahəyə baxır (latın növ adı, ərazi, rus və ingilis adları). Kartın atribut sətrini API bitki faktlarından yığır, Figma elanları isə onu əl ilə yazıb.
- **Ana səhifə:** «Önə çıxan» və «Son elanlar» ən yeni elanlardır (eyni elanlar, «Önə çıxan»-da sıra fərqli ola bilər), xidmətlər ən yeni üç xidmətdir və şəkli örtük şəklidir.
- **Xidmətlərin sayı** (`displayTotal`) API-də həmişə real saydır, mock-dakı 95 sabit rəqəm deyil.
- **«çim»** sözü mock-da «Qazon salınması»nı tapır (`searchWords`), API-də hələ tapmır: bazada axtarış sözləri üçün sütun yoxdur.
- **Qiymət filtri** «Razılaşma ilə» elanlarını (qiyməti yoxdur) heç vaxt tapmır. Demo məlumatda belə elan yoxdur.
- **«Növ» filtri** API-də yoxdur. Mock növü elanın adından çıxarır («Zeytun ağacı — Olea europaea» → `zeytun-agaci`), bu isə Figma məlumatına bağlıdır. API rejimində sayt heç bir növ tanımır və köhnə linkdəki `nov` parametrini nəzərə almır: çip və başlıq olmayan filtri göstərmir. Filtr qrupu onsuz da gizlidir (`SHOW_SPECIES_FILTER`). Qrup qayıdanda filtr `listings.species` sütunu üzərində qurulmalıdır.
- **Xidmətin qalereyası** API-də örtük şəkli ilə başlayır, çünki örtük həmişə 1-ci şəkildir (DATABASE.md §3.5). Figma-da yalnız «Landşaft dizaynı» xidmətinin kart şəkli qalereyasında yoxdur, ona görə API rejimində bu şəkil qalereyanın əvvəlinə əlavə olunur. Elan səhifələrində fərq yoxdur: qalereya Figma-nın `-gallery-N` şəkillərini seçir, yoxdursa örtüyü əvvələ qoyur. Bunu `src/test/backendSeed.test.ts` hər demo elan üçün yoxlayır.

Saytın URL-indən gələn həddən kənar rəqəmlər (`?min=-5`, `?max=100000000000`, `?hundurluk=3000000000-`, `?sehife=99999999999`) API-yə getməzdən əvvəl API-nin həddinə gətirilir (`src/services/apiQuery.ts`). Bu sorğular uyğunluq fayllarındadır və API mock ilə eyni nəticəni verir.
