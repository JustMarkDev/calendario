import { z } from 'zod';
import { EventPatch, NewEvent } from './events';

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const body = (name: string) => ({ required: true, content: { 'application/json': { schema: ref(name) } } });
const ok = (description: string, s?: object) => ({
  description,
  ...(s && { content: { 'application/json': { schema: s } } }),
});
const errors = {
  '400': ok('Invalid input', ref('Error')),
  '401': ok('Missing or unknown key'),
  '403': ok('The key is read-only', ref('Error')),
};
const idParam = [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }];

export const openapi = (origin: string) => ({
  openapi: '3.1.0',
  info: {
    title: 'Calendario',
    version: '1.0.0',
    description:
      'A personal paper-style calendar: each day holds short notes, usually in Italian. ' +
      'Authenticate with `Authorization: Bearer <key>`; keys are created in the app under Impostazioni → Accesso agenti. ' +
      `The same actions are available as an MCP server at ${origin}/mcp.`,
  },
  servers: [{ url: origin }],
  security: [{ bearer: [] }],
  paths: {
    '/api/events': {
      get: {
        operationId: 'listEvents',
        summary: 'List notes in a date range (from + to), or search their text (q)',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': ok('Notes', { type: 'array', items: ref('Event') }), ...errors },
      },
      post: {
        operationId: 'addEvent',
        summary: 'Add a note to a day',
        requestBody: body('NewEvent'),
        responses: { '201': ok('Created', ref('Event')), ...errors },
      },
    },
    '/api/events/{id}': {
      patch: {
        operationId: 'updateEvent',
        summary: 'Change a note; only the given fields change, null clears time/color/remind_minutes',
        parameters: idParam,
        requestBody: body('EventPatch'),
        responses: { '200': ok('Updated', ref('Event')), '404': ok('Not found'), ...errors },
      },
      delete: {
        operationId: 'deleteEvent',
        summary: 'Delete a note',
        parameters: idParam,
        responses: { '204': ok('Deleted'), '404': ok('Not found'), ...errors },
      },
    },
  },
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
    schemas: {
      NewEvent: schema(NewEvent),
      EventPatch: schema(EventPatch),
      Event: { allOf: [{ type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, ref('NewEvent')] },
      Error: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
});
