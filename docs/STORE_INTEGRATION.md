# Redeemed Warrior Store Integration

Connects the Redeemed Warrior AI Builder (this API, serving godsredeemedwarrior.com) to the Redeemed Warrior Store (godsredeemedwarrior.store).

## Configuration (server environment only)

| Variable | Purpose |
|----------|---------|
| `RW_STORE_BASE_URL` | Store base URL. Default: `https://godsredeemedwarrior.store/.sfs-be` (the Store serves its API behind the `/.sfs-be` backend path; a bare `https://godsredeemedwarrior.store` base URL will hit the storefront instead) |
| `RW_STORE_API_KEY` | Shared secret. Sent to the Store as the `X-RW-Key` header. **Never exposed to the browser.** |
| `STORE_TIMEOUT_MS` | Store request timeout. Default: 15000 |
| `ACCESS_RECHECK_INTERVAL_MS` | Daily access recheck interval. Default: 86400000 (24h) |

## Security model

- Every call to the Store happens **server-to-server** with the `X-RW-Key` header.
- The Store key lives only in server environment variables. It never appears in HTML, JavaScript served to browsers, or API responses.
- Purchase ownership is **never** accepted from the frontend. Access is granted only after the Store confirms a code via `/api/rw/redeem/check` and `/api/rw/redeem/claim`.
- Redeeming requires a logged-in member account, so every redemption is tied to exactly one Builder account.

## Store API contract (per the Store's official Builder integration notes)

Base address: the Store's backend, `https://godsredeemedwarrior.store/.sfs-be` (the
storefront pages return 405 for these paths). Header on every call:
`X-RW-Key: <key from the Store's Owner dashboard > Connections>`.

### POST /api/rw/redeem/check

Request:

```json
{ "code": "RW-XXXX-XXXX", "account": "<builder account id or email>" }
```

Response (HTTP 200):

```json
{
  "valid": true,
  "message": "Code is valid.",
  "product": { "id": "app-123", "title": "My App", "appType": "web_app", "pricing": "one_time" },
  "purchaseStatus": "active",
  "accessUntil": null,
  "customer": "ab***@mail.com"
}
```

`purchaseStatus` values understood by the Builder: `active` (also `valid`, `paid`,
`complete`), `refunded`, `cancelled`/`canceled`, `expired`, `already_claimed` (also
`claimed`, `redeemed`), `not_found` (also `unknown`, `invalid`). If `purchaseStatus`
is missing, `valid: true` maps to `active` and `valid: false` to `not_found`.
`accessUntil` (when present) bounds subscription access; the Builder treats a past
date as expired.

### POST /api/rw/redeem/claim

Request (same body plus confirm):

```json
{ "code": "RW-XXXX-XXXX", "account": "<builder account id or email>", "confirm": true }
```

Response (HTTP 200):

```json
{
  "success": true,
  "purchaseStatus": "active",
  "product": { "id": "app-123", "title": "My App" },
  "accessUntil": null,
  "customer": "ab***@mail.com",
  "redemptionId": "store-redemption-id"
}
```

Non-200 responses are surfaced to the member as friendly messages; 401/403 from the
Store indicates an `X-RW-Key` mismatch.

## Builder endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/auth/register` | none | Create member account `{ email, password }` |
| `POST /api/auth/login` | none | Log in, returns member token |
| `POST /api/store/redeem` | member | Redeem a code. Without `confirm: true` it returns a preview (app, masked customer, `readyForConfirm`) and links nothing; with `confirm: true` it claims and unlocks |
| `GET /api/store/my-apps` | member | Apps unlocked by the member's purchases |
| `GET /api/store/my-apps/:appId/access` | member | Access check; re-verifies with the Store if the last check is stale |
| `GET /api/store/redemptions` | member | Redemption status list (codes masked) |
| `GET /dashboard` | none (page) | Member dashboard UI |

## Access lifecycle

1. **Grant** — the member previews the code (app name, masked customer), confirms, and the claim sets the redemption to `active`; the app appears in My Apps.
2. **Open-time recheck** — when a member opens an app, if the last Store check is older than 24h, the Builder re-checks the code before granting access.
3. **Daily recheck** — a background job re-checks all active redemptions once per day.
4. **Revocation** — if the Store reports `valid: false`, `refunded`, `cancelled`, `expired`, or `not_found`, or `accessUntil` has passed, access is revoked immediately and the status shows in the dashboard. Subscriptions renew by the Store moving `accessUntil` forward.

## Data persistence note

Member accounts, tokens, and redemptions are currently held **in memory**. They
survive until the server restarts. Before real money flows through the Store, these
should move to a persistent database (the services are written so the storage can be
swapped without changing the routes).

## Automated end-to-end test

`npm run test:e2e` runs the complete 7-step flow (registration, code check, claim with `confirm:true`, My Apps, access grant, cross-account rejection, refund revocation) against a built-in mock Store that enforces the `X-RW-Key` header. It can be re-run against the real Store once its endpoints are live by setting `RW_STORE_BASE_URL` to the Store URL before running it.

## Live Store verification (2026-11-11)

- `POST https://godsredeemedwarrior.store/.sfs-be/api/rw/redeem/check` and `/claim` are deployed and reachable.
- Without a valid `X-RW-Key` both return `401 {"message":"This request is not allowed.","valid":false}` — mapped by `storeClient.js` to the friendly "key mismatch" error.
- The storefront pages return 405 for these paths; only the `/.sfs-be` backend path serves the API.

## Testing checklist (run after the Store deploys its endpoints)

1. **Store purchase** — buy an app product in the Store; confirm a redemption code is issued.
2. **Code verification** — `POST /api/rw/redeem/check` with the code returns `valid: true`.
3. **Code claiming** — redeem in the dashboard; the claim sends `confirm: true`.
4. **My Apps** — the purchased app appears with "Access granted".
5. **Wrong account** — redeeming the same code from a second account is rejected.
6. **Access check** — `GET /api/store/my-apps/:appId/access` returns `hasAccess: true`.
7. **Revocation** — refund/cancel the purchase in the Store, wait for the daily recheck (or trigger a stale recheck), then confirm `hasAccess: false` with a friendly reason.
