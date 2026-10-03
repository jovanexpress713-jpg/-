/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEMO_ACCOUNTS?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
