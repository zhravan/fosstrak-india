import { describe, expect, it } from 'vitest';
import { handleContributionRoutes } from './contributions.js';

const publishedEvent = {
  id: 'event-1',
  commonName: 'FOSS Pune',
  fullName: 'FOSS Pune Conference',
  homepage: 'https://foss.example.org/',
  startDate: '2027-03-20',
  endDate: '2027-03-20',
  selfDescription: 'A community FOSS event.',
  presentationForm: 'physical',
  city: 'Pune',
  state: 'Maharashtra',
  status: 'published'
};

function makeEnv(initial = []) {
  const store = new Map([['events', JSON.stringify(initial)]]);
  return {
    EVENTS: {
      async get(key, type) {
        const value = store.get(key);
        if (value == null) return null;
        if (type === 'json') { try { return JSON.parse(value); } catch { return null; } }
        return value;
      },
      async put(key, value) { store.set(key, value); },
      async list({ prefix = '' } = {}) { return { keys: [...store.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })) }; }
    },
    store
  };
}

describe('community contribution workflow', () => {
  it('keeps moderation unavailable until an admin secret is configured', async () => {
    const env = makeEnv();
    const response = await handleContributionRoutes(new Request('https://example.test/admin'), env, new URL('https://example.test/admin'), []);
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('FOSSTRAK_ADMIN_TOKEN');
  });

  it('requires moderator authentication', async () => {
    const env = makeEnv();
    env.FOSSTRAK_ADMIN_TOKEN = 'secret';
    const response = await handleContributionRoutes(new Request('https://example.test/admin'), env, new URL('https://example.test/admin'), []);
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
  });

  it('records edit proposals without changing the published event', async () => {
    const env = makeEnv([publishedEvent]);
    const body = new FormData();
    body.set('commonName', 'FOSS Pune');
    body.set('fullName', 'FOSS Pune Conference');
    body.set('homepage', 'https://foss.example.org/');
    body.set('registrationLink', 'https://foss.example.org/register');
    body.set('startDate', '2027-03-20');
    body.set('endDate', '2027-03-20');
    body.set('city', 'Pune');
    body.set('state', 'Maharashtra');
    body.set('venue', '');
    body.set('selfDescription', 'A community FOSS event.');
    body.set('sourceUrl', 'https://foss.example.org/updates');
    const request = new Request('https://example.test/contribute/edit/event-1', { method: 'POST', body });
    const response = await handleContributionRoutes(request, env, new URL(request.url), [publishedEvent]);
    expect(response.status).toBe(202);
    const saved = JSON.parse(env.store.get('events'));
    expect(saved[0].registrationLink).toBeUndefined();
    expect(saved[1].proposalType).toBe('edit');
    expect(saved[1].targetEventId).toBe('event-1');
    expect(saved[1].proposedChanges.registrationLink).toBe('https://foss.example.org/register');
  });

  it('exports a schema and filters CSV output to public events', async () => {
    const env = makeEnv([publishedEvent, { id: 'private', commonName: 'Pending', status: 'pending' }]);
    const schemaUrl = new URL('https://example.test/api/schema');
    const schema = await handleContributionRoutes(new Request(schemaUrl), env, schemaUrl, []);
    expect(schema.status).toBe(200);
    expect((await schema.json()).schemaVersion).toBe(1);
    const csvUrl = new URL('https://example.test/api/events.csv');
    const csv = await handleContributionRoutes(new Request(csvUrl), env, csvUrl, [publishedEvent, { id: 'private', commonName: 'Pending', status: 'pending' }]);
    const text = await csv.text();
    expect(text).toContain('FOSS Pune');
    expect(text).not.toContain('Pending');
  });
});
