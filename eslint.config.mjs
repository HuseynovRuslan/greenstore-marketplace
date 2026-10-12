import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Product photos are pre-sized 1x WebP exports from Figma served from /public with fixed CSS boxes, and the
      // listing cards use <picture> art direction per breakpoint. next/image is planned for user uploads (object
      // storage) — see MIGRATION_REPORT.md.
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'dist/**', 'next-env.d.ts', 'coverage/**']),
])
