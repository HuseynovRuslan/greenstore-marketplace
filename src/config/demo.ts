/**
 * DEMO MODE — the sample data and, with DATA_SOURCE=mock (the default), a simulated backend. What follows describes
 * the mock; with DATA_SOURCE=api accounts, favourites and saved searches are the GreenStore API's (README.md,
 * "Backend integration"), while the listings are still the seeded samples.
 *
 * - Every listing, seller, service, user, statistic and admin record in `src/data/*` is sample data copied from the
 *   approved Figma design. None of it is real.
 * - Authentication is simulated in the browser (`src/state/store.tsx`): any well-formed phone/e-mail and password signs
 *   in the demo seller account. No credentials are sent anywhere or checked by a server.
 * - Everything a visitor creates (favourites, posted ads, profile edits, moderation decisions) lives only in that
 *   browser's localStorage.
 *
 * The demo banner is shown unless the build sets `NEXT_PUBLIC_DEMO_MODE=false` (only do that once a real API is
 * connected). Indexing is controlled separately and stays off while the data source is mock — see src/seo/env.ts.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'

/** Pre-filled on the demo login form. NOT a real credential — nothing checks it. */
export const DEMO_LOGIN_PASSWORD = 'greenstore'
