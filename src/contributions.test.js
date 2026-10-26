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
  it('records reviewer feedback and allows a contributor to revise a proposal', async () => {
    const proposal = {
      id: 'proposal-1',
      proposalType: 'edit',
      targetEventId: 'event-1',
      targetEventName: 'FOSS Pune',
      proposedChanges: { registrationLink: 'https://foss.example.org/register' },
      commonName: 'FOSS Pune',
      fullName: 'FOSS Pune Conference',
      homepage: 'https://foss.example.org/',
      startDate: '2027-03-20',
      endDate: '2027-03-20',
      selfDescription: 'A community FOSS event.',
      sourceUrl: 'https://foss.example.org/updates',
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    const env = makeEnv([publishedEvent, proposal]);
    env.FOSSTRAK_ADMIN_TOKEN = 'secret';
    const action = new FormData();
    action.set('id', 'proposal-1');
    action.set('action', 'request-changes');
    action.set('reviewerNote', 'Please confirm the registration link from an official source.');
    const auth = 'Basic ' + btoa('moderator:secret');
    const adminRequest = new Request('https://example.test/admin/action', {
      method: 'POST', body: action, headers: { Authorization: auth, Origin: 'https://example.test' }
    });
    const adminResponse = await handleContributionRoutes(adminRequest, env, new URL(adminRequest.url), [publishedEvent, proposal]);
    expect(adminResponse.status).toBe(303);
    const saved = JSON.parse(env.store.get('events'));
    expect(saved[1].status).toBe('changes-requested');
    expect(saved[1].reviewNote).toContain('official source');

    const revision = new FormData();
    revision.set('commonName', 'FOSS Pune');
    revision.set('fullName', 'FOSS Pune Conference');
    revision.set('homepage', 'https://foss.example.org/');
    revision.set('registrationLink', 'https://foss.example.org/register');
    revision.set('startDate', '2027-03-20');
    revision.set('endDate', '2027-03-20');
    revision.set('city', 'Pune');
    revision.set('state', 'Maharashtra');
    revision.set('venue', '');
    revision.set('selfDescription', 'A community FOSS event.');
    revision.set('sourceUrl', 'https://foss.example.org/updates');
    const reviseRequest = new Request('https://example.test/contributions/proposal-1/revise', { method: 'POST', body: revision });
    const reviseResponse = await handleContributionRoutes(reviseRequest, env, new URL(reviseRequest.url), saved);
    expect(reviseResponse.status).toBe(202);
    expect(JSON.parse(env.store.get('events'))[1].status).toBe('pending');
  });

  it('restores a prior event revision from an authenticated audit record', async () => {
    const oldEvent = { ...publishedEvent, commonName: 'Old event title' };
    const changedEvent = { ...publishedEvent, commonName: 'Changed event title' };
    const env = makeEnv([changedEvent]);
    env.FOSSTRAK_ADMIN_TOKEN = 'secret';
    const key = 'audit:123:revision';
    env.store.set(key, JSON.stringify({ action: 'proposal-approve', targetId: 'event-1', before: oldEvent, after: changedEvent }));
    const body = new FormData();
    body.set('key', key);
    const request = new Request('https://example.test/admin/rollback', {
      method: 'POST', body, headers: { Authorization: 'Basic ' + btoa('moderator:secret'), Origin: 'https://example.test' }
    });
    const response = await handleContributionRoutes(request, env, new URL(request.url), [changedEvent]);
    expect(response.status).toBe(303);
    expect(JSON.parse(env.store.get('events'))[0].commonName).toBe('Old event title');
  });

});
