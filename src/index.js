import { handleContributionRoutes, trustedScopes, writeAudit } from './contributions.js';
const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = (value) => { try { const url = new URL(String(value || '')); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const eventName = (e) => e.commonName || e.name || e.fullName || 'Untitled FOSS event';
const eventDate = (e) => e.startDate || e.date || '';
const eventLocation = (e) => [e.venue, e.city, e.state, e.location].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || (e.presentationForm === 'online' ? 'Online' : 'Location to be announced');
const eventType = (e) => Array.isArray(e.eventTypes) && e.eventTypes.length ? e.eventTypes.join(', ') : e.type || e.presentationForm || 'FOSS event';
const eventTags = (e) => Array.isArray(e.tags) ? e.tags : typeof e.tags === 'string' ? e.tags.split(/[,\n]/).map(v=>v.trim()).filter(Boolean) : [];
const eventDescription = (e) => e.selfDescription || e.description || e.shortDescription || '';
const readEvents = async (env) => { if (!env.EVENTS) return []; const rows = await env.EVENTS.get('events','json'); return Array.isArray(rows) ? rows.filter(row=>row && typeof row === 'object') : []; };
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value));

const HTML_TEMPLATE = (events, showForm = false, error = null, formData = {}, notice = null) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" href="/ft_logo.png">
  <title>FOSSTrak India - FOSS Events</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #202a24;
      --muted: #66736a;
      --paper: #f7f7f2;
      --surface: #fff;
      --line: #dce2d9;
      --green: #285c43;
      --green-dark: #1c4431;
      --green-pale: #eaf1e9;
      --orange: #d86b3d;
      --danger: #9d342c;
      --shadow: 0 1px 2px rgba(25, 43, 31, .05);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--paper);
      color: var(--ink);
      font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--green); text-underline-offset: 3px; }
    a:hover { color: var(--green-dark); }
    .header {
      padding: 22px 24px 18px;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
      color: var(--ink);
      text-align: left;
      box-shadow: none;
    }
    .header h1, .header p, .nav, .events-container, .filters, .event-form, .footer {
      width: min(100% - 40px, 1040px);
      margin-left: auto;
      margin-right: auto;
    }
    .header h1 { font-size: 1.25rem; line-height: 1.25; letter-spacing: -.035em; font-weight: 760; }
    .header p { margin-top: 5px; color: var(--muted); font-size: .92rem; }
    .nav {
      display: flex;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: 6px;
      padding: 14px 0;
      background: transparent;
    }
    .nav a {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 7px 12px;
      border: 1px solid transparent;
      border-radius: 5px;
      color: var(--muted);
      font-size: .92rem;
      font-weight: 560;
      text-decoration: none;
      transition: background .15s ease, color .15s ease, border-color .15s ease;
    }
    .nav a:hover { background: var(--green-pale); color: var(--green-dark); }
    .nav a[href="/submit"] { margin-left: auto; background: var(--green); color: white; }
    .nav a[href="/submit"]:hover { background: var(--green-dark); }
    .events-container { flex: 1; padding: 18px 0 48px; }
    .event-card {
      margin: 0 0 12px;
      padding: 20px 22px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 7px;
      box-shadow: none;
    }
    .event-card h2 { margin: 5px 0 3px; font-size: 1.2rem; line-height: 1.35; letter-spacing: -.02em; }
    .event-card p { margin: 10px 0; color: #48544c; overflow-wrap: anywhere; }
    .event-date { color: var(--green); font-size: .87rem; font-weight: 700; }
    .event-location { margin: 4px 0 12px; color: var(--muted); font-size: .9rem; }
    .event-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
    .tag { display: inline-block; padding: 3px 8px; background: var(--green-pale); color: var(--green-dark); border-radius: 3px; font-size: .78rem; }
    .filters { margin-top: 10px; padding: 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 7px; box-shadow: none; }
    .filter-group { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .filter-item { min-width: 0; }
    .filter-item label { display: block; margin-bottom: 6px; color: var(--muted); font-size: .82rem; font-weight: 650; }
    .date-range { display: flex; align-items: center; gap: 8px; }
    .date-range span { color: var(--muted); font-size: .82rem; }
    .event-form {
      margin-top: 10px;
      margin-bottom: 52px;
      padding: clamp(20px, 4vw, 38px);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .form-intro { max-width: 680px; margin: 0 0 28px; }
    .eyebrow { margin: 0 0 8px; color: var(--green); font-size: .75rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
    .event-form h2 { margin: 0; font-size: clamp(1.7rem, 4vw, 2.2rem); line-height: 1.15; letter-spacing: -.045em; }
    .form-intro p:last-child { margin: 12px 0 0; color: var(--muted); max-width: 62ch; }
    .form-progress { display: flex; align-items: center; gap: 8px; margin-top: 18px; color: var(--muted); font-size: .8rem; }
    .form-progress::before { content: ""; width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: var(--orange); }
    .event-form fieldset {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px 16px;
      margin: 0 0 18px;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 6px;
      min-width: 0;
    }
    .event-form legend { padding: 0 8px 0 0; color: var(--ink); font-size: 1rem; font-weight: 750; letter-spacing: -.015em; }
    .form-group { min-width: 0; margin: 0; }
    .form-group:has(textarea), .form-group:has(.checkbox-group), .social-accounts { grid-column: 1 / -1; }
    label { display: block; margin-bottom: 6px; color: #344139; font-size: .86rem; font-weight: 650; }
    input, select, textarea {
      display: block;
      width: 100%;
      min-width: 0;
      min-height: 43px;
      padding: 10px 11px;
      border: 1px solid #cbd4ca;
      border-radius: 4px;
      background: #fff;
      color: var(--ink);
      font: inherit;
      font-size: .92rem;
      box-shadow: none;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    textarea { min-height: 110px; resize: vertical; line-height: 1.5; }
    input::placeholder, textarea::placeholder { color: #8a958d; opacity: 1; }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--green);
      box-shadow: 0 0 0 3px rgba(40, 92, 67, .12);
    }
    input[type="checkbox"] { width: 16px; min-height: 16px; height: 16px; margin: 0; accent-color: var(--green); }
    .checkbox-group { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin-top: 8px; }
    .checkbox-group label { display: flex; align-items: center; gap: 9px; margin: 0; font-weight: 500; }
    .social-accounts { display: contents; }
    .social-accounts h3 { grid-column: 1 / -1; margin: 4px 0 -4px; font-size: .95rem; }
    .submit-btn, button {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 44px;
      padding: 10px 18px;
      border: 1px solid var(--green);
      border-radius: 4px;
      background: var(--green);
      color: #fff;
      font: inherit;
      font-size: .92rem;
      font-weight: 700;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease;
    }
    .submit-btn:hover, button:hover { background: var(--green-dark); border-color: var(--green-dark); }
    .success-message, .error-message { margin: 18px 0; padding: 12px 14px; border-radius: 4px; font-size: .92rem; }
    .success-message { background: #edf5ed; border: 1px solid #c7ddc8; color: #235435; }
    .error-message { background: #fff1ef; border: 1px solid #edc9c4; color: var(--danger); }
    .empty-state { padding: clamp(42px, 8vw, 84px) 20px; text-align: center; color: var(--muted); }
    .empty-illustration { display: none; }
    .empty-state h2 { margin-bottom: 8px; color: var(--ink); font-size: 1.45rem; letter-spacing: -.03em; }
    .empty-state p { margin: 0; }
    .empty-state .cta { margin-top: 22px; display: flex; justify-content: center; }
    .empty-state .cta-btn { display: inline-flex; align-items: center; padding: 10px 15px; border: 1px solid var(--green); border-radius: 4px; background: var(--green); color: white; font-weight: 650; text-decoration: none; box-shadow: none; }
    .empty-state .cta-btn:hover { background: var(--green-dark); }
    .empty-state .cta-btn::after { content: " ↗"; }
    .footer { width: 100%; max-width: none; margin-top: auto; padding: 22px 20px; border-top: 1px solid var(--line); background: #f0f2eb; color: var(--muted); text-align: center; font-size: .82rem; }
    .footer p + p { margin-top: 3px; }
    @media (max-width: 680px) {
      .header { padding: 18px 0 15px; }
      .header h1, .header p, .nav, .events-container, .filters, .event-form { width: calc(100% - 28px); }
      .nav { padding: 10px 0; gap: 2px; }
      .nav a { padding: 7px 9px; font-size: .86rem; }
      .nav a[href="/submit"] { margin-left: 0; }
      .filter-group { grid-template-columns: 1fr; gap: 12px; }
      .event-form { padding: 20px 14px; }
      .event-form fieldset { grid-template-columns: 1fr; gap: 15px; padding: 18px 13px; }
      .form-group:has(textarea), .form-group:has(.checkbox-group), .social-accounts, .social-accounts h3 { grid-column: auto; }
      .checkbox-group { grid-template-columns: 1fr; gap: 11px; }
      .event-card { padding: 17px; }
      .date-range { align-items: stretch; }
      .date-range span { align-self: center; }
    }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; } }
  </style>
</head>
<body class="container">
  <header class="header">
    <h1>FOSSTrak India</h1>
    <p>Open Source Events in India</p>
  </header>
  <nav class="nav">
    <a href="/" class="nav-link">Upcoming</a>
    <a href="/#past" class="nav-link">Past Events</a>
    <a href="/submit" class="nav-link">Submit Event</a>
  </nav>

  ${showForm ? `
  <div class="event-form">
    <div class="form-intro"><p class="eyebrow">Community submissions</p><h2>Share a FOSS event</h2><p>Help people across India find conferences, meetups, workshops and hackathons. Add the details below; submissions are reviewed before they appear in the calendar.</p><div class="form-progress">Fields marked * are required · Usually takes a few minutes</div></div>
    ${notice ? `<div class="success-message" role="status">${escapeHtml(notice)}</div>` : ''}
    ${error ? `<div class="error-message" role="alert">${escapeHtml(error)}</div>` : ''}
    <form id="submitForm" method="POST" enctype="multipart/form-data">
      <fieldset>
        <legend>Mandatory Data</legend>
        <div class="form-group">
          <label for="commonName">Event name <span aria-hidden="true">*</span></label>
          <input type="text" id="commonName" name="commonName" maxlength="40" placeholder="e.g. FOSS United Conference" value="${escapeHtml(formData.commonName || '')}" autocomplete="organization" required>
        </div>
        <div class="form-group">
          <label for="fullName">Full event name <span aria-hidden="true">*</span></label>
          <input type="text" id="fullName" name="fullName" maxlength="80" placeholder="e.g. FOSS United Conference" value="${escapeHtml(formData.fullName || '')}" required>
        </div>
        <div class="form-group">
          <label for="homepage">Event website <span aria-hidden="true">*</span></label>
          <input type="url" id="homepage" name="homepage" placeholder="e.g. https://example.org" value="${escapeHtml(formData.homepage || '')}" required>
        </div>
        <div class="form-group">
          <label for="startDate">Start date <span aria-hidden="true">*</span></label>
          <input type="date" id="startDate" name="startDate" value="${escapeHtml(formData.startDate || '')}" required>
        </div>
        <div class="form-group">
          <label for="endDate">End date <span aria-hidden="true">*</span></label>
          <input type="date" id="endDate" name="endDate" value="${escapeHtml(formData.endDate || '')}" required>
        </div>
        <div class="form-group">
          <label for="selfDescription">Event description <span aria-hidden="true">*</span></label>
          <textarea id="selfDescription" name="selfDescription" rows="5" maxlength="5000" placeholder="A short description from the event website. Markdown is supported." required>${escapeHtml(formData.selfDescription || '')}</textarea>
        </div>
        <div class="form-group">
          <label for="presentationForm">Event format <span aria-hidden="true">*</span></label>
          <select id="presentationForm" name="presentationForm" required>
            <option value="">Select</option>
            <option value="online">online</option>
            <option value="physical">physical</option>
            <option value="hybrid">hybrid</option>
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Optional Information</legend>
        <div class="form-group">
          <label for="city">City (Location):</label>
          <input type="text" id="city" name="city" placeholder="e.g. Bangalore">
        </div>
        <div class="form-group">
          <label for="state">State:</label>
          <select id="state" name="state">
            <option value="">Select State</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
            <option value="Assam">Assam</option>
            <option value="Bihar">Bihar</option>
            <option value="Chhattisgarh">Chhattisgarh</option>
            <option value="Goa">Goa</option>
            <option value="Gujarat">Gujarat</option>
            <option value="Haryana">Haryana</option>
            <option value="Himachal Pradesh">Himachal Pradesh</option>
            <option value="Jharkhand">Jharkhand</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Kerala">Kerala</option>
            <option value="Madhya Pradesh">Madhya Pradesh</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Manipur">Manipur</option>
            <option value="Meghalaya">Meghalaya</option>
            <option value="Mizoram">Mizoram</option>
            <option value="Nagaland">Nagaland</option>
            <option value="Odisha">Odisha</option>
            <option value="Punjab">Punjab</option>
            <option value="Rajasthan">Rajasthan</option>
            <option value="Sikkim">Sikkim</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Telangana">Telangana</option>
            <option value="Tripura">Tripura</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
            <option value="Uttarakhand">Uttarakhand</option>
            <option value="West Bengal">West Bengal</option>
            <option value="Delhi">Delhi</option>
            <option value="Jammu and Kashmir">Jammu and Kashmir</option>
          </select>
        </div>
        <div class="form-group">
          <label for="venue">Venue:</label>
          <input type="text" id="venue" name="venue" placeholder="e.g. Bagmane Tech Park">
        </div>
        <div class="form-group">
          <label for="osmLink">OSM-Link:</label>
          <input type="url" id="osmLink" name="osmLink" placeholder="OSM map link example">
        </div>
        <div class="form-group">
          <label for="latitude">Latitude (lan):</label>
          <input type="number" id="latitude" name="latitude" min="-90" max="90" step="any" placeholder="12.9716" value="${escapeHtml(formData.latitude || '')}">
        </div>
        <div class="form-group">
          <label for="longitude">Longitude (lon):</label>
          <input type="number" id="longitude" name="longitude" min="-180" max="180" step="any" placeholder="77.5946" value="${escapeHtml(formData.longitude || '')}">
        </div>
      </fieldset>

      <fieldset>
        <legend>Other Important Data</legend>
        <div class="form-group">
          <label for="cfpLink">Call for Participation Link:</label>
          <input type="url" id="cfpLink" name="cfpLink">
        </div>
        <div class="form-group">
          <label for="cfpDeadline">CfP Deadline:</label>
          <input type="date" id="cfpDeadline" name="cfpDeadline">
        </div>
        <div class="form-group">
          <label for="participationFee">Participation fee (INR)</label>
          <input type="number" id="participationFee" name="participationFee" placeholder="fee in Rs">
        </div>
        <div class="form-group">
          <label for="registrationLink">Registration Link:</label>
          <input type="url" id="registrationLink" name="registrationLink">
        </div>
        <div class="form-group">
          <label for="codeOfConduct">Code of Conduct Link:</label>
          <input type="url" id="codeOfConduct" name="codeOfConduct">
        </div>
        <div class="form-group">
          <label for="mainOrganiser">Main Organiser:</label>
          <input type="text" id="mainOrganiser" name="mainOrganiser" placeholder="e.g. FOSSIE Team">
        </div>
      </fieldset>

      <fieldset>
        <legend>Additional Optional Information</legend>
        <div class="form-group">
          <label for="officialHashtags">Official Hashtag(s):</label>
          <input type="text" id="officialHashtags" name="officialHashtags" maxlength="80">
        </div>
        <div class="form-group">
          <label for="pictureBanner">Event banner (optional)</label>
          <input type="file" id="pictureBanner" name="pictureBanner" accept="image/png,image/jpeg,image/webp">
        </div>
        <div class="form-group">
          <label>Type:</label>
          <div class="checkbox-group">
            <label><input type="checkbox" name="eventTypes" value="Community Event"> Community Event</label>
            <label><input type="checkbox" name="eventTypes" value="Hackathon"> Hackathon</label>
            <label><input type="checkbox" name="eventTypes" value="Technical Fest"> Technical Fest</label>
            <label><input type="checkbox" name="eventTypes" value="Business Event"> Business Event</label>
            <label><input type="checkbox" name="eventTypes" value="Workshops & Training Sessions"> Workshops & Training Sessions</label>
            <label><input type="checkbox" name="eventTypes" value="Expos & Showcases"> Expos & Showcases</label>
            <label><input type="checkbox" name="eventTypes" value="Conferences"> Conferences</label>
            <label><input type="checkbox" name="eventTypes" value="Monthly Meetups"> Monthly Meetups</label>
          </div>
        </div>
        <div class="form-group">
          <label for="tags">Topics and tags</label>
          <textarea id="tags" name="tags" rows="3" placeholder="e.g. Linux, privacy, Python, open hardware"></textarea>
        </div>
        <div class="form-group">
          <label for="mainSponsor">Main sponsor</label>
          <textarea id="mainSponsor" name="mainSponsor" rows="2" placeholder="Optional"></textarea>
        </div>
        <div class="social-accounts">
          <h3>Social Accounts</h3>
          <div class="form-group">
            <label for="mastodon">Mastodon Link:</label>
            <input type="url" id="mastodon" name="mastodon" placeholder="Mastodon URL example">
          </div>
          <div class="form-group">
            <label for="matrix">Matrix:</label>
            <input type="text" id="matrix" name="matrix">
          </div>
          <div class="form-group">
            <label for="mailinglist">Mailinglist Link:</label>
            <input type="url" id="mailinglist" name="mailinglist">
          </div>
          <div class="form-group">
            <label for="instagram">Instagram:</label>
            <input type="url" id="instagram" name="instagram">
          </div>
          <div class="form-group">
            <label for="github">Github:</label>
            <input type="url" id="github" name="github">
          </div>
          <div class="form-group">
            <label for="discourse">Discourse:</label>
            <input type="url" id="discourse" name="discourse">
          </div>
          <div class="form-group">
            <label for="contactEmail">Contact Email:</label>
            <input type="email" id="contactEmail" name="contactEmail">
          </div>
        </div>
      </fieldset>

      <div class="form-group"><label for="trustedToken">Trusted contributor token (optional)</label><input type="password" id="trustedToken" name="trustedToken" autocomplete="off" placeholder="Only if issued by FOSSTrak maintainers"><p style="font-size:.82rem;color:#66736a">Trusted tokens can publish within their assigned permissions. Never share them.</p></div>
      <button type="submit" class="submit-btn">Submit Event</button>
    </form>
  </div>
  ` : `
  <div class="filters">
    <div class="filter-group">
      <div class="filter-item">
        <label>State</label>
        <select id="stateFilter">
          <option value="">All States</option>
          ${events.length ? [...new Set(events.map(event => event.state).filter(Boolean))].sort().map(state => `<option value="${escapeHtml(state)}">${escapeHtml(state)}</option>`).join('') : ''}
        </select>
      </div>
      <div class="filter-item">
        <label>Type</label>
        <select id="typeFilter">
          <option value="">All Types</option>
          ${events.length ? [...new Set(events.map(eventType))].sort().map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('') : ''}
        </select>
      </div>
      <div class="filter-item">
        <label>Date Range</label>
        <div class="date-range">
          <input type="date" id="startDate" placeholder="Start">
          <span>to</span>
          <input type="date" id="endDate" placeholder="End">
        </div>
      </div>
    </div>
  </div>
  <div class="events-container" id="eventsList">
    ${events.length > 0 ? events.map(event => `
      <article class="event-card" data-date="${escapeHtml(eventDate(event))}" data-state="${escapeHtml(event.state || '')}" data-type="${escapeHtml(eventType(event))}">
        <div class="event-date">${eventDate(event) && validDate(eventDate(event)) ? new Date(eventDate(event) + 'T00:00:00+05:30').toLocaleDateString('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }) : 'Date to be announced'}</div>
        <h2>${escapeHtml(eventName(event))}</h2>
        <div class="event-location">${escapeHtml(eventLocation(event))}</div>
        <p>${escapeHtml(eventDescription(event))}</p>
        <div class="event-tags"><span class="tag">${escapeHtml(eventType(event))}</span>${eventTags(event).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        ${safeUrl(event.homepage) ? `<p><a href="${escapeHtml(safeUrl(event.homepage))}" target="_blank" rel="noopener noreferrer">Event website ↗</a></p>` : ''}
        ${safeUrl(event.registrationLink) ? `<p><a href="${escapeHtml(safeUrl(event.registrationLink))}" target="_blank" rel="noopener noreferrer">Registration ↗</a></p>` : ''}
        ${eventDate(event) && validDate(eventDate(event)) ? `<p><a href="/events/${encodeURIComponent(event.id || eventName(event))}.ics">Add to calendar (.ics)</a></p>` : ''}
        ${event.id ? `<p class="event-contribute"><a href="/contribute/edit/${encodeURIComponent(event.id)}">Suggest an edit</a> · <a href="/events/${encodeURIComponent(event.id)}/new-edition">Add a new edition</a> · <a href="/report/${encodeURIComponent(event.id)}">Report an issue</a></p>` : ''}
      </article>
    `).join('') : `
      <div class="empty-state">
        <div class="empty-illustration">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="32" fill="#f3f4f6"/>
            <path d="M32 40a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 3 0v6A1.5 1.5 0 0 1 32 40zm0 4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#9ca3af"/>
            <path d="M44.5 49h-25a2 2 0 0 1-2-2V23a2 2 0 0 1 2-2h25a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2zm-25-26v24h25V23h-25z" fill="#9ca3af"/>
            <path d="M41.5 34.5h-5a1.5 1.5 0 0 1 0-3h5a1.5 1.5 0 0 1 0 3zm0 4h-5a1.5 1.5 0 0 1 0-3h5a1.5 1.5 0 0 1 0 3zm-14-10h-5a1.5 1.5 0 0 1 0-3h5a1.5 1.5 0 0 1 0 3zm0 4h-5a1.5 1.5 0 0 1 0-3h5a1.5 1.5 0 0 1 0 3z" fill="#9ca3af"/>
          </svg>
        </div>
        <h2>No Events Found</h2>
        <p>Be the first to add an open source event!</p>
        <div class="cta">
          <a href="/submit" class="cta-btn">Submit Your Event</a>
        </div>
      </div>
    `}
  </div>
  `}
  <footer class="footer">
    <p>Made with love for FOSS in India 🇮🇳</p>
    <p>FOSSTrak India · Open source, community-driven, India-focused</p>
    <p>Powered by Open Source &amp; Cloudflare Workers</p>
  </footer>
  <script>
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('/')) return;
        e.preventDefault();
        window.history.pushState({}, '', href);
        filterEvents();
      });
    });
    function filterEvents() {
      const hash = window.location.hash.substring(1);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      document.querySelectorAll('.event-card').forEach(card => {
        if (!card.dataset.date) { card.style.display = hash === 'past' ? 'none' : 'block'; return; }
        const eventDate = card.dataset.date;
        const isPast = eventDate < today;
        const stateFilter = document.getElementById('stateFilter');
        const typeFilter = document.getElementById('typeFilter');
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');
        const stateMatch = !stateFilter || !stateFilter.value || card.dataset.state === stateFilter.value;
        const typeMatch = !typeFilter || !typeFilter.value || card.dataset.type === typeFilter.value;
        const startDate = startInput ? startInput.value : '';
        const endDate = endInput ? endInput.value : '';
        const dateInRange = (!startDate || eventDate >= startDate) &&
                            (!endDate || eventDate <= endDate);
        const shouldShow = dateInRange && stateMatch && typeMatch && (
          (hash === 'past' && isPast) ||
          (hash === 'upcoming' && !isPast) ||
          (!hash && !isPast)
        );
        card.style.display = shouldShow ? 'block' : 'none';
      });
    }
    document.getElementById('stateFilter')?.addEventListener('change', filterEvents);
    document.getElementById('typeFilter')?.addEventListener('change', filterEvents);
    document.getElementById('startDate')?.addEventListener('change', filterEvents);
    document.getElementById('endDate')?.addEventListener('change', filterEvents);
    window.addEventListener('hashchange', filterEvents);
    filterEvents();
  </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'GET' && path === '/healthz') return Response.json({ status: 'ok', service: 'fosstrak-india' }, { headers: { 'Cache-Control': 'no-store' } });
    let events;
    try { events = await readEvents(env); } catch {
      return new Response('Event data is temporarily unavailable. Please try again later.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    const contributionResponse = await handleContributionRoutes(request, env, url, events);
    if (contributionResponse) return contributionResponse;

    if (request.method === 'GET' && path.startsWith('/events/') && path.endsWith('.ics')) {
      const requestedId = decodeURIComponent(path.slice('/events/'.length, -'.ics'.length));
      const event = events.find(row => String(row.id || eventName(row)) === requestedId);
      if (!event || event.proposalType || ['pending', 'rejected', 'changes-requested'].includes(event.status)) {
        return new Response('Event not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      const startDate = eventDate(event);
      if (!validDate(startDate)) return new Response('Event has no valid start date', { status: 422 });
      const endDate = validDate(event.endDate) ? event.endDate : startDate;
      const icalDate = (date) => date.replaceAll('-', '');
      const escapeIcal = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const description = eventDescription(event);
      const calendar = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FOSSTrak India//Events//EN',
        'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        'UID:' + escapeIcal(event.id || requestedId) + '@fosstrak-india',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'),
        'DTSTART;VALUE=DATE:' + icalDate(startDate),
        'DTEND;VALUE=DATE:' + icalDate(endDate > startDate ? new Date(Date.parse(endDate + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10) : new Date(Date.parse(startDate + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)),
        'SUMMARY:' + escapeIcal(eventName(event)),
        'DESCRIPTION:' + escapeIcal(description),
        'LOCATION:' + escapeIcal(eventLocation(event)),
        safeUrl(event.homepage) ? 'URL:' + safeUrl(event.homepage) : '',
        'END:VEVENT', 'END:VCALENDAR', ''
      ].filter((line) => line !== '').join('\r\n');
      return new Response(calendar, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="fosstrak-event.ics"',
          'Cache-Control': 'public, max-age=300',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (request.method === 'POST' && path === '/submit') {
      if (!env.EVENTS) return new Response('Event submission is not configured yet.', { status: 503 });
      let form;
      try { form = await request.formData(); } catch { return new Response(HTML_TEMPLATE([], true, 'Please submit a valid event form.'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
      const field = (key, max = 1000) => String(form.get(key) || '').trim().slice(0, max);
      const event = {
        id: crypto.randomUUID(), commonName: field('commonName',40), fullName: field('fullName',80), homepage: safeUrl(field('homepage',2048)),
        startDate: field('startDate',10), endDate: field('endDate',10), selfDescription: field('selfDescription',5000), presentationForm: field('presentationForm',20),
        city: field('city',100), state: field('state',100), venue: field('venue',200), osmLink: safeUrl(field('osmLink',2048)),
        latitude: field('latitude',30), longitude: field('longitude',30), cfpLink: safeUrl(field('cfpLink',2048)), cfpDeadline: field('cfpDeadline',10),
        participationFee: field('participationFee',20), registrationLink: safeUrl(field('registrationLink',2048)), codeOfConduct: safeUrl(field('codeOfConduct',2048)),
        mainOrganiser: field('mainOrganiser',160), officialHashtags: field('officialHashtags',160), eventTypes: form.getAll('eventTypes').slice(0,12).map(v=>String(v).slice(0,80)),
        tags: field('tags',1000), mainSponsor: field('mainSponsor',500), mastodon: safeUrl(field('mastodon',2048)), matrix: field('matrix',200),
        mailinglist: safeUrl(field('mailinglist',2048)), instagram: safeUrl(field('instagram',2048)), github: safeUrl(field('github',2048)),
        discourse: field('discourse',200), contactEmail: field('contactEmail',254), status: 'pending', submittedAt: new Date().toISOString()
      };
      const errors=[];
      if(!event.commonName) errors.push('Enter an event name.');
      if(!event.fullName) errors.push('Enter the full event name.');
      if(!event.homepage) errors.push('Enter a valid http(s) event website.');
      if(!validDate(event.startDate)||!validDate(event.endDate)) errors.push('Enter valid event dates.');
      if(validDate(event.startDate)&&validDate(event.endDate)&&event.endDate<event.startDate) errors.push('End date must be on or after the start date.');
      if(!event.selfDescription) errors.push('Add a short event description.');
      if(!['online','physical','hybrid'].includes(event.presentationForm)) errors.push('Choose online, physical, or hybrid.');
      const lat=event.latitude===''?null:Number(event.latitude), lng=event.longitude===''?null:Number(event.longitude);
      if((lat!==null&&(!Number.isFinite(lat)||lat< -90||lat>90))||(lng!==null&&(!Number.isFinite(lng)||lng< -180||lng>180))) errors.push('Latitude must be between -90 and 90 and longitude between -180 and 180.');
      if(errors.length) return new Response(HTML_TEMPLATE([],true,errors.join(' '),event),{status:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      const scopes = await trustedScopes(field('trustedToken',500), env);
      if (scopes.includes('publish_events')) { event.status = 'published'; event.publishedAt = new Date().toISOString(); }
      const duplicate=events.some(row=>!row.proposalType&&row.status!=='rejected'&&String(row.commonName||row.name||'').trim().toLocaleLowerCase('en-IN')===event.commonName.toLocaleLowerCase('en-IN')&&String(row.startDate||row.date||'')===event.startDate);
      if(duplicate) return new Response(HTML_TEMPLATE([],true,'An event with this name and start date already exists.',event),{status:409,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      events.push(event);
      try { await env.EVENTS.put('events',JSON.stringify(events)); await writeAudit(env,{action:scopes.includes('publish_events')?'trusted-event-published':'proposal-submitted',targetId:event.id,summary:'new-event',actor:scopes.includes('publish_events')?'trusted-contributor':'community'}); } catch { return new Response('We could not save your submission. Please try again later.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}); }
      return new Response(HTML_TEMPLATE([],true,null,{},scopes.includes('publish_events')?'Your trusted-contributor submission is published.':'Thanks! Your event has been submitted for community review.'),{status:scopes.includes('publish_events')?201:202,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    }
    if(request.method==='GET'&&path==='/submit') return new Response(HTML_TEMPLATE([],true),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    if(request.method==='GET'&&path==='/api/events') return Response.json(events.filter(row=>!row.proposalType&&!['pending','rejected','changes-requested'].includes(row.status)),{headers:{'Cache-Control':'public, max-age=60'}});
    if(request.method!=='GET') return new Response('Method not allowed',{status:405,headers:{Allow:'GET, POST','Content-Type':'text/plain; charset=utf-8'}});
    const published=events.filter(row=>!row.proposalType&&!['pending','rejected','changes-requested'].includes(row.status)); published.sort((a,b)=>eventDate(a).localeCompare(eventDate(b)));
    return new Response(HTML_TEMPLATE(published),{headers:{
      'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',
      'Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    }});
  }
};