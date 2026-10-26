<p align="center">
  <img align="center" width="20%" src="public/ft_logo.png" alt="FOSSTrak India logo"/>
  <h2 align="center">FOSSTrak India — Open Data for FOSS Events</h2>
  <p align="center">Discover and contribute Free and Open Source Software events happening across India.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green?logo=dark-green" alt="MIT License"/>
  <img src="https://img.shields.io/badge/PRs-Welcome-success" alt="PRs Welcome"/>
</p>

FOSSTrak India is an open-source, community-driven directory for discovering FOSS conferences, meetups, hackathons, workshops, and other events throughout India.

## Stack

- Cloudflare Workers — application and HTTP API
- Cloudflare Workers KV — event data
- Wrangler — local development and deployment
- Vitest with Cloudflare's Workers test pool — automated tests
- GitHub Actions — pull-request checks and production deployment

## Prerequisites

- Node.js 24.x
- npm
- A Cloudflare account with permission to manage Workers and Workers KV

## Local development

```sh
git clone https://github.com/zhravan/fosstrak-india.git
cd fosstrak-india
npm install
```

The checked-in `wrangler.jsonc` points to the FOSSTrak deployment's KV namespace. For a separate Cloudflare account, copy `wrangler-example.jsonc` to `wrangler.jsonc` and replace the placeholder namespace ID with a namespace you own.

Start the Worker locally:

```sh
npm start
```

Run tests:

```sh
npm test -- --run
```

## Production deployment

Production deploys are handled by GitHub Actions after a successful test run on `main`. Pull requests run the tests and validate the Worker bundle; they do not deploy.

Configure these **GitHub repository Actions secrets** before merging a deployment change:

- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account identifier
- `CLOUDFLARE_API_TOKEN` — a scoped API token that can edit Workers scripts and access the required account resources

The production Worker configuration binds `EVENTS` to the `fosstrak-india-events` KV namespace. The namespace ID is an identifier, not an API credential; never commit API tokens or other secrets.

For a manual deployment, authenticate Wrangler and run:

```sh
npx wrangler login
npm run deploy
```

See the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/) and [Workers KV documentation](https://developers.cloudflare.com/kv/).

## Application endpoints

- `/` — published FOSS events
- `/submit` — submit an event for review
- `/api/events` — published events in JSON
- `/healthz` — health check
- `/events/<event-id>.ics` — calendar download for a published event with a valid date
- `/contribute/edit/<event-id>` — suggest an edit to a published event
- `/events/<event-id>/new-edition` — propose a new edition based on a previous event
- `/report/<event-id>` — report incorrect or outdated event information
- `/contributions/<reference-id>` — check a contribution's review status; append `/revise` when changes are requested
- `/admin` — authenticated moderation queue, review history, and rollback controls
- `/api/events.csv` — CSV export of published events
- `/api/schema` — event schema and contribution workflow metadata

Set the `FOSSTRAK_ADMIN_TOKEN` Worker secret before using moderation. Optional trusted contributor permissions are configured using the `FOSSTRAK_TRUSTED_CONTRIBUTORS` secret; see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and scopes. Public submissions remain pending until approved unless a trusted token explicitly grants the relevant publishing scope.

Submissions are pending review by design. Do not expose a moderation endpoint without proper authentication and authorization.

## Contributing

Contributions are welcome. Please open an issue to discuss larger changes, and submit a pull request with focused changes and tests. Never commit Cloudflare API tokens or other secrets.

## License

This project is licensed under the MIT License. See [LICENSE.md](./LICENSE.md).
