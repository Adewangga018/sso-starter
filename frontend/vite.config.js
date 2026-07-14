import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// In dev the SPA and the SSO Hub backend must appear same-origin so the Identity
// session cookie works during the OIDC authorize flow. We proxy the backend paths
// to http://localhost:5283, mirroring the production subfolder deployment (/api).
// changeOrigin is left at its default (false) so the backend sees Host localhost:5173
// and issues a matching `issuer`, keeping oidc-client-ts happy.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // changeOrigin:false keeps Host: localhost:5173 so OpenIddict advertises the
      // proxied origin in its discovery endpoints (not the raw backend host).
      // Strip the /api prefix so the backend (at root in dev) sees the same root-relative
      // paths as in production, where IIS hosts it as the /api sub-application and removes
      // /api via PathBase. This keeps dev and prod routing identical.
      '/api': { target: 'http://localhost:5283', changeOrigin: false, rewrite: (p) => p.replace(/^\/api/, '') },
      '/connect': { target: 'http://localhost:5283', changeOrigin: false },
      '/.well-known': { target: 'http://localhost:5283', changeOrigin: false },
    },
  },
})
