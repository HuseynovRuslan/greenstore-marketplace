# «Usta çağır» çıxarıldı (24 noyabr 2026)

Komandanın qərarı ilə xidmət sorğusu funksiyası («Usta çağır») həm saytdan, həm API-dən silindi. «Xidmətlər» bölməsi, xidmət elanları, xidmət kateqoriyaları və xidmət səhifəsində ustanın nömrəsi və WhatsApp qalır: müştəri ustaya özü zəng edir və ya yazır.

## Saytda nə dəyişdi

- Xidmət səhifəsində «Usta çağır» düyməsi və forması yoxdur. Əsas düymə indi «Nömrəni göstər»dir, altında «WhatsApp-a yaz». Telefonda aşağıdakı panel «Zəng et» və «WhatsApp»dır.
- `/xidmetler`-də «Usta çağır» düyməsi və «Uyğun usta tapmadınız?» bloku yoxdur. Boş nəticədə: «Filtrləri azaldın və ya başqa şəhər seçin.»
- `/kabinet/sorgular` («Gələn sorğular») səhifəsi və kabinetdəki tab silindi. Ünvan indi 404-dür.
- `/idareetme`-nin «İcmal»ında «Usta çağır» kartı yoxdur.

## Müqavilə (`src/services/repository.ts`, `src/types`)

Çıxarılanlar:

- metodlar: `submitServiceRequest`, `listIncomingServiceRequests`, `markServiceRequestSeen`;
- tiplər: `ServiceRequestInput`, `ServiceRequestResult`, `IncomingServiceRequest`, `IncomingServiceRequestPage`;
- `AdminOverview.serviceRequests`.

`backend/contracts/frontend-types.json` yenidən yazıldı (`node backend/seed/export.mjs`). Ətraflı: [backend-contract.md](backend-contract.md), 4.2.

## API

- Endpoint-lər silindi: `POST /api/v1/service-requests`, `GET /api/v1/me/service-requests`, `POST /api/v1/me/service-requests/{id}/seen`.
- `GET /api/v1/admin/overview` cavabında `serviceRequests` yoxdur.
- Ustalara SMS xəbəri (outbox-un `sms-notice` növü) silindi. Outbox indi yalnız keş yeniləmə xəbərlərini (`revalidate`) göndərir.
- `ServiceRequests__*` ayarları (`MaxRecipients`, `MaxPerPhonePerDay`, `MaxPerIpPerDay`, `DailyNoticeCap`) artıq oxunmur. Hostinqdə yazılıbsa, silmək olar.
- Kateqoriyanı silmək üçün indi yalnız elanlar və alt kateqoriyalar yoxlanır.

## Baza

Miqrasiya `20261124115452_RemoveServiceRequests`:

- `service_request_recipients` və `service_requests` cədvəllərini və `service_request_number_seq` ardıcıllığını silir;
- outbox-dakı `sms-notice` sətirlərini silir (köhnə dispatcher-in növbəsində qalanlar).

Diqqət: cədvəllərdəki sorğular geri qaytarılmır. Lazımdırsa, deploy-dan əvvəl `pg_dump` ilə saxlayın. Miqrasiyanın `Down` hissəsi cədvəlləri boş yaradır.

## Deploy ardıcıllığı

API və sayt `main`-dən birlikdə yenilənir. API-nin pre-deploy addımı (`migrate`) miqrasiyanı tətbiq edir. Bir neçə dəqiqəlik fərqdə köhnə saytın «Usta çağır» düyməsi 404 ala bilər. Bu, xəta mesajı ilə bitir, başqa təsiri yoxdur.
