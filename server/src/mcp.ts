import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { addEvent, DateStr, deleteEvent, EventPatch, listRange, NewEvent, search, updateEvent } from './events';
import type { Props } from './keys';

export const todayIn = (timeZone: string) => new Date().toLocaleDateString('en-CA', { timeZone });

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });
const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

function calendarServer(env: Env, props: Props) {
  const server = new McpServer(
    { name: 'calendario', version: '1.0.0' },
    {
      instructions:
        `A personal paper-style calendar: every day holds a few short notes, usually in Italian. ` +
        `Today is ${todayIn(env.TIMEZONE)} (${env.TIMEZONE}). Dates are YYYY-MM-DD, times HH:MM 24h local time.` +
        (props.access === 'read' ? ' This connection is read-only.' : ''),
    },
  );
  const db = env.DB;
  const readOnly = { readOnlyHint: true };

  server.registerTool(
    'list_events',
    {
      description: 'List the notes between two dates, inclusive.',
      inputSchema: z.object({ from: DateStr, to: DateStr }),
      annotations: readOnly,
    },
    async ({ from, to }) => json(await listRange(db, from, to)),
  );
  server.registerTool(
    'search_events',
    {
      description: 'Find notes whose text contains the query (case-insensitive), newest first.',
      inputSchema: z.object({ query: z.string().min(1) }),
      annotations: readOnly,
    },
    async ({ query }) => json(await search(db, query)),
  );
  if (props.access === 'read') return server;

  server.registerTool(
    'add_event',
    { description: 'Add a note to a day.', inputSchema: NewEvent },
    async (input) => json(await addEvent(db, input)),
  );
  server.registerTool(
    'update_event',
    {
      description: 'Change a note. Only the given fields change; pass null to clear time, color or remind_minutes.',
      inputSchema: EventPatch.extend({ id: z.string() }),
      annotations: { idempotentHint: true },
    },
    async ({ id, ...patch }) => {
      const event = await updateEvent(db, id, patch);
      return event ? json(event) : fail(`No note with id ${id}`);
    },
  );
  server.registerTool(
    'delete_event',
    {
      description: 'Delete a note.',
      inputSchema: z.object({ id: z.string() }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ id }) => ((await deleteEvent(db, id)) ? json({ deleted: id }) : fail(`No note with id ${id}`)),
  );
  return server;
}

export const mcpHandler = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    createMcpHandler(() => calendarServer(env, ctx.props as Props), { responseMode: 'json' }).fetch(request),
};
