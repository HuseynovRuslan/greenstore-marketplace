'use client'

/**
 * Inline script that runs while the HTML is parsed (before the first paint) and stays inert when React renders it in
 * the browser (e.g. the 404 boundary re-rendering the root layout), where React would otherwise warn about a
 * <script> it cannot execute. Pattern from Next.js "Preventing flash before hydration" (node_modules/next/dist/docs).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
