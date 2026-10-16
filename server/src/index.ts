import OAuthProvider, { AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import type { ConsentDescription } from '@cloudflare/workers-oauth-provider';
import { z } from 'zod';
import { addEvent, DateStr, deleteEvent, EventPatch, InputError, listRange, NewEvent, search, sync, SyncBody, updateEvent } from './events';
import { type Access, createKey, deleteKey, keyAccess, listKeys, type Props } from './keys';
import { mcpHandler } from './mcp';
import { openapi } from './openapi';

const OWNER = 'owner'; // single-user calendar: every OAuth grant belongs to the owner

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const allowed = (have: Access, need: Access) =>
  have === 'owner' || need === 'read' || (need === 'write' && have === 'write');

async function api(request: Request, env: Env, props: Props) {
  const url = new URL(request.url);
  const [, , resource, id] = url.pathname.split('/');
  const route = `${request.method} /${resource}${id ? '/:id' : ''}`;
  const need: Access =
    resource === 'sync' || resource === 'keys' || resource === 'grants' ? 'owner' : request.method === 'GET' ? 'read' : 'write';
  if (!allowed(props.access, need)) return error(403, need === 'owner' ? 'Owner key required' : 'This key is read-only');

  try {
    switch (route) {
      case 'GET /me':
        return Response.json(props);
      case 'GET /events': {
        const q = url.searchParams.get('q');
        if (q) return Response.json(await search(env.DB, q));
        const range = z.object({ from: DateStr, to: DateStr }).parse(Object.fromEntries(url.searchParams));
        return Response.json(await listRange(env.DB, range.from, range.to));
      }
      case 'POST /events':
        return Response.json(await addEvent(env.DB, NewEvent.parse(await request.json())), { status: 201 });
      case 'PATCH /events/:id': {
        const event = await updateEvent(env.DB, id, EventPatch.parse(await request.json()));
        return event ? Response.json(event) : error(404, 'Not found');
      }
      case 'DELETE /events/:id':
        return (await deleteEvent(env.DB, id)) ? new Response(null, { status: 204 }) : error(404, 'Not found');
      case 'POST /sync':
        return Response.json(await sync(env.DB, SyncBody.parse(await request.json())));
      case 'GET /keys': {
        const grants = await env.OAUTH_PROVIDER.listUserGrants(OWNER);
        return Response.json({
          keys: await listKeys(env.DB),
          grants: grants.items.map((g) => ({ id: g.id, name: g.metadata?.name ?? g.clientId, scope: g.metadata?.access, created_at: g.createdAt * 1000 })),
        });
      }
      case 'POST /keys': {
        const input = z.object({ name: z.string().trim().min(1).max(100), scope: z.enum(['read', 'write']) }).parse(await request.json());
        return Response.json(await createKey(env.DB, input.name, input.scope), { status: 201 });
      }
      case 'DELETE /keys/:id':
        return (await deleteKey(env.DB, id)) ? new Response(null, { status: 204 }) : error(404, 'Not found');
      case 'DELETE /grants/:id':
        await env.OAUTH_PROVIDER.revokeGrant(id, OWNER);
        return new Response(null, { status: 204 });
      default:
        return error(404, 'Not found');
    }
  } catch (e) {
    if (e instanceof z.ZodError) return error(400, z.prettifyError(e));
    if (e instanceof InputError || e instanceof SyntaxError) return error(400, e.message);
    throw e;
  }
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const page = (title: string, body: string) =>
  `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font:17px/1.5 system-ui,sans-serif;max-width:28rem;margin:2rem auto;padding:0 1rem}
input[type=password]{width:100%;font:inherit;padding:.5rem;box-sizing:border-box}
button{font:inherit;padding:.6rem 1.2rem;margin-right:.5rem}label{display:block;margin:.4rem 0}</style>
${body}</html>`;

function consentPage(d: ConsentDescription, handle: string) {
  const name = escape(d.clientName);
  const wantsWrite = d.scope.length === 0 || d.scope.includes('calendar:write');
  return page(
    `Collegare ${name}?`,
    `<h1>Collegare «${name}» al calendario?</h1>
<p>${d.clientDomain ? `Pubblicata da <strong>${escape(d.clientDomain)}</strong>.` : 'Questa app si è registrata da sola: il nome non è verificato.'}
L'accesso verrà inviato a <strong>${escape(d.redirectHost)}</strong>.</p>
${d.redirectIsLoopback ? "<p><strong>L'accesso va a un programma su questo computer.</strong> Continua solo se l'hai appena avviato tu.</p>" : ''}
<form method="post">
<input type="hidden" name="handle" value="${escape(handle)}">
<label><input type="radio" name="access" value="read"${wantsWrite ? '' : ' checked'}> Solo lettura</label>
<label><input type="radio" name="access" value="write"${wantsWrite ? ' checked' : ''}> Lettura e scrittura</label>
<label>Chiave proprietario<input type="password" name="key" required autocomplete="current-password"></label>
<p><button name="decision" value="approve">Consenti</button><button name="decision" value="deny" formnovalidate>Rifiuta</button></p>
</form>`,
  );
}

const html = (body: string, status = 200, headers = new Headers()) => {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(body, { status, headers });
};

async function authorize(request: Request, env: Env) {
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (request.method === 'GET') {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return html(consentPage(details, consent.handle), 200, consent.headers);
    }
    const form = await request.formData();
    const handle = String(form.get('handle'));
    if (form.get('decision') !== 'approve') {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    // Checked before approveConsent, so a typo leaves the handle usable: going back retries.
    const owner = await keyAccess(env.DB, env.OWNER_KEY, String(form.get('key')));
    if (owner?.access !== 'owner') {
      return html(page('Chiave errata', '<p>Chiave proprietario errata.</p><p><button onclick="history.back()">Riprova</button></p>'), 403);
    }
    const access = form.get('access') === 'read' ? 'read' : 'write';
    const scope = access === 'write' ? ['calendar:read', 'calendar:write'] : ['calendar:read'];
    const approved = await oauth.approveConsent(request, handle, { scope });
    const client = await oauth.lookupClient(approved.request.clientId);
    const name = client?.clientName ?? approved.request.clientId;
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: OWNER,
      metadata: { name, access },
      scope,
      props: { access, name } satisfies Props,
    });
    approved.headers.set('Location', redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (e) {
    if (e instanceof AuthorizationError && e.redirectTo) return Response.redirect(e.redirectTo, 302);
    if (e instanceof AuthorizationError || e instanceof CimdFetchError) {
      const message = e instanceof AuthorizationError ? e.description : "Non è stato possibile verificare l'app.";
      return html(page('Errore', `<p>${escape(message ?? 'Richiesta non valida.')}</p>`), 400);
    }
    throw e;
  }
}

const site = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/authorize') return authorize(request, env);
    if (url.pathname === '/openapi.json') return Response.json(openapi(url.origin));
    if (url.pathname === '/')
      return new Response(`Calendario\n\nMCP: ${url.origin}/mcp\nHTTP API: ${url.origin}/openapi.json\n`);
    return new Response('Not found', { status: 404 });
  },
};

const apiHandler = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => api(request, env, ctx.props as Props),
};

// The resource has to be the public origin, which is only known per request (workers.dev, custom domain, localhost).
const providers = new Map<string, OAuthProvider<Env>>();
function provider(origin: string) {
  let p = providers.get(origin);
  if (!p) {
    p = new OAuthProvider<Env>({
      apiHandlers: { '/mcp': mcpHandler, '/api/': apiHandler },
      defaultHandler: site,
      authorizeEndpoint: '/authorize',
      tokenEndpoint: '/oauth/token',
      clientRegistrationEndpoint: '/oauth/register',
      scopesSupported: ['calendar:read', 'calendar:write'],
      resourceMetadata: { resource: origin, authorization_servers: [origin], resource_name: 'Calendario' },
      // Personal API keys and the owner key, for bots and scripts that don't do OAuth.
      resolveExternalToken: async ({ token, env }) => {
        const props = await keyAccess(env.DB, env.OWNER_KEY, token);
        return props && { props, audience: origin };
      },
    });
    providers.set(origin, p);
  }
  return p;
}

export default {
  fetch: (request, env, ctx) => provider(new URL(request.url).origin).fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
