import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';

declare global {
  // Injected by OAuthProvider into every handler's env.
  interface Env {
    OAUTH_PROVIDER: OAuthHelpers;
  }
}
