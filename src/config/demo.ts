/**
 * DEMO MODE — this frontend has no backend yet.
 *
 * - Every listing, seller, service, user, statistic and admin record in `src/data/*` is sample data copied from the
 *   approved Figma design. None of it is real.
 * - Authentication is simulated in the browser (`src/app/store.tsx`): any well-formed phone/e-mail and password signs
 *   in the demo seller account. No credentials are sent anywhere or checked by a server.
 * - Everything a visitor creates (favourites, posted ads, profile edits, moderation decisions) lives only in that
 *   browser's localStorage.
 *
 * The demo banner is shown unless the build sets `VITE_DEMO_MODE=false` (only do that once a real API is connected).
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false'

/** Pre-filled on the demo login form. NOT a real credential — nothing checks it. */
export const DEMO_LOGIN_PASSWORD = 'greenstore'
