# Contributing to FOSSTrak India

FOSSTrak is community-maintained. Anyone can suggest an event, correct information, report an issue, or prepare a new edition. Public changes are reviewed unless a maintainer-issued trusted contributor token grants a narrowly scoped fast path.

## Web workflow

1. **Add an event:** use [/submit](https://fosstrak-india.zhravann.workers.dev/submit). Include the official event page and accurate dates.
2. **Suggest an edit:** open an event and choose **Suggest an edit**. Only changed fields are proposed.
3. **Add a new edition:** open the previous edition and choose **Add a new edition**. Confirm dates and links; previous details are only a starting point.
4. **Report an issue:** use **Report an issue** on the event. Include evidence such as the organiser's cancellation notice.
5. **Track a contribution:** save the reference ID shown after submission and open `/contributions/<reference-id>`.

A submission is not published until approved. Moderators can approve, request changes, or reject a proposal. Pending proposals and edit/report records are not part of the public event API or calendar feed.

## Moderator setup

Set a strong `FOSSTRAK_ADMIN_TOKEN` Worker secret. The `/admin` route uses HTTP Basic authentication; use the token as the password and any username. Do not put the token in a URL, issue, chat, or source file.

```sh
npx wrangler secret put FOSSTRAK_ADMIN_TOKEN
```

The admin queue is available at `/admin`. Decisions and publication actions append audit records in the existing `EVENTS` KV namespace, retained for up to five years. KV is not transactional and concurrent submissions can race. Before high-volume use, migrate events, proposals and revisions to D1 with transactional writes.

## Trusted contributors

Trusted publishing is off by default. Configure `FOSSTRAK_TRUSTED_CONTRIBUTORS` as a JSON object mapping a token's SHA-256 hex digest to its scopes. Never store raw tokens in Worker variables or the repository.

```json
{
  "REPLACE_WITH_SHA256_HEX_DIGEST": ["publish_events", "publish_edits"]
}
```

Generate a digest locally with `printf %s 'YOUR_RANDOM_TOKEN' | sha256sum`, then configure the JSON as a Worker secret using `npx wrangler secret put FOSSTRAK_TRUSTED_CONTRIBUTORS`.

- `publish_events`: publish new event submissions and new editions.
- `publish_edits`: publish event edits.

Issue high-entropy tokens only to trusted contributors, grant minimum scopes, and rotate tokens when access changes. Tokens are bearer credentials. Rate limiting through KV is best-effort and does not replace Cloudflare WAF/rate-limiting rules.

## GitHub data contributions

For a contribution that is easier to review as code, add one JSON file under `data/contributions/` and open a pull request. See [the data contribution guide](docs/data-contributions.md). CI validates each JSON record. Do not include personal information or secrets.

A merged data PR is a reviewed source contribution; it does not automatically write to production KV.

## Data and licensing

Every web proposal must include an official event website or reliable announcement URL. Prefer sources maintained by organisers. Do not copy personal contact details unless intentionally published as the event's public contact. Verify rights before reusing third-party descriptions, images or logos.

## Abuse and corrections

Report spam or incorrect information through the event's **Report an issue** link. Maintainers should document decisions, request sources when facts are unclear, and use the audit history to explain corrections. Never publish private contributor emails or trusted tokens.
