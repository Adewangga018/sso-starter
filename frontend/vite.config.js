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
      '/api': { target: 'http://localhost:5283', changeOrigin: false },
      '/connect': { target: 'http://localhost:5283', changeOrigin: false },
      '/.well-known': { target: 'http://localhost:5283', changeOrigin: false },
    },
  },
})
