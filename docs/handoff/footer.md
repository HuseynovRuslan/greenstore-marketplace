# Site footer (direction A)

For: whoever deploys the site, and Ruslan (backend) for the open questions at the end.
Design: `docs/design/footer/` (desktop 1440 and mobile 390 images; the ChatGPT draft it started from).
Status: frontend only. `src/services/repository.ts` and `src/types` are unchanged.

## Social links — environment variables

The four icons in the footer's bottom row only appear when their profile URL is set. A value that is not an
`https://` URL is ignored, so a typo hides the icon instead of linking somewhere wrong.

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL` | `https://www.instagram.com/<profile>` |
| `NEXT_PUBLIC_SOCIAL_FACEBOOK_URL` | `https://www.facebook.com/<page>` |
| `NEXT_PUBLIC_SOCIAL_TIKTOK_URL` | `https://www.tiktok.com/@<profile>` |
| `NEXT_PUBLIC_SOCIAL_WHATSAPP_URL` | `https://wa.me/994XXXXXXXXX` |

- The home page is prerendered, so set them **before `next build`**; changing them needs a new build.
- In `next dev` the missing ones show placeholders (each network's home page) so the row can be reviewed.
  Tests and production builds never show a placeholder.
- They are also listed, commented out, in `.env.example`.

## Where the links come from

`src/components/layout/footerLinks.ts`:

- **Kateqoriyalar** — `src/data/categories.ts`, the same list and order as the home page categories row. At most
  10; when there are more, a «Bütün kateqoriyalar» link opens the home page row (`/#kateqoriyalar`, like the
  header's «Kateqoriyalar»). Product categories link to `/kateqoriyalar/{id}`, the services umbrella to `/xidmetler`
  (`categoryHref` in `src/seo/catalog.ts`, shared with the home page).
- **Şəhərlər** — `src/data/cities.ts`, each to `/elanlar?seher={id}` (built with the catalogue's own `catalogHref`).
- The rest are fixed routes:

| Link | URL |
|---|---|
| Elan yerləşdir | `/elan-yerlesdir` |
| Önə çıxar / İrəli çək | `/reklam#one-cixar` / `/reklam#ireli-cek` (the package cards' ids) |
| Biznes hesabları | `/qeydiyyat?hesab=biznes` (registration opens with «Biznes» chosen) |
| Elan qaydaları | `/qaydalar` |
| Tez-tez verilən suallar | `/komek` |
| Təhlükəsiz alış | `/tehlukesiz-alis` |
| Problem bildir | `/elaqe?movzu=sikayet` (contact form opens on «Satıcı və ya alıcıdan şikayət») |
| Haqqımızda | `/haqqimizda` (placeholder, noindex) |
| Bitkiyə qulluq məsləhətləri | `/bitkiye-qulluq` (placeholder, noindex) |
| Əlaqə | `/elaqe` |
| İstifadə şərtləri / Məxfilik siyasəti | `/istifade-sertleri` / `/mexfilik` |
| Sayt xəritəsi | `/sayt-xeritesi` (lists the same links; in `sitemap.xml`) |
| Tanıtım paketləri (sellers' card) | `/reklam` |

New query parameters: `movzu` on `/elaqe` (`elan`, `hesab`, `odenis`, `sikayet`, `diger`) and `hesab` on
`/qeydiyyat` (`biznes`, `ferdi`). Both only preselect a field; the visitor can change it.

## Behaviour

- Under 768 px the groups are accordions («Kateqoriyalar» open), animated with Motion (height + opacity, chevron
  turn), instant with reduced motion. Each group opens on its own. 768–1279 px: three columns. From 1280 px: one
  row beside the brand block.
- The full footer is on the home page; inner pages keep the one-row compact footer, which now also has
  «Sayt xəritəsi».
- Weight: the brand icons render on the server (0 bytes of JS; ≈ 4.8 KB of HTML, 2 KB gzip, once all four URLs are
  set). The accordions add 1.5 KB gzip to the home page's first load and nothing to other pages: `HomeFrame` lives in
  its own module (`src/components/layout/HomeFrame.tsx`), and `m` comes from `motion/react-m` — imported from
  `motion/react` it pulls Motion's whole `domAnimation` bundle (≈ 36 KB gzip) into the first load.

## Open questions

- **«Problem bildir»** uses the existing topic `complaint`. If it should also cover site bugs, the API needs a new
  `SupportMessageInput['topic']` value (contract change).
- **Copy** taken from the design that differs from the rest of the site: «Yoxlanılmış satıcılar» (the badge says
  «Təsdiqlənmiş satıcı», and not every seller is verified) and «Tanıtım paketləri» (the page is «Reklam paketləri»).
- **Placeholders** `/haqqimizda` and `/bitkiye-qulluq` need real text before launch.
