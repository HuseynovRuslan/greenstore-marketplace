import { describe, expect, it } from 'vitest'

/**
 * Every image path the app references must exist in public/images with the exact same case:
 * Vercel (Linux) serves files case-sensitively, so a typo would only show up as a broken image in staging.
 */
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/test/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const publicFiles = new Set(Object.keys(import.meta.glob('/public/images/**/*')).map((p) => p.replace(/^\/public/, '')))

function referencedImages(): Map<string, string[]> {
  const refs = new Map<string, string[]>()
  const add = (path: string, file: string) => refs.set(path, [...(refs.get(path) ?? []), file])
  for (const [file, code] of Object.entries(sources)) {
    // Literal paths: '/images/post-ad/upload-1.webp'
    for (const m of code.matchAll(/['"`](\/images\/[^'"`$]+)['"`]/g)) add(m[1], file)
    // Helper calls: const img = (file: string) => `/images/listings/${file}.webp` … img('zeytun-agaci-1')
    const helper = code.match(/const img = \(file: string\) => `\/images\/([^/]+)\/\$\{file\}\.webp`/)
    if (helper) for (const m of code.matchAll(/\bimg\('([^']+)'\)/g)) add(`/images/${helper[1]}/${m[1]}.webp`, file)
  }
  return refs
}

describe('static image assets', () => {
  it('finds the exported Figma images in public/images', () => {
    expect(publicFiles.size).toBeGreaterThanOrEqual(95)
  })

  it('every referenced /images path exists (case-sensitive)', () => {
    const refs = referencedImages()
    expect(refs.size).toBeGreaterThan(80)
    const missing = [...refs].filter(([path]) => !publicFiles.has(path)).map(([path, files]) => `${path} (in ${files.join(', ')})`)
    expect(missing).toEqual([])
  })
})
