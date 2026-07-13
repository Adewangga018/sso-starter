import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

// The SSO Hub (OpenIddict) authority.
// - Dev: same origin as the SPA (http://localhost:5173), proxied to the backend by Vite.
// - Prod: the backend subfolder, e.g. https://my.gcs-gresik.com/api (set via VITE_SSO_AUTHORITY).
const authority = import.meta.env.VITE_SSO_AUTHORITY || window.location.origin

// Single shared OIDC client for the whole app. Uses Authorization Code + PKCE
// (response_type "code") and refresh tokens (offline_access) for silent renewal.
export const userManager = new UserManager({
  authority,
  client_id: 'mygcs-spa',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid profile email roles mygcs.api offline_access',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
  monitorSession: false,
})

export async function getAccessToken() {
  const user = await userManager.getUser()
  return user && !user.expired ? user.access_token : null
}
