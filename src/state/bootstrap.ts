/**
 * Pre-hydration state for the header (and the private pages' loading frames).
 *
 * The demo session and the banner dismissal live in browser storage, which the server cannot read, so server HTML
 * is always the signed-out, banner-visible version. This script runs in <head> before the first paint and marks
 * <html> with what the browser knows:
 *   data-auth="user"         a demo session exists (plus --gs-user-name, the name shown in the header)
 *   data-banner="dismissed"  the "Demo versiya" banner was closed in this browser session
 *   data-favorites="some|none"  whether the visitor's favourites list (account or guest) has items
 * Until React hydrates, components that depend on the session render both variants (classes `auth-user` /
 * `auth-guest`) and CSS in src/styles/index.css shows the right one, so nothing flips after hydration.
 * See Next.js "Preventing flash before hydration" (node_modules/next/dist/docs/01-app/02-guides).
 */
export const SESSION_KEY = 'greenstore:session'
export const BANNER_DISMISSED_KEY = 'greenstore:demo-banner-dismissed'
export const GUEST_FAVORITES_KEY = 'greenstore:favorites:guest'
/** Signed-in favourites; a missing key means the seeded Figma list (never empty). */
export const ACCOUNT_FAVORITES_KEY = 'greenstore:favorites:account'

export const PRE_HYDRATION_SCRIPT = `(function(){var d=document.documentElement,s=null;try{s=JSON.parse(localStorage.getItem(${JSON.stringify(SESSION_KEY)})||"null");if(s){d.setAttribute("data-auth","user");d.style.setProperty("--gs-user-name",JSON.stringify(String(s.fullName||"")))}}catch(e){}try{var f=s?JSON.parse(localStorage.getItem(${JSON.stringify(ACCOUNT_FAVORITES_KEY)})||"null"):JSON.parse(localStorage.getItem(${JSON.stringify(GUEST_FAVORITES_KEY)})||"[]");d.setAttribute("data-favorites",(s&&f===null)||(f&&f.length>0)?"some":"none")}catch(e){}try{if(JSON.parse(sessionStorage.getItem(${JSON.stringify(BANNER_DISMISSED_KEY)})||"false"))d.setAttribute("data-banner","dismissed")}catch(e){}})()`

/** Class for an element that is only rendered before hydration, for one of the two session states. */
export const preHydrationClass = (variant: 'user' | 'guest') => (variant === 'user' ? 'auth-user' : 'auth-guest')
