# Formaların sahələri: telefon, ad və soyad (25 noyabr 2026)

Telefon sahəsinə hərf yazılırdı, adlara rəqəm yazılırdı. İndi bütün formalarda sahə yalnız ona uyğun simvolları qəbul edir, API də eyni qaydanı yoxlayır. Müqavilə (`src/types`, `src/services/repository.ts`) dəyişmədi.

## Telefon nömrəsi

- **Görünüş:** «+994 __ ___ __ __». Kod sabitdir, rəqəmlər maskadakı yerləri doldurur. Etiket başqa sahələrdə olduğu kimi qutunun üstündədir.
- **Qəbul etmir:** hərf, simvol, 10-cu rəqəm. Vərdişlə yazılan «0» (050…) atılır. «994» ilə başlayan nömrə 9 rəqəmdən uzun olanda «994» atılır. Yapışdırılan və ya brauzerin doldurduğu nömrə istənilən formada qəbul olunur: `+994505551234`, `0505551234`, `(050) 555-12-34`.
- **Harada:** qeydiyyat, SMS ilə giriş, şifrənin bərpası, elanın «Əlaqə» addımı, «Bizimlə əlaqə» və **Kabinet → Profil**. Profildə əvvəl adi mətn sahəsi idi və hərf qəbul edirdi.
- **Düzəldilən iki köhnə xəta:**
  - Rəqəmlər bir-bir yazılanda saxlanan «+994 5» yenidən «99 45» kimi oxunurdu (`src/lib/phone.ts`, `localDigits`). İndi «+994» ilə başlayan dəyərin yalnız ondan sonrakı hissəsi oxunur.
  - Telefon qutusu 72 px hündürlükdə idi, başqa sahələr 48 px. Qutunun `p-0`-ı `controlClass`-ın `px`/`py`-nı əvəz etmirdi. İndi `p-0!` yazılıb.

## Ad və soyad

- **Əlaqə şəxsi (biznes) və fərdi hesabın adı** iki sahəyə bölündü: «Ad» və «Soyad». İkisi də məcburidir. Biznesdə ikisi «Əlaqə şəxsi» başlığı altındadır. Bu qayda qeydiyyatda və Kabinet → Profil-də işləyir.
- **API-də ad yenə bir sahədir** (`fullName`, `contactPerson`): sayt «Ad Soyad» kimi birləşdirib göndərir. Mövcud ad profildə ilk boşluqdan bölünür: «Sərxan Əşrəfzadə» → «Sərxan» + «Əşrəfzadə». Tək sözdən ibarət ad varsa, profil saxlananda «Soyadınızı yazın.» çıxır.
- **Qayda (`src/lib/names.ts`):** istənilən əlifbanın hərfləri. Aralarında boşluq, defis (Məmməd-Əli), apostrof və ya nöqtə (S. Əşrəfzadə) ola bilər. Rəqəm və başqa simvollar yazılanda da, yapışdırılanda da düşmür.
- **Eyni qayda:** elanın «Adınız» sahəsi, «Bizimlə əlaqə»nin «Adınız» sahəsi. Ödəniş kartındakı ad da hərflərlə və böyük hərflə yazılır.

## «Bizimlə əlaqə» (`/elaqe`)

«Telefon və ya e-poçt» sahəsi istənilən mətni qəbul edirdi. İndi «Cavabı hara göndərək?» sualı altında iki düymə var: «Telefon» seçiləndə maskalı nömrə sahəsi, «E-poçt» seçiləndə e-poçt sahəsi açılır. Hesabda yalnız e-poçt varsa, «E-poçt» seçili açılır. API-yə yenə bir `contact` sətri gedir.

## API (backend)

`PersonNames.IsValid` (`backend/src/GreenStore.Api/Common/PersonNames.cs`) sayt ilə eyni qaydadır. Uyğun gəlməyən ad mövcud `invalid` kodunu alır (400 `validation`), yeni kod əlavə olunmayıb:

| Endpoint | Sahə |
|---|---|
| `POST /accounts`, `PATCH /me` | `fullName` |
| `PATCH /me/seller` | `contactPerson` |
| `POST /listings`, `PUT /me/listings/{id}` (elan) | `contactName` |
| `POST /support` | `name` |

Testlər: `PersonNamesTests` və hər qaydanın öz testlərində bir `invalid` halı.

## Sadə qaydalar

- Kateqoriya redaktorunda (admin) «Görünmə sırası» yalnız rəqəm qəbul edir.
- Giriş formasındakı «Telefon və ya e-poçt» sahəsi qəsdən dəyişmədi. Orada e-poçt da yazılır və şifrə menecerləri bu sahəni «username» kimi doldurur.
