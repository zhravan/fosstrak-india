const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = (value) => { try { const url = new URL(String(value || '')); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const eventName = (e) => e.commonName || e.name || e.fullName || 'Untitled FOSS event';
const eventDate = (e) => e.startDate || e.date || '';
const eventLocation = (e) => [e.venue, e.city, e.state, e.location].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || (e.presentationForm === 'online' ? 'Online' : 'Location to be announced');
const eventType = (e) => Array.isArray(e.eventTypes) && e.eventTypes.length ? e.eventTypes.join(', ') : e.type || e.presentationForm || 'FOSS event';
const eventTags = (e) => Array.isArray(e.tags) ? e.tags : typeof e.tags === 'string' ? e.tags.split(/[ ,\n]/).map(v=>v.trim()).filter(Boolean) : [];
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
      --primary: #2c3e50;
      --secondary: #3498db;
      --light: #ecf0f1;
      --dark: #2c3e50;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      background: var(--light);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: var(--primary);
      color: white;
      padding: 1rem;
      text-align: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .nav {
      display: flex;
      gap: 1rem;
      justify-content: center;
      padding: 1rem;
      background: var(--dark);
      flex-wrap: wrap;
    }
    .nav a {
      color: white;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      transition: background 0.3s;
    }
    .nav a:hover {
      background: var(--secondary);
    }
    .events-container {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
      flex-grow: 1;
    }
    .event-card {
      background: white;
      border-radius: 8px;
      margin: 1rem 0;
      padding: 1.5rem;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .event-date {
      color: var(--secondary);
      font-weight: bold;
    }
    .event-location {
      color: #7f8c8d;
      font-size: 0.9rem;
      margin: 0.5rem 0;
    }
    .event-tags {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .tag {
      background: var(--light);
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
    }
    .footer {
      background: var(--dark);
      color: white;
      text-align: center;
      padding: 1rem;
      position: sticky;
      top: 100vh;
      margin-top: auto;
    }
    /* Event form styles */
    .event-form {
      max-width: 800px;
      margin: 2rem auto;
      padding: 1.5rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.3rem;
    }
    input, select, textarea {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #bdc3c7;
      border-radius: 4px;
    }
    button {
      background: var(--secondary);
      color: white;
      padding: 0.8rem 1.5rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.3s;
    }
    button:hover {
      opacity: 0.9;
    }
    fieldset {
      border: 1px solid #bdc3c7;
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    legend {
      font-weight: bold;
      padding: 0 0.5rem;
    }
    .checkbox-group {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .checkbox-group label {
      display: flex;
      align-items: center;
      font-weight: normal;
    }
    @media (max-width: 768px) {
      .events-container {
        grid-template-columns: 1fr;
      }
      .event-form {
        padding: 1rem;
        margin: 1rem;
      }
    }
    /* Filters styles (unchanged) */
    .filters {
      max-width: 1200px;
      margin: 1rem auto 0;
      padding: 1rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .filter-group {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .filter-item {
      flex: 1;
      min-width: 200px;
    }
    .filter-item label {
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
      display: block;
      color: #7f8c8d;
    }
    .date-range {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .date-range span {
      color: #7f8c8d;
    }
    select, input[type="date"] {
      padding: 0.5rem;
      font-size: 0.9rem;
      border: 1px solid #bdc3c7;
      border-radius: 4px;
      width: 100%;
    }
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #7f8c8d;
    }
    .empty-illustration {
      max-width: 300px;
      margin: 0 auto 2rem;
      opacity: 0.8;
    }
    .empty-state h2 {
      color: var(--primary);
      margin-bottom: 1rem;
    }
    .empty-state .cta {
      margin-top: 2.5rem;
      display: flex;
      justify-content: center;
    }
    .empty-state .cta-btn {
      background: var(--secondary);
      color: white;
      padding: 1rem 2rem;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11);
    }
    .empty-state .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 7px 14px rgba(50, 50, 93, 0.1);
      background: #2a80b9;
    }
    .empty-state svg {
      width: 100%;
      height: auto;
    }
    .empty-state .cta-btn::after {
      content: '➔';
      transition: transform 0.3s ease;
    }
    .empty-state .cta-btn:hover::after {
      transform: translateX(3px);
    }
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
    <h2>Submit New Event</h2>\n    ${notice ? `<div class="success-message" role="status">${escapeHtml(notice)}</div>` : ''}
    ${error ? `<div class="error-message" role="alert">${escapeHtml(error)}</div>` : ''}
    <form id="submitForm" method="POST" enctype="multipart/form-data">
      <fieldset>
        <legend>Mandatory Data</legend>
        <div class="form-group">
          <label for="commonName">Common Name:</label>
          <input type="text" id="commonName" name="commonName" maxlength="40" placeholder="e.g. FOSS United Conference" value="${escapeHtml(formData.commonName || '')}" required>
        </div>
        <div class="form-group">
          <label for="fullName">Full Name:</label>
          <input type="text" id="fullName" name="fullName" maxlength="80" placeholder="e.g. FOSS United Conference" value="${escapeHtml(formData.fullName || '')}" required>
        </div>
        <div class="form-group">
          <label for="homepage">Homepage (Event Website):</label>
          <input type="url" id="homepage" name="homepage" placeholder="e.g. https://example.org" value="${escapeHtml(formData.homepage || '')}" required>
        </div>
        <div class="form-group">
          <label for="startDate">Start Date:</label>
          <input type="date" id="startDate" name="startDate" value="${escapeHtml(formData.startDate || '')}" required>
        </div>
        <div class="form-group">
          <label for="endDate">End Date:</label>
          <input type="date" id="endDate" name="endDate" value="${escapeHtml(formData.endDate || '')}" required>
        </div>
        <div class="form-group">
          <label for="selfDescription">Self-Description (Markdown supported):</label>
          <textarea id="selfDescription" name="selfDescription" rows="5" required>${escapeHtml(formData.selfDescription || '')}</textarea>
        </div>
        <div class="form-group">
          <label for="presentationForm">Presentation Form:</label>
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
          <label for="participationFee">Standard Participation Fee (Rs):</label>
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
          <label for="pictureBanner">Picture/Banner:</label>
          <input type="file" id="pictureBanner" name="pictureBanner" accept="image/*">
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
          <label for="tags">Tags:</label>
          <textarea id="tags" name="tags" rows="10"></textarea>
        </div>
        <div class="form-group">
          <label for="mainSponsor">Main Sponsor:</label>
          <textarea id="mainSponsor" name="mainSponsor" rows="10"></textarea>
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
          ${events.length ? [...new Set(events.flatMap(event => {
	const parts = event.location.split(', ');
	return parts.length > 1 ? [parts[1].trim()] : [];
}))].map(state => `<option value="${state}">${state}</option>`).join('') : ''}
        </select>
      </div>
      <div class="filter-item">
        <label>Type</label>
        <select id="typeFilter">
          <option value="">All Types</option>
          ${events.length ? [...new Set(events.map(event => event.type))].map(type => `<option value="${type}">${type}</option>`).join('') : ''}
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
    <p>FOSSTrak India - Part of the global FOSS movement</p>
    <p>Powered by Open Source & Cloudflare Workers</p>
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
      document.querySelectorAll('.event-card').forEach(card => {\n        if (!card.dataset.date) { card.style.display = hash === 'past' ? 'none' : 'block'; return; }
        const eventDate = card.dataset.date;
        const isPast = eventDate < today;
        const stateMatch = !document.getElementById('stateFilter').value ||
                           card.dataset.state === document.getElementById('stateFilter').value;
        const typeMatch = !document.getElementById('typeFilter').value ||
                          card.dataset.type === document.getElementById('typeFilter').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
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
      const duplicate=events.some(row=>String(row.commonName||row.name||'').trim().toLocaleLowerCase('en-IN')===event.commonName.toLocaleLowerCase('en-IN')&&String(row.startDate||row.date||'')===event.startDate);
      if(duplicate) return new Response(HTML_TEMPLATE([],true,'An event with this name and start date already exists.',event),{status:409,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      events.push(event);
      try { await env.EVENTS.put('events',JSON.stringify(events)); } catch { return new Response('We could not save your submission. Please try again later.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}); }
      return new Response(HTML_TEMPLATE([],true,null,{},'Thanks! Your event has been submitted for community review.'),{status:202,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    }
    if(request.method==='GET'&&path==='/submit') return new Response(HTML_TEMPLATE([],true),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    if(request.method==='GET'&&path==='/api/events') return Response.json(events.filter(row=>row.status!=='pending'&&row.status!=='rejected'),{headers:{'Cache-Control':'public, max-age=60'}});
    if(request.method!=='GET') return new Response('Method not allowed',{status:405,headers:{Allow:'GET, POST','Content-Type':'text/plain; charset=utf-8'}});
    const published=events.filter(row=>row.status!=='pending'&&row.status!=='rejected'); published.sort((a,b)=>eventDate(a).localeCompare(eventDate(b)));
    return new Response(HTML_TEMPLATE(published),{headers:{
      'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',
      'Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    }});
  }
};