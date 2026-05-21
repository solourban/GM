# AGENTS.md

## Product Direction

Nakchal Note is not just an auction case lookup page. It is a pre-bid review tool that helps users gather scattered auction, location, market, rights, and funding signals on one screen before deciding whether a property is worth deeper review.

The product goal is to help users answer:

- Is this property safe enough to keep reviewing?
- Where are the legal, tenant, location, or pricing risks?
- What evidence supports the next bid decision?

Current process progress: 87%.
Current milestone: stabilize rights-analysis execution before map and design integration.
Definition of done for this milestone: the flow from lookup to geocode to trade reference to rights analysis to summary copy does not break.

## Core User Flow

Keep the primary flow connected in this order:

1. Case lookup
2. Basic case information
3. Address geocoding
4. Location/map review
5. MOLIT trade reference
6. Statement and rights input
7. Rights analysis
8. Pre-bid judgment summary
9. Copy, save, and candidate management

The product should favor structured screen evidence over long prose reports. Use cards, tables, badges, checklists, and map panels so the user can judge quickly.

## Development Principles

- Change one problem at a time.
- Confirm green checks before moving to the next step.
- Treat GitHub Actions green as deployability, not feature completion.
- Always verify the deployed web page with real button clicks after Railway updates.
- When something fails, check the browser symptom, browser console, Railway deploy logs, server API response, then classify the issue as frontend, backend, external API, or deployment.
- Keep external API keys server-side. Browser code must call our server proxy, not Kakao, MOLIT, or Onbid directly with secret keys.

## Verification Order

Use this order for meaningful changes:

1. Code change
2. GitHub Actions green
3. Railway deployment reflected
4. Hard refresh the web page
5. Click the actual user flow
6. Confirm the visible result

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

Do not place real API keys in `public/` files. Public UI should call server proxy endpoints and use `/api/config` only for boolean readiness flags.

## Functional Standards

### Case Lookup

A successful case lookup must show case number, court, department, case name, address, usage, appraisal price, minimum sale price, sale date, failed-bid count, distribution demand deadline, and bid deposit rate.

Never render `[object Object]`, `undefined`, or empty cards as a successful result.

### Address Geocoding

A successful geocode must show address search status, X/Y coordinates, legal-dong code, admin-dong code, road address or lot address, and be ready to feed a map card.

### Map Card

The map is a core location-review card, not decoration. The next major UI step should place a map in the review flow with a marker, case address, legal-dong label, road address, nearby review action, Kakao map open action, and address retry/search controls.

### MOLIT Trade Reference

MOLIT results are reference data, not definitive market value. Use language such as same legal-dong reference, same complex/area/floor confirmation required, and regional reference price only.

Avoid language that says the price is confirmed, definitely undervalued, or certainly cheap.

### Rights Analysis

Rights analysis must be based on user-entered registry and sale-statement data, not only automatic collection.

Required input groups:

- First-priority right: filing date, type, holder, claim amount
- Tenants: name, move-in date, fixed date, deposit
- Special rights: lien, statutory superficies, graveyard-base right, provisional disposition, and other notes

A result must show risk level, inherited amount, tenant count, rights count, tenant opposability, extinguished/inherited status, and reasoning.

Always keep this caution visible in user-facing analysis:

`This result is a first-pass judgment based on the entered values. Before actual bidding, re-check the registry, sale statement, resident registration inspection, and field investigation.`

### Judgment Confidence

Confidence is not whether the property is good. It is whether enough data exists to trust the current judgment.

Track basic information, rights analysis, minimum price, coordinates, legal-dong code, trade references, price comparison, and final judgment.

### Final Judgment

Do not tell users to bid or not bid as a definitive instruction. Use review states such as active review, conditional review, hold, or risk review.

Base the state on rights risk, estimated inherited amount, location confirmation, trade sample count, price comparison, and confidence.

### Summary Copy

Support two future copy modes:

- Short sharing copy for KakaoTalk, memo, or Notion
- Detailed review copy covering rights, location, trades, and funding

## Current Priority

1. Fully eliminate rights-analysis execution crashes.
2. Add the map card.
3. Reorganize the result screen structure.
4. Make MOLIT trade references clearly labeled as reference prices.
5. Clean up final summary copy.
6. Unify design.
7. Later, improve saved candidates, bulk lookup, and sale-date recommendations.

## Reporting Format

For development updates, start or end with this compact status block:

```text
Process progress: 00%
Current milestone: ...
This change: ...
Next check: ...
```

## Current Risk Areas

- Rights analysis execution is the active stabilization milestone.
- Map display is the next major product milestone.
- Onbid list/detail parameter mapping must stay aligned between `public/app-v2-onbid-entry.js` and `src/server.js`.
- Court auction upstream response shapes can change; diagnostics must be helpful without exposing raw payloads publicly.
- External API calls should remain bounded by timeouts and rate limits.
- Recommendation and price scoring are heuristic review aids, not definitive bid decisions.
