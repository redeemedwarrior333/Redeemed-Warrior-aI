# Redeemed Warrior-aI

A ai for my website

* [Redeemed Warrior AI — Ultimate Master System Prompt](MASTER_PROMPT.md)

## Redeemed Warrior AI API

The backend AI service for the Redeemed Warrior platform. It loads the master prompt and lets any website, app, or tool talk to the AI assistant and app builder.

### What it does right now

| Endpoint | What it's for |
|----------|---------------|
| `GET /health` | Check the API is running (no key needed) |
| `POST /api/chat` | Chat with Redeemed Warrior AI, with conversation memory. Supports streaming. |
| `GET /api/chat/:conversationId` | Retrieve a saved conversation |
| `POST /api/apps/plan` | Describe an app idea in plain English, get back a complete app blueprint |
| `POST /api/auth/register` / `POST /api/auth/login` | Free member accounts |
| `POST /api/store/redeem` | Redeem a Store purchase code (check → claim) to unlock an app |
| `GET /api/store/my-apps` | Apps the member has unlocked, with live access status |
| `GET /dashboard` | Member dashboard page: redeem codes, My Apps, redemption status |

### Quick start (beginner friendly)

1. Install [Node.js](https://nodejs.org) version 18 or newer.
2. Get a free AI provider API key. The easiest free option is [Google AI Studio](https://aistudio.google.com): sign in with a Google account, click "Get API key", and copy it — no credit card needed. Other free-friendly providers that work out of the box: [Groq](https://console.groq.com) (fast, no credit card; base URL `https://api.groq.com/openai/v1`), [OpenRouter](https://openrouter.ai), or Mistral. Just change `AI_BASE_URL` and `AI_MODEL` to match.
3. In this folder, create a file named `.env` (copy `.env.example`) and fill in your keys:

   ```
   AI_API_KEY=your-key-from-your-ai-provider
   API_KEY=a-long-random-string-you-invent
   ```
4. Install and run:

   ```
   npm install
   npm start
   ```

5. The API is now live at `http://localhost:3000`.

### Example: chat with the AI

```
POST http://localhost:3000/api/chat
Authorization: Bearer <your API_KEY>

{ "message": "I want to build an app for my bakery" }
```

### Example: turn an idea into an app blueprint

```
POST http://localhost:3000/api/apps/plan
Authorization: Bearer <your API_KEY>

{ "idea": "A booking app for my barbershop" }
```

The AI responds with a full blueprint: vision, core features, screens, data model, technology suggestions (free options first), and beginner-friendly build steps.

### Settings (.env)

| Setting | What it means |
|---------|---------------|
| `PORT` | Port the API runs on (default 3000) |
| `API_KEY` | Password that protects your API. Leave empty only for private testing. |
| `AI_BASE_URL` | Your AI provider's URL (default: Google AI Studio / Gemini) |
| `AI_API_KEY` | Your AI provider key |
| `AI_MODEL` | Which AI model to use (default: `gemini-3.5-flash-lite` — Google retired the old 2.5/`-latest` names, which caused 400 errors) |
| `AI_FALLBACK_BASE_URL` / `AI_FALLBACK_API_KEY` / `AI_FALLBACK_MODEL` | Optional backup AI provider. If the primary fails (quota, outage, retired model), requests automatically retry against the backup. Recommended free backup: [Groq](https://console.groq.com) — base URL `https://api.groq.com/openai/v1`, model `openai/gpt-oss-120b` (1,000 free requests/day) |
| `RATE_LIMIT_MAX` | Requests allowed per minute per visitor (default 60) |

### Security notes

- The AI's behavior is governed entirely by [MASTER_PROMPT.md](MASTER_PROMPT.md) — edit that file to change how the AI acts.
- Set `API_KEY` before exposing this to the internet.
- Never put your `.env` file on GitHub — it is already excluded by `.gitignore`.

### Store integration (godsredeemedwarrior.store)

Members can redeem Store purchase codes to unlock apps: server-to-server calls with the `X-RW-Key` header, access rechecked daily, revoked automatically on refunds/cancellations. See [docs/STORE_INTEGRATION.md](docs/STORE_INTEGRATION.md) for the full contract, configuration (`RW_STORE_API_KEY`, `RW_STORE_BASE_URL`), and the end-to-end testing checklist.

Member dashboard: open `/dashboard` on your deployment.

### Owner account (free full access)

Set `OWNER_EMAILS` (comma-separated) in the server environment. Any member who registers or signs in with one of those emails gets the `owner` role, verified server-side: full Premium access in hosted apps with no purchase code needed, never limited by subscriptions. Regular members are unaffected.

> Note: the Store's `/api/rw/redeem/*` endpoints must be live on the Store for redemption to work. The Builder side is complete and ready.

### Add it to your website

The API includes a ready-made chat page for your visitors, at `/chat` on your deployment:

```
https://your-render-address.onrender.com/chat
```

Three ways to put it on your website:

1. **Link to it** — add a "Chat with our AI" button anywhere on your site that opens the `/chat` address.
2. **Embed it** — paste this into any page (works in WordPress, Wix, Squarespace and most builders via an "embed" or "custom HTML" block):

   ```html
   <iframe src="https://your-render-address.onrender.com/chat"
           style="width:100%;height:640px;border:0;border-radius:12px"
           title="Redeemed Warrior AI"></iframe>
   ```

3. **Build your own** — call `POST /api/chat` from your site's code.

Visitor chat is controlled by these settings:

| Setting | What it means |
|---------|---------------|
| `PUBLIC_CHAT_ENABLED` | `true` lets visitors chat without a key (via the `/chat` page). Remove or set to `false` to lock the API to key-holders only. |
| `PUBLIC_RATE_LIMIT_MAX` | Messages per minute per visitor (default 10) |

Honest note: when public chat is on, anyone who finds the address can use it within the rate limit, and each message consumes your AI provider's free-tier quota. Keep `API_KEY` for anything sensitive.

### No computer? Deploy from your phone (free)

You do not need a computer. [Render](https://render.com) runs the API for you in the cloud, for free, straight from your GitHub repository:

1. Merge the pull request so your repo has the latest code.
2. On your phone, go to [dashboard.render.com](https://dashboard.render.com) and choose **"Sign up with GitHub"**.
3. Click **New +** → **Blueprint** → pick your `Redeemed-Warrior-aI` repository → **Connect**.
4. Render reads the included `render.yaml` and only asks you for one thing: your **AI_API_KEY** (the Google AI Studio key starting with `AIza...`). Paste it and click **Apply**.
5. Wait about 2 minutes. Your AI is now live at a web address like `https://redeemed-warrior-ai-api.onrender.com` — open `/health` in your browser to confirm it says `"status":"ok"`.

Notes:
- Render generates your `API_KEY` automatically — find it in your service's **Environment** tab. Keep it secret; anyone who has it can use your AI.
- The free plan puts the API to sleep after ~15 minutes of no visitors. The next request takes about a minute to wake it up. It also has monthly usage limits — fine for building and testing, upgrade only when you outgrow it.

### Keys not working? Run the setup doctor

```
npm run check
```

It checks Node.js, your `.env` file, both keys, and makes a real test call to your AI provider — then tells you exactly what to fix in plain English.

Most key problems are one of these:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401` or `403` from the provider | Key copied wrong, expired, or on the wrong line | Create a new key on your provider's API Keys page. Paste the whole key into `AI_API_KEY=` (not `API_KEY=`). No spaces, no quotes. |
| `404` model not found | Typo in `AI_MODEL` | Use `mistral-small-latest` for Mistral. |
| `429` | Free plan rate limit | Wait a minute and retry, or check your plan's limits. |
| `.env` file "missing" but you made one | Windows saved it as `.env.txt` | Rename it to exactly `.env`. |
| Changes to `.env` do nothing | Server was already running | Stop the server (Ctrl+C) and run `npm start` again. |
| Mistral website won't give you a key | Free tier requires phone verification | Complete the phone/verification steps in the Mistral console, then the API Keys page will work. |

### Run the tests

```
npm test
```

### Roadmap

- App library (save, reopen, duplicate, organize projects)
- Code generation and project file export
- User accounts and memberships
- Owner super admin dashboard
- Deployment and publishing tools
