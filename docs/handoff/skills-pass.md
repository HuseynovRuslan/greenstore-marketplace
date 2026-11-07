# Skills review pass — new pages (Nov 2026)

A second pass over the pages built in [pages-v2](pages-v2.md): the posting flow, auth, the listing page, sellers,
kabinet, saved searches, favourites, `/reklam`, services, the help pages, 404 and the footer. Each skill was loaded and
applied on its own; one commit per skill. Branch `nextjs-migration`, not pushed. Checks before every commit: lint,
typecheck, tests (251), build.

| Skill | Commit | Findings | Fixed | Not fixed (why) |
|---|---|---|---|---|
| frontend-design, emil-design-eng, apple-design | `65266c3` | Posting steps snapped with no direction; a step change waited for the server (dynamic route, no prefetch); reordered photos jumped; a forest «Önə çıxar» button on every kabinet row; «Elan yerləşdir» twice on kabinet; seller services in the old card; toast timers restarted on each new toast; «→» glued to a link | All | Undo after deleting a photo (needs an actionable toast pattern); the kabinet tab underline does not slide (each tab is a page) |
| ux-writing | `0b2f558` | «Elanı şikayət et» (wrong case); error summary names ≠ field labels; «Nəyə görə» (reads as "why"); «Qiymət / Dəqiq qiymət»; «Bitki harada» for tools; unexplained «Ən çox»; «Şəkil 2-i sil»; «Çıx» vs «Çıxış»; «Ləğv et» that cancelled nothing; «Saxla / Sil» dialogs; «daxil edin» vs «yazın»; «Alınmadı»; profile labels as instructions; weaker profile password rule; «Kim kimi…»; «Aç»; «Göndər»; /reklam named after one package | All | Terms and privacy text (needs a lawyer); help articles not rewritten |
| mobile-native | `ce71ef0` | Bottom bars over the keyboard; no `interactive-widget`, `theme-color`; grey tap flash; 14 px progress links, 30 px photo arrows, 40 px bottom-nav items, 19 px contact links; no «search» return key; the services photo viewer had no swipe or safe areas | All | Needs a real phone: camera / photo picker on iOS and Android, HEIC conversion, keyboard behaviour in iOS Safari |
| break-ui | `8b3e527` | Price cut in the phone contact bar; broken-image boxes for a missing logo or photo; «« initials; «bir gün» for a two-day reply; seller name cut to one line; Instagram handle out of the card; kabinet promotion badge on two lines; duplicate React keys; two-line breadcrumb; «— ₼» placeholder | All | — |
| accessibility-audit | `01d7273` | Focus hidden under the posting bar at 390 px (2.4.11); focus lost after moving / deleting a photo and after sending (2.4.3); error summary re-announced on every keystroke; reorder and resent code not announced (4.1.3); two h1 on the review step (1.3.1); pulsing «Yüklənir…» at 2:1 (1.4.3) | All | Not tested with NVDA / VoiceOver (accessibility tree used instead) or Windows High Contrast |
| review-animations | — | — | — | Could not be loaded: the skill is marked user-invocable only. Run `/review-animations` yourself; motion was covered by emil-design-eng and apple-design above |
| design-critique | `47083b2` | Ten weakest spots, ranked: /reklam bar over the packages; five actions per kabinet row; 15-field step 2; «Bitki və ya məhsul haqqında» for services; kabinet tabs off screen; guests surprised at step 6; sharing a not-yet-live link; «95» vs «6» on /xidmetler; «0» filters on empty favourites; duplicate step links | All ten | — |

## Tools added

- `/dev/worst-case/sehifeler?view=elan|satici|kabinet|onizleme&data=demo|worst|empty|one` — the listing page, seller
  page, kabinet rows and posting previews with schema-limit data (`src/dev/worstPages.ts`). Dev only (404 in production).
- `src/lib/useBrokenImage.ts` — falls back when an image fails, also before hydration.
- `QuietFieldErrors` (Field.tsx) — field errors are not live regions inside a form with an error summary.

## Before / after

[`.screenshots/skills-pass/`](../../.screenshots/skills-pass/) (local, not in git) — the ten most visible changes, before (`81fa83f`) on the left, after on the right, both
from production builds with the same script:

| File | Change |
|---|---|
| `01-kabinet-rows-1440.jpg` | One «Elan yerləşdir»; «Önə çıxar» in its own colours; «Daha çox» holds «Deaktiv et» and «Sil» |
| `02-kabinet-rows-390.jpg` | Two button rows per listing instead of three |
| `03-posting-step2-groups-1440.jpg` | «Bitki» and optional «Qulluq» groups |
| `04-promotion-first-screen-1440.jpg` | No bar over the packages; «Reklam paketləri» in the breadcrumb |
| `05-seller-services-1440.jpg` | Services in the catalogue's card |
| `06-kabinet-tabs-390.jpg` | The selected «Qaralamalar» tab in view, faded edge |
| `07-favourites-empty-390.jpg` | No «0» filters above the empty state |
| `08-posting-step1-guest-390.jpg` | «Bağla», the guest note, no «Ləğv et» |
| `09-service-portfolio-viewer-390.jpg` | The listing photo viewer with captions, swipe and zoom |
| `10-posting-step4-copy-1440.jpg` | «Sabit qiymət», «Vahid», «Ünvan» |
