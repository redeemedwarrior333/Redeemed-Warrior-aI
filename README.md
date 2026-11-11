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

### Quick start (beginner friendly)

1. Install [Node.js](https://nodejs.org) version 18 or newer.
2. Get an AI provider API key. The default setup uses [Mistral AI](https://console.mistral.ai), which has a free tier. Any OpenAI-compatible provider works (OpenAI, Groq, OpenRouter, and others) — just change `AI_BASE_URL` and `AI_MODEL`.
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
| `AI_BASE_URL` | Your AI provider's URL (default: Mistral) |
| `AI_API_KEY` | Your AI provider key |
| `AI_MODEL` | Which AI model to use (default: `mistral-small-latest`, a cost-conscious choice) |
| `RATE_LIMIT_MAX` | Requests allowed per minute per visitor (default 60) |

### Security notes

- The AI's behavior is governed entirely by [MASTER_PROMPT.md](MASTER_PROMPT.md) — edit that file to change how the AI acts.
- Set `API_KEY` before exposing this to the internet.
- Never put your `.env` file on GitHub — it is already excluded by `.gitignore`.

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
