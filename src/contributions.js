const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = (value) => { try { const url = new URL(String(value || '')); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const eventName = (e) => e.commonName || e.name || e.fullName || 'Untitled FOSS event';
const eventDate = (e) => e.startDate || e.date || '';
const eventDescription = (e) => e.selfDescription || e.description || e.shortDescription || '';
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value));
const publicEvent = (e) => e && !['pending', 'rejected', 'changes-requested', 'archived'].includes(e.status) && !e.proposalType;
const html = (body, status = 200, extra = {}) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>FOSSTrak India · Contributions</title><style>:root{color-scheme:light;--ink:#202a24;--muted:#66736a;--paper:#f7f7f2;--line:#dce2d9;--green:#285c43}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,sans-serif}header,main,footer{width:min(100% - 32px,820px);margin:auto}header{padding:24px 0 16px;border-bottom:1px solid var(--line)}header a{color:var(--green);font-weight:700;text-decoration:none}main{padding:28px 0 60px}.panel{background:white;border:1px solid var(--line);border-radius:8px;padding:clamp(18px,4vw,32px)}h1{font-size:clamp(1.7rem,4vw,2.2rem);line-height:1.2;letter-spacing:-.04em;margin:0 0 8px}p{color:var(--muted)}label{display:block;font-size:.88rem;font-weight:650;margin:0 0 6px}input,textarea,select{width:100%;min-height:42px;border:1px solid #cbd4ca;border-radius:4px;padding:10px;font:inherit;background:white;color:var(--ink)}textarea{min-height:100px;resize:vertical}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.field{margin:0 0 16px}.wide{grid-column:1/-1}button,.button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 15px;border:1px solid var(--green);border-radius:4px;background:var(--green);color:white;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}button.secondary,.button.secondary{background:white;color:var(--green)}.notice{padding:12px;border:1px solid #c7ddc8;background:#edf5ed;border-radius:4px}.error{padding:12px;border:1px solid #edc9c4;background:#fff1ef;border-radius:4px}.item{padding:16px 0;border-top:1px solid var(--line)}.item:first-child{border-top:0}.meta{font-size:.85rem;color:var(--muted)}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f4ef;padding:12px;border-radius:4px}@media(max-width:600px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.panel{padding:18px}}</style></head><body><header><a href="/">← FOSSTrak India</a></header><main><section class="panel">${body}</section></main><footer><p>Community-maintained FOSS events · Every accepted change is recorded.</p></footer></body></html>`, { status, headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', ...extra } });
const getEvents = async (env) => { const rows = await env.EVENTS.get('events','json'); return Array.isArray(rows) ? rows.filter(v => v && typeof v === 'object') : []; };
const putEvents = (env, rows) => env.EVENTS.put('events', JSON.stringify(rows));
const field = (form, key, max = 1000) => String(form.get(key) || '').trim().slice(0,max);
export const writeAudit = async (env, record) => env.EVENTS.put(`audit:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify({ ...record, at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 365 * 5 });
const sha256 = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
export const trustedScopes = async (token, env) => {
  if (!token || !env.FOSSTRAK_TRUSTED_CONTRIBUTORS) return [];
  try {
    const registry = JSON.parse(env.FOSSTRAK_TRUSTED_CONTRIBUTORS);
    const scopes = registry[await sha256(token)];
    return Array.isArray(scopes) ? scopes.filter(v=>['publish_events','publish_edits'].includes(v)) : [];
  } catch { return []; }
};
const rateLimited = async (request, env) => {
  if (!env.EVENTS) return false;
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return false;
  const hour = Math.floor(Date.now()/3600000);
  const key = 'rate:' + await sha256(ip + ':' + hour);
  const count = Number(await env.EVENTS.get(key) || 0);
  if (count >= 12) return true;
  await env.EVENTS.put(key,String(count+1),{expirationTtl:3600});
  return false;
};
const formPage = (title, action, event = {}, note = '') => html(`<h1>${escapeHtml(title)}</h1><p>Help keep the directory accurate. Link to an official source where possible. Proposed changes are reviewed before publication.</p>${note ? `<p class="notice">${escapeHtml(note)}</p>` : ''}<form method="post" action="${escapeHtml(action)}"><div class="grid"><div class="field"><label for="commonName">Event name *</label><input id="commonName" name="commonName" maxlength="100" required value="${escapeHtml(event.commonName || event.name || '')}"></div><div class="field"><label for="fullName">Full event name</label><input id="fullName" name="fullName" maxlength="160" value="${escapeHtml(event.fullName || '')}"></div><div class="field"><label for="homepage">Official event website *</label><input id="homepage" name="homepage" type="url" required value="${escapeHtml(event.homepage || '')}" placeholder="https://"></div><div class="field"><label for="registrationLink">Registration link</label><input id="registrationLink" name="registrationLink" type="url" value="${escapeHtml(event.registrationLink || '')}" placeholder="https://"></div><div class="field"><label for="startDate">Start date *</label><input id="startDate" name="startDate" type="date" required value="${escapeHtml(event.startDate || '')}"></div><div class="field"><label for="endDate">End date *</label><input id="endDate" name="endDate" type="date" required value="${escapeHtml(event.endDate || event.startDate || '')}"></div><div class="field"><label for="city">City / online</label><input id="city" name="city" value="${escapeHtml(event.city || '')}"></div><div class="field"><label for="state">State</label><input id="state" name="state" value="${escapeHtml(event.state || '')}"></div><div class="field wide"><label for="venue">Venue</label><input id="venue" name="venue" value="${escapeHtml(event.venue || '')}"></div><div class="field wide"><label for="selfDescription">Description *</label><textarea id="selfDescription" name="selfDescription" maxlength="5000" required>${escapeHtml(event.selfDescription || event.description || '')}</textarea></div><div class="field wide"><label for="sourceUrl">Source / announcement URL *</label><input id="sourceUrl" name="sourceUrl" type="url" required value="${escapeHtml(event.sourceUrl || event.homepage || '')}" placeholder="Link that confirms these details"></div><div class="field"><label for="contributorName">Your name (optional)</label><input id="contributorName" name="contributorName" maxlength="100"></div><div class="field"><label for="contributorEmail">Email for follow-up (optional)</label><input id="contributorEmail" name="contributorEmail" type="email" maxlength="254"></div><div class="field wide"><label for="trustedToken">Trusted contributor token (optional)</label><input id="trustedToken" name="trustedToken" type="password" autocomplete="off"><small>Only use a token issued by the FOSSTrak maintainers. It is never stored with your contribution.</small></div></div><p><button type="submit">Send for review</button></p></form>`, 200);
const basicAuth = (request, env) => {
  if (!env.FOSSTRAK_ADMIN_TOKEN) return { ok:false, missing:true };
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return { ok:false };
  let credentials = '';
  try { credentials = atob(header.slice(6)); } catch { return { ok:false }; }
  const password = credentials.slice(credentials.indexOf(':') + 1);
  const expected = String(env.FOSSTRAK_ADMIN_TOKEN);
  if (password.length !== expected.length) return { ok:false };
  let diff = 0; for (let i=0;i<password.length;i++) diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  return { ok:diff === 0 };
};
const adminGate = (request, env) => {
  const auth = basicAuth(request, env);
  if (auth.ok) return null;
  return html(`<h1>Moderation</h1><p>${auth.missing ? 'Admin access is not configured. Set the FOSSTRAK_ADMIN_TOKEN Worker secret before using moderation.' : 'Sign in with your moderator credentials. The username can be anything; use the configured admin token as the password.'}</p>`, auth.missing ? 503 : 401, auth.missing ? {} : { 'WWW-Authenticate':'Basic realm="FOSSTrak moderation", charset="UTF-8"' });
};
const adminPage = async (env) => {
  const rows = await getEvents(env);
  const pending = rows.filter(e => e.status === 'pending' || e.status === 'changes-requested');
  let audits = [];
  if (env.EVENTS.list) {
    const listed = await env.EVENTS.list({ prefix:'audit:', limit:50 });
    for (const key of listed.keys || []) {
      const item = await env.EVENTS.get(key.name,'json');
      if (item) audits.push({ ...item, _key:key.name });
    }
  }
  audits.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  return html(`<h1>Contribution review</h1><p>Review proposals before they affect the public calendar. New events, edits and reports share one queue.</p><h2>Waiting for review (${pending.length})</h2>${pending.length ? pending.map(item => `<article class="item"><h3>${escapeHtml(eventName(item))}</h3><p class="meta">${escapeHtml(item.proposalType || 'new-event')} · ${escapeHtml(item.submittedAt || '')} · ID ${escapeHtml(item.id)}</p><p>${escapeHtml(item.proposalType === 'edit' ? 'Suggested edit for ' + (item.targetEventName || item.targetEventId) : item.proposalType === 'report' ? 'Report: ' + (item.reportReason || '') : item.basedOn ? 'New edition based on ' + item.basedOn : 'New event submission')}</p>${item.sourceUrl ? `<p><a href="${escapeHtml(safeUrl(item.sourceUrl))}" rel="noopener noreferrer" target="_blank">Open source ↗</a></p>` : item.homepage ? `<p><a href="${escapeHtml(safeUrl(item.homepage))}" rel="noopener noreferrer" target="_blank">Open event website ↗</a></p>` : ''}<details><summary>Proposal data</summary><pre>${escapeHtml(JSON.stringify(item.proposedChanges || item,null,2))}</pre></details><div class="actions">${['approve','request-changes','reject'].map(action=>`<form method="post" action="/admin/action"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><input type="hidden" name="action" value="${action}"><button class="${action==='approve'?'':'secondary'}" type="submit">${action==='approve'?'Approve':action==='request-changes'?'Request changes':'Reject'}</button></form>`).join('')}</div></article>`).join('') : '<p class="notice">Nothing waiting for review.</p>'}<h2>Recent history</h2>${audits.length ? audits.map(item=>`<article class="item"><strong>${escapeHtml(item.action || 'Change')}</strong><p class="meta">${escapeHtml(item.at || '')} · ${escapeHtml(item.actor || 'moderator')} · ${escapeHtml(item.targetId || '')}</p><p>${escapeHtml(item.summary || '')}</p>${item.before || item.after ? `<form method="post" action="/admin/rollback"><input type="hidden" name="key" value="${escapeHtml(item._key || '')}"><button class="secondary" type="submit">Revert this change</button></form>` : ''}</article>`).join('') : '<p>No audit entries yet.</p>'}`,200);
};
const createProposal = async (request, env, type, targetId = '') => {
  const form = await request.formData();
  const events = await getEvents(env);
  const target = targetId ? events.find(e => String(e.id) === targetId && publicEvent(e)) : null;
  if (targetId && !target) return html('<h1>Event not found</h1><p>This event may have been removed or is no longer published.</p>',404);
  const sourceUrl = safeUrl(field(form,'sourceUrl',2048));
  if (!sourceUrl) return html('<h1>Source link required</h1><p>Please provide a valid official event or announcement URL and try again.</p><p><a href="/">Return to events</a></p>',400);
  if (type === 'report') {
    const reason = field(form,'reason',500);
    if (!reason) return html('<h1>Tell us what is wrong</h1><p>A short reason is required so moderators can investigate.</p>',400);
    const report = { id:crypto.randomUUID(), proposalType:'report', targetEventId:targetId, targetEventName:eventName(target), reportReason:reason, sourceUrl, contributorEmail:field(form,'contributorEmail',254), status:'pending', submittedAt:new Date().toISOString() };
    events.push(report); await putEvents(env,events); await writeAudit(env,{action:'report-submitted',targetId,summary:reason,actor:'community'}); 
    return html(`<h1>Report received</h1><p class="notice">Thanks for helping keep the directory accurate. Your reference is <strong>${escapeHtml(report.id)}</strong>.</p><p><a href="/">Back to events</a></p>`,202);
  }
  const data = {
    commonName:field(form,'commonName',100), fullName:field(form,'fullName',160), homepage:safeUrl(field(form,'homepage',2048)),
    registrationLink:safeUrl(field(form,'registrationLink',2048)), startDate:field(form,'startDate',10), endDate:field(form,'endDate',10),
    city:field(form,'city',100), state:field(form,'state',100), venue:field(form,'venue',200), selfDescription:field(form,'selfDescription',5000),
    sourceUrl, contributorName:field(form,'contributorName',100), contributorEmail:field(form,'contributorEmail',254)
  };
  const errors=[];
  if(!data.commonName||!data.homepage||!data.selfDescription) errors.push('Event name, valid website and description are required.');
  if(!validDate(data.startDate)||!validDate(data.endDate)||data.endDate<data.startDate) errors.push('Provide valid dates; the end date must not be before the start date.');
  if(errors.length) return html(`<h1>Check your submission</h1><p class="error">${escapeHtml(errors.join(' '))}</p><p><a href="javascript:history.back()">Go back and correct it</a></p>`,400);
  const duplicate = events.some(e => publicEvent(e) && eventName(e).trim().toLowerCase()===data.commonName.toLowerCase() && eventDate(e)===data.startDate);
  if(type!=='edit' && duplicate) return html('<h1>Possible duplicate</h1><p>An event with the same name and start date is already listed. Open the existing event and suggest an edit or contact a moderator.</p><p><a href="/">Browse events</a></p>',409);
  const scopes = await trustedScopes(field(form,'trustedToken',500),env);
  const proposal = { ...data, id:crypto.randomUUID(), proposalType:type, status:'pending', submittedAt:new Date().toISOString(), ...(target ? {targetEventId:target.id,targetEventName:eventName(target),proposedChanges:Object.fromEntries(Object.entries(data).filter(([key,value])=>value!=='' && value!==target[key]))} : {}), ...(type==='new-edition' ? {basedOn:targetId} : {}) };
  if(type==='edit' && scopes.includes('publish_edits')) {
    const before = JSON.parse(JSON.stringify(target));
    const allowed=['commonName','fullName','homepage','registrationLink','startDate','endDate','city','state','venue','selfDescription'];
    for(const key of allowed) if(Object.hasOwn(proposal.proposedChanges || {},key)) target[key]=proposal.proposedChanges[key];
    target.updatedAt=new Date().toISOString();
    await putEvents(env,events);
    await writeAudit(env,{action:'trusted-edit-published',targetId:target.id,summary:'Trusted contributor edit',actor:'trusted-contributor',before,after:JSON.parse(JSON.stringify(target))});
    return html('<h1>Edit published</h1><p class="notice">Your verified contribution has been published. The change is recorded in the audit history.</p><p><a href="/">Return to events</a></p>',200);
  }
  if(type!=='edit' && scopes.includes('publish_events')) {
    proposal.status='published'; proposal.publishedAt=new Date().toISOString(); delete proposal.proposalType; delete proposal.proposedChanges; delete proposal.contributorEmail;
    events.push(proposal); await putEvents(env,events);
    await writeAudit(env,{action:'trusted-event-published',targetId:proposal.id,summary:type,actor:'trusted-contributor',after:JSON.parse(JSON.stringify(proposal))});
    return html('<h1>Event published</h1><p class="notice">Your verified contribution is live. The publication is recorded in the audit history.</p><p><a href="/">View events</a></p>',201);
  }
  if(type==='edit' && !Object.keys(proposal.proposedChanges || {}).length) return html('<h1>No changes detected</h1><p>Nothing differs from the current event. <a href="/">Return to the calendar</a>.</p>',400);
  events.push(proposal); await putEvents(env,events); await writeAudit(env,{action:'proposal-submitted',targetId:proposal.targetEventId || proposal.id,summary:type,actor:'community'});
  return html(`<h1>Contribution received</h1><p class="notice">Thank you. Your ${escapeHtml(type==='edit'?'edit suggestion':type==='new-edition'?'new-edition submission':'event submission')} is waiting for review.</p><p>Reference ID: <strong>${escapeHtml(proposal.id)}</strong></p><p>Save this reference to check its status later.</p><p><a class="button" href="/contributions/${encodeURIComponent(proposal.id)}">Check contribution status</a></p><p><a href="/">Return to FOSSTrak</a></p>`,202);
};
export async function handleContributionRoutes(request, env, url, existingEvents) {
  const path = url.pathname;
  if(request.method==='POST' && path==='/submit' && await rateLimited(request,env)) return html('<h1>Slow down a moment</h1><p>Too many contributions from this connection. Please try again in about an hour.</p>',429,{'Retry-After':'3600'});
  if(request.method==='POST' && (path==='/report' || path.startsWith('/report/') || path.startsWith('/contribute/edit/') || (path.startsWith('/events/') && path.endsWith('/new-edition') || path.startsWith('/contributions/') && path.endsWith('/revise'))) && await rateLimited(request,env)) return html('<h1>Slow down a moment</h1><p>Too many contributions from this connection. Please try again in about an hour.</p>',429,{'Retry-After':'3600'});
  if (request.method==='GET' && path==='/admin') {
    const denied=adminGate(request,env); if(denied) return denied;
    try { return await adminPage(env); } catch { return html('<h1>Moderation unavailable</h1><p>Could not read the queue. Please retry.</p>',503); }
  }
  if (path==='/admin/action' && request.method==='POST') {
    const denied=adminGate(request,env); if(denied) return denied;
    if(!env.EVENTS) return html('<h1>Storage unavailable</h1>',503);
    const origin=request.headers.get('Origin'); if(origin && origin!==new URL(request.url).origin) return html('<h1>Request rejected</h1><p>Cross-origin moderation requests are not allowed.</p>',403);
    const form=await request.formData(); const id=field(form,'id',80); const action=field(form,'action',30);
    if(!['approve','reject','request-changes'].includes(action)) return html('<h1>Invalid moderation action</h1>',400);
    const rows=await getEvents(env); const proposal=rows.find(e=>e.id===id && (e.status==='pending'||e.status==='changes-requested'));
    if(!proposal) return html('<h1>Proposal not found</h1><p>It may already have been reviewed.</p><p><a href="/admin">Back to queue</a></p>',404);
    let beforeSnapshot=null; let afterSnapshot=null;
    if(action==='approve' && proposal.proposalType==='edit') {
      const target=rows.find(e=>String(e.id)===String(proposal.targetEventId) && publicEvent(e));
      if(!target) return html('<h1>Target event missing</h1><p>The edit was not applied. Review the proposal manually.</p><p><a href="/admin">Back to queue</a></p>',409);
      beforeSnapshot=JSON.parse(JSON.stringify(target));
      const allowed=['commonName','fullName','homepage','registrationLink','startDate','endDate','city','state','venue','selfDescription'];
      for(const key of allowed) if(Object.hasOwn(proposal.proposedChanges || {},key)) target[key]=proposal.proposedChanges[key];
      target.updatedAt=new Date().toISOString(); afterSnapshot=JSON.parse(JSON.stringify(target)); proposal.status='approved';
    } else if(action==='approve' && proposal.proposalType==='report') {
      proposal.status='resolved';
    } else if(action==='approve') {
      proposal.status='published'; proposal.publishedAt=new Date().toISOString(); delete proposal.proposalType; delete proposal.proposedChanges; delete proposal.contributorEmail; afterSnapshot=JSON.parse(JSON.stringify(proposal));
    } else proposal.status=action==='reject'?'rejected':'changes-requested';
    proposal.reviewedAt=new Date().toISOString(); proposal.reviewAction=action;
    await putEvents(env,rows);
    await writeAudit(env,{action:'proposal-'+action,targetId:proposal.targetEventId||proposal.id,summary:proposal.proposalType||'new-event',actor:'moderator',...(beforeSnapshot?{before:beforeSnapshot}:{}),...(afterSnapshot?{after:afterSnapshot}:{})});
    return new Response(null,{status:303,headers:{Location:'/admin','Cache-Control':'no-store'}});
  }
  if(path==='/admin/rollback' && request.method==='POST') {
    const denied=adminGate(request,env); if(denied) return denied;
    const origin=request.headers.get('Origin'); if(origin && origin!==new URL(request.url).origin) return html('<h1>Request rejected</h1><p>Cross-origin moderation requests are not allowed.</p>',403);
    const form=await request.formData(); const key=field(form,'key',200);
    if(!key.startsWith('audit:')) return html('<h1>Invalid audit reference</h1>',400);
    const record=await env.EVENTS.get(key,'json');
    if(!record || (!record.before && !record.after)) return html('<h1>This change cannot be reverted</h1><p>No saved revision is available.</p>',409);
    const rows=await getEvents(env); const target=rows.find(e=>String(e.id)===String(record.targetId));
    if(!target) return html('<h1>Event no longer exists</h1><p>Nothing was changed.</p>',404);
    if(record.before) {
      const id=target.id;
      for(const fieldName of Object.keys(target)) delete target[fieldName];
      Object.assign(target,record.before,{id,updatedAt:new Date().toISOString()});
    } else {
      target.status='archived'; target.archivedAt=new Date().toISOString();
    }
    await putEvents(env,rows);
    await writeAudit(env,{action:'rollback',targetId:target.id,summary:'Reverted audit record '+key,actor:'moderator',before:record.after||null,after:JSON.parse(JSON.stringify(target))});
    return new Response(null,{status:303,headers:{Location:'/admin','Cache-Control':'no-store'}});
  }
  if(path.startsWith('/contributions/') && path.endsWith('/revise') && request.method==='GET') {
    const id=decodeURIComponent(path.slice('/contributions/'.length,-'/revise'.length));
    const item=existingEvents.find(e=>e.id===id && e.status==='changes-requested' && e.proposalType!=='report');
    if(!item) return html('<h1>Revision unavailable</h1><p>This contribution is not waiting for changes, or it is a report.</p>',404);
    return formPage('Revise your contribution',`/contributions/${encodeURIComponent(id)}/revise`,item,'Update the requested details and resubmit. Your reference ID will stay the same.');
  }
  if(path.startsWith('/contributions/') && path.endsWith('/revise') && request.method==='POST') {
    const id=decodeURIComponent(path.slice('/contributions/'.length,-'/revise'.length));
    const rows=await getEvents(env); const item=rows.find(e=>e.id===id && e.status==='changes-requested' && e.proposalType!=='report');
    if(!item) return html('<h1>Revision unavailable</h1><p>This contribution is not waiting for changes.</p>',404);
    const form=await request.formData();
    const updates={
      commonName:field(form,'commonName',100),fullName:field(form,'fullName',160),homepage:safeUrl(field(form,'homepage',2048)),
      registrationLink:safeUrl(field(form,'registrationLink',2048)),startDate:field(form,'startDate',10),endDate:field(form,'endDate',10),
      city:field(form,'city',100),state:field(form,'state',100),venue:field(form,'venue',200),selfDescription:field(form,'selfDescription',5000),
      sourceUrl:safeUrl(field(form,'sourceUrl',2048)),contributorName:field(form,'contributorName',100),contributorEmail:field(form,'contributorEmail',254)
    };
    if(!updates.commonName||!updates.homepage||!updates.selfDescription||!updates.sourceUrl||!validDate(updates.startDate)||!validDate(updates.endDate)||updates.endDate<updates.startDate) return html('<h1>Check the revised details</h1><p class="error">Provide an event name, valid website, description, source URL and valid dates.</p><p><a href="javascript:history.back()">Go back</a></p>',400);
    if(item.proposalType==='edit') {
      const target=rows.find(e=>String(e.id)===String(item.targetEventId)&&publicEvent(e));
      if(!target) return html('<h1>Original event not found</h1><p>The proposal was not changed.</p>',409);
      item.proposedChanges=Object.fromEntries(Object.entries(updates).filter(([key,value])=>value!==''&&value!==target[key]));
    }
    Object.assign(item,updates,{status:'pending',revisedAt:new Date().toISOString(),submittedAt:new Date().toISOString()});
    delete item.reviewedAt; delete item.reviewAction;
    await putEvents(env,rows); await writeAudit(env,{action:'proposal-revised',targetId:item.targetEventId||item.id,summary:item.proposalType||'new-event',actor:'community'});
    return html(`<h1>Revision submitted</h1><p class="notice">Your changes have been sent for review. The reference ID is unchanged.</p><p><a class="button" href="/contributions/${encodeURIComponent(id)}">Check status</a></p>`,202);
  }
  if(request.method==='GET' && path.startsWith('/contributions/')) {
    const id=decodeURIComponent(path.slice('/contributions/'.length)); const item=existingEvents.find(e=>e.id===id);
    if(!item) return html('<h1>Contribution not found</h1><p>Check the reference ID and try again.</p>',404);
    const statusLabel={pending:'Waiting for review','changes-requested':'Changes requested',approved:'Approved',published:'Published',rejected:'Not accepted',resolved:'Report reviewed'}[item.status]||item.status;
    return html(`<h1>Contribution status</h1><p class="notice">${escapeHtml(statusLabel)}</p><p>Reference: <strong>${escapeHtml(item.id)}</strong></p><p>Submitted: ${escapeHtml(item.submittedAt || '')}</p>${item.reviewedAt?'<p>Reviewed: '+escapeHtml(item.reviewedAt)+'</p>':''}<p>${item.status==='changes-requested'?'A moderator has requested changes. Please submit an updated proposal or contact the project maintainers.':''}</p><p><a href="/">Return to events</a></p>`);
  }
  if(request.method==='GET' && path.startsWith('/contribute/edit/')) {
    const id=decodeURIComponent(path.slice('/contribute/edit/'.length)); const target=existingEvents.find(e=>String(e.id)===id&&publicEvent(e));
    if(!target) return html('<h1>Event not found</h1><p>This event cannot be edited through a public proposal.</p>',404);
    return formPage('Suggest an edit',`/contribute/edit/${encodeURIComponent(id)}`,target,'Only changed fields are proposed. A moderator reviews edits before they go live.');
  }
  if(request.method==='POST' && path.startsWith('/contribute/edit/')) return createProposal(request,env,'edit',decodeURIComponent(path.slice('/contribute/edit/'.length)));
  if(request.method==='GET' && path.startsWith('/events/') && path.endsWith('/new-edition')) {
    const id=decodeURIComponent(path.slice('/events/'.length,-'/new-edition'.length)); const target=existingEvents.find(e=>String(e.id)===id&&publicEvent(e));
    if(!target) return html('<h1>Event not found</h1>',404);
    const next={...target,startDate:'',endDate:'',sourceUrl:target.homepage};
    return formPage('Add a new edition',`/events/${encodeURIComponent(id)}/new-edition`,next,'Details from the previous edition are prefilled. Update dates and links for the new edition.');
  }
  if(request.method==='POST' && path.startsWith('/events/') && path.endsWith('/new-edition')) {
    const id=decodeURIComponent(path.slice('/events/'.length,-'/new-edition'.length)); return createProposal(request,env,'new-edition',id);
  }
  if(request.method==='GET' && path.startsWith('/report/')) {
    const id=decodeURIComponent(path.slice('/report/'.length)); const target=existingEvents.find(e=>String(e.id)===id&&publicEvent(e));
    if(!target) return html('<h1>Event not found</h1>',404);
    return html(`<h1>Report an issue</h1><p>Flag an outdated date, broken link, cancellation or other factual issue with <strong>${escapeHtml(eventName(target))}</strong>.</p><form method="post" action="/report/${encodeURIComponent(id)}"><div class="field"><label for="reason">What needs attention? *</label><textarea id="reason" name="reason" required maxlength="500"></textarea></div><div class="field"><label for="sourceUrl">Evidence / source URL *</label><input id="sourceUrl" name="sourceUrl" type="url" required placeholder="https://"></div><div class="field"><label for="contributorEmail">Email (optional)</label><input id="contributorEmail" name="contributorEmail" type="email"></div><button type="submit">Send report</button></form>`);
  }
  if(request.method==='POST' && path.startsWith('/report/')) return createProposal(request,env,'report',decodeURIComponent(path.slice('/report/'.length)));
  if(request.method==='GET' && (path==='/api/events.csv' || path==='/events.csv')) {
    const rows=existingEvents.filter(publicEvent); const columns=['id','commonName','fullName','homepage','startDate','endDate','selfDescription','presentationForm','city','state','venue','registrationLink','mainOrganiser','updatedAt'];
    const csvCell=value=>{const raw=Array.isArray(value)?value.join('; '):String(value??'');return '"'+raw.replace(/"/g,'""')+'"';};
    const csv=[columns.join(','),...rows.map(row=>columns.map(key=>csvCell(row[key])).join(','))].join('\r\n')+'\r\n';
    return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="fosstrak-india-events.csv"','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
  }
  if(request.method==='GET' && path==='/api/schema') return Response.json({schemaVersion:1,license:'Repository code is MIT; verify event-content rights before reuse',eventFields:['id','commonName','fullName','homepage','startDate','endDate','selfDescription','presentationForm','city','state','venue','registrationLink','eventTypes','tags'],contributionWorkflow:['new-event','edit','new-edition','report'],statuses:['pending','changes-requested','approved','published','rejected','resolved'],sourcePolicy:'Include an official event page or reliable announcement URL for each contribution.'},{headers:{'Cache-Control':'public, max-age=3600'}});
  return null;
}
