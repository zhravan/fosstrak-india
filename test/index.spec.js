import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

const createEnv = (initialEvents = []) => {
 const store = { events: initialEvents };
 return { store, EVENTS: {
   async get(key,type) { return key === 'events' && type === 'json' ? store.events : null; },
   async put(key,value) { if(key === 'events') store.events = JSON.parse(value); }
 }};
};
const submitBody = (values = {}) => new URLSearchParams({
 commonName:'FOSS India Meetup', fullName:'FOSS India Community Meetup',
 homepage:'https://example.org/events/foss-india', startDate:'2027-01-10', endDate:'2027-01-10',
 selfDescription:'A community meetup for free and open source software.', presentationForm:'physical',
 city:'Bengaluru', state:'Karnataka', ...values
});

describe('FOSSTrak India Worker', () => {
 it('renders the FOSS India event page with security headers', async () => {
  const env=createEnv([{commonName:'FOSS United',startDate:'2027-02-01',city:'Bengaluru',state:'Karnataka',presentationForm:'physical',selfDescription:'Community conference',homepage:'https://example.org'}]);
  const ctx=createExecutionContext(); const response=await worker.fetch(new Request('https://example.com/'),env,ctx); await waitOnExecutionContext(ctx);
  const html=await response.text(); expect(response.status).toBe(200); expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'"); expect(html).toContain('FOSSTrak India'); expect(html).toContain('FOSS United');
 });
 it('serves health without requiring KV', async () => {
  const response=await worker.fetch(new Request('https://example.com/healthz'),{}); expect(response.status).toBe(200); expect(await response.json()).toEqual({status:'ok',service:'fosstrak-india'});
 });
 it('hides pending submissions from the public event API', async () => {
  const env=createEnv([{id:'approved',commonName:'Published',status:'published'},{id:'pending',commonName:'Pending',status:'pending'}]);
  const response=await worker.fetch(new Request('https://example.com/api/events'),env); expect(await response.json()).toEqual([{id:'approved',commonName:'Published',status:'published'}]);
 });
 it('stores valid public submissions as pending review', async () => {
  const env=createEnv(); const response=await worker.fetch(new Request('https://example.com/submit',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:submitBody()}),env);
  expect(response.status).toBe(202); expect(env.store.events).toHaveLength(1); expect(env.store.events[0].status).toBe('pending'); expect(env.store.events[0].city).toBe('Bengaluru');
 });
 it('accepts JSON submissions through the public events API', async () => {
  const env=createEnv();
  const payload={commonName:'FOSS API Meetup',fullName:'FOSS API Community Meetup',homepage:'https://example.org/api-meetup',startDate:'2027-03-10',endDate:'2027-03-10',selfDescription:'A meetup submitted using the JSON API.',presentationForm:'hybrid',city:'Bengaluru',state:'Karnataka',eventTypes:['meetup','workshop']};
  const response=await worker.fetch(new Request('https://example.com/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),env);
  const result=await response.json();
  expect(response.status).toBe(202);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(result.status).toBe('pending');
  expect(result.id).toBeTruthy();
  expect(result.statusUrl).toContain(result.id);
  expect(env.store.events[0].eventTypes).toEqual(['meetup','workshop']);
 });
 it('answers CORS preflight for the public events API', async () => {
  const response=await worker.fetch(new Request('https://example.com/api/events',{method:'OPTIONS'}),{});
  expect(response.status).toBe(204);
  expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
 });
 it('rejects invalid date ranges', async () => {
  const env=createEnv(); const response=await worker.fetch(new Request('https://example.com/submit',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:submitBody({startDate:'2027-02-20',endDate:'2027-02-01'})}),env);
  expect(response.status).toBe(400); expect(env.store.events).toHaveLength(0);
 });
 it('handles legacy rows when checking duplicates', async () => {
  const env=createEnv([{name:'FOSS India Meetup',date:'2027-01-10'}]); const response=await worker.fetch(new Request('https://example.com/submit',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:submitBody()}),env);
  expect(response.status).toBe(409); expect(env.store.events).toHaveLength(1);
 });
 it('escapes event content and does not allow javascript URLs', async () => {
  const env=createEnv([{commonName:'<script>alert(1)</script>',startDate:'2027-02-01',city:'Chennai',state:'Tamil Nadu',presentationForm:'online',selfDescription:'<img src=x onerror=alert(1)>',homepage:'javascript:alert(1)',status:'published'}]);
  const response=await worker.fetch(new Request('https://example.com/'),env); const html=await response.text();
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;'); expect(html).not.toContain('<script>alert(1)</script>'); expect(html).not.toContain('href="javascript:alert(1)"');
 });
 it('rejects unsupported HTTP methods', async () => {
  const response=await worker.fetch(new Request('https://example.com/',{method:'DELETE'}),createEnv()); expect(response.status).toBe(405);
 });
 it('generates an iCalendar download for a published event', async () => {
  const env=createEnv([{id:'calendar-event',commonName:'FOSS India Meetup',startDate:'2027-01-10',endDate:'2027-01-11',city:'Bengaluru',state:'Karnataka',presentationForm:'physical',selfDescription:'Community meetup',homepage:'https://example.org',status:'published'}]);
  const response=await worker.fetch(new Request('https://example.com/events/calendar-event.ics'),env);
  const calendar=await response.text();
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toContain('text/calendar');
  expect(calendar).toContain('BEGIN:VCALENDAR');
  expect(calendar).toContain('SUMMARY:FOSS India Meetup');
  expect(calendar).toContain('DTSTART;VALUE=DATE:20270110');
  expect(calendar).toContain('DTEND;VALUE=DATE:20270112');
 });

});
