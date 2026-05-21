# AGENTS.md

## Project Overview

Nakchal Note is a Railway-deployed Express app for pre-bid auction and public sale review.

Core flows:
- Court auction case lookup through `src/crawler.js`
- Rights analysis through `src/analyzer.js`
- Sale-date recommendations through `src/dateRecommendations.js`
- Onbid public sale lookup through `/api/onbid/*`
- Kakao geocode and MOLIT trade proxy endpoints through `src/server.js`

## Commands

- `npm start` starts the Express server.
- `npm run dev` starts the same server for local development.
- `npm test` runs syntax checks and project guard tests.
- `npm run test:onbid-proxy` checks the Onbid proxy contract.
- `npm run test:server-security` checks response headers, request IDs, and secret exposure guards.
- `npm run test:public-secrets` scans public assets for exposed API keys.

## Environment Variables

Server-only keys:
- `KAKAO_REST_API_KEY`
- `KAKAO_JS_KEY`
- `MOLIT_API_KEY`
- `ONBID_API_KEY`

Do not place real API keys in `public/` files. Public UI should call the server proxy endpoints and use `/api/config` only for boolean readiness flags.

## Stabilization Workflow

When changing external API integrations:
- Keep frontend query names and server accepted aliases aligned.
- Add or update a guard test that checks the contract.
- Prefer safe aliases over breaking old query names.
- Return `requestId` in API responses so UI reports can be traced in Railway logs.

When changing UI state:
- Preserve the last successful result while a new lookup is loading or fails.
- Escape user-visible data before inserting it into HTML strings.
- Keep failure messages actionable and avoid exposing upstream keys, stack traces, or raw internal debug payloads.

When changing auction analysis:
- Avoid presenting inferred legal outcomes as final decisions.
- Keep high-risk assumptions visible in the result text.
- Add focused tests for money parsing, date parsing, tenant priority, and inherited-right calculations when touching `src/analyzer.js`.

## Current Risk Areas

- Onbid list/detail parameter mapping must stay aligned between `public/app-v2-onbid-entry.js` and `src/server.js`.
- Court auction endpoints can change upstream response shapes; keep diagnostics helpful without exposing raw payloads publicly.
- External API calls should remain bounded by timeouts and rate limits.
- Recommendation scoring is heuristic and should be presented as a review aid, not a definitive bid decision.
