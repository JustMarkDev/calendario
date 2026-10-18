# Calendario

Android calendar app built with Expo. Each month is a vertical list with one line per day, like a paper planner. Notes live on the phone (SQLite) and sync with a small Cloudflare Worker, which also lets AI agents read and write the calendar.

## Download

Get the latest Android APK from [Releases](https://github.com/JustMarkDev/calendario/releases/latest). Play Store release coming later.

## App

```bash
bun install
bunx expo run:android   # development build (needed for the widget, reminders and background sync)
bun run lint
bun run typecheck
bun test                # date and color helpers
```

Release builds run on EAS: `bunx eas-cli build -p android --profile apk` for the APK attached to GitHub releases, `--profile production` for the Play Store bundle. The signing key lives in EAS.

The app works fully offline. To sync, open ⋮ → Impostazioni and enter the server address and the owner key.

## Server

`server/` is a Cloudflare Worker with D1. It serves the sync endpoint for the app, an MCP server and an HTTP API for agents, and the OAuth flow hosted assistants need.

```bash
cd server
bun install
bunx wrangler login
bunx wrangler deploy                                   # first run creates the D1 database and KV namespace
bunx wrangler d1 migrations apply calendario --remote
openssl rand -hex 24 | bunx wrangler secret put OWNER_KEY   # keep a copy: the app and OAuth consent ask for it
```

Local development: put `OWNER_KEY=…` in `server/.dev.vars`, then `bunx wrangler d1 migrations apply calendario --local && bun run dev`. `bun test` runs the sync tests against a throwaway local D1.

## Connecting agents

- **Hosted assistants** (ChatGPT, Claude and anything else that supports remote MCP with OAuth): add `https://<your-worker>/mcp` as a connector. The consent page asks for the owner key and lets you pick read-only or read-write.
- **Agents configured by hand** (Claude Code, Codex, Hermes, Grok bots…): create a key per agent in the app (Impostazioni → Agenti IA) and give the agent the MCP endpoint with `Authorization: Bearer cal_…`. For Claude Code the app shows the ready-made `claude mcp add` command. Agents without MCP can use the plain HTTP API described at `https://<your-worker>/openapi.json`.

Every connection shows up in the app and can be revoked there. MCP tools: `list_events`, `search_events`, and for read-write access `add_event`, `update_event`, `delete_event`. Deletes are soft, so they sync to the phone like any other change.
