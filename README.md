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

Create a local Wrangler config from the example and replace the placeholder KV namespace ID with a namespace you own:

```sh
cp wrangler-example.jsonc wrangler.jsonc
```

Then start the local Worker:

```sh
npm start
```

Run tests with:

```sh
npm test
```

## Deploy to Cloudflare Workers

1. Create a Workers KV namespace for event data in your Cloudflare account.
2. Copy `wrangler-example.jsonc` to `wrangler.jsonc` and set the `EVENTS` binding's `id` to your namespace ID. Keep real account-specific configuration out of the example file.
3. Authenticate Wrangler with `npx wrangler login`, or configure a scoped Cloudflare API token in your CI environment.
4. Deploy with:

```sh
npm run deploy
```

For current setup details, see the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/) and [Workers KV documentation](https://developers.cloudflare.com/kv/).

## Application endpoints

- `/` — published FOSS events
- `/submit` — submit an event for review
- `/api/events` — published events in JSON
- `/healthz` — health check
- `/events/<event-id>.ics` — calendar download for a published event with a valid date

Submissions are pending review by design. Do not expose a moderation endpoint without proper authentication and authorization.

## Contributing

Contributions are welcome. Please open an issue to discuss larger changes, and submit a pull request with focused changes and tests. Never commit Cloudflare account IDs, namespace IDs tied to private infrastructure, API tokens, or other secrets.

## License

This project is licensed under the MIT License. See [LICENSE.md](./LICENSE.md).
