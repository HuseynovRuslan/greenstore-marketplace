/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "false" hides the demo banner. Defaults to showing it (see src/config/demo.ts). */
  readonly VITE_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
