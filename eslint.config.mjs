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
  {
    // Icon rule (CLAUDE.md): lucide-react for icons, @icons-pack/react-simple-icons for brand logos — never an
    // <svg> written by hand or a path copied into the code.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='svg']",
          message: 'İkonlar yalnız lucide-react-dan, brend loqoları @icons-pack/react-simple-icons-dan (CLAUDE.md).',
        },
      ],
    },
  },
  // .claude/** holds Claude Code skills (third-party CommonJS helper scripts), not application code.
  globalIgnores(['.next/**', 'out/**', 'dist/**', 'next-env.d.ts', 'coverage/**', '.claude/**']),
])
