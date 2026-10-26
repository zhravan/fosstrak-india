# Contributing event data through GitHub

Use this route if you prefer a pull request and reviewable diffs to the web form.

## File format

Create a uniquely named file such as `data/contributions/foss-example-2027.json`:

```json
{
  "commonName": "Example FOSS Conference",
  "fullName": "Example Free and Open Source Software Conference",
  "homepage": "https://example.org/",
  "startDate": "2027-03-20",
  "endDate": "2027-03-21",
  "selfDescription": "A community event about free and open source software.",
  "presentationForm": "physical",
  "city": "Pune",
  "state": "Maharashtra",
  "venue": "Example venue",
  "sourceUrl": "https://example.org/"
}
```

Required fields: `commonName`, `homepage`, `startDate`, `endDate`, `selfDescription`, `presentationForm`, and `sourceUrl`. `fullName`, location, venue and registration link are optional. Dates must use ISO `YYYY-MM-DD`; end date cannot precede start date. URLs must use HTTP or HTTPS. Keep one event per file and link to an official source.

## Review

CI validates JSON syntax, required fields, date ordering, supported event format, URL protocols, and duplicate name/date pairs in the contribution batch. A maintainer reviews the source and content before merging. **Merging does not automatically publish to the production calendar.** Production event records currently live in Cloudflare KV; maintainers must apply approved data changes through the moderation workflow until a dedicated import/sync pipeline is implemented.

Do not add secrets, private contact information, copyrighted descriptions without permission, or production KV dumps.
