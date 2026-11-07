import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JsonLd } from './StructuredData'

describe('JsonLd', () => {
  it('escapes "<" so data can never close the script element', () => {
    const html = renderToStaticMarkup(<JsonLd data={{ name: '</script><script>alert(1)</script>' }} />)
    expect(html).toContain('application/ld+json')
    expect(html).not.toContain('</script><script>')
    expect(JSON.parse(html.replace(/^<script[^>]*>|<\/script>$/g, ''))).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})
