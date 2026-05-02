# ClipRank — Multimodal AI Video Analyzer

A multimodal AI-powered video analysis tool for social media creators. Upload a video clip and get a calibrated virality score based on real TikTok/Reels/Shorts algorithm signals — not generic AI ratings. Includes niche detection, competitor pattern analysis, retention risk breakdown, and professional advice.

## Architecture

**Monorepo** managed with pnpm workspaces.

### Services

| Service | Port | Path | Package |
|---------|------|------|---------|
| API Server (Express) | 8080 | `/api` | `@workspace/api-server` |
| ClipRank Frontend (Vite+React) | 3000 | `/` | `@workspace/cliprank` |
| Mockup Sandbox (Design) | 8081 | `/__mockup` | `@workspace/mockup-sandbox` |

### Frontend (`artifacts/cliprank`)

- **Framework**: React + Vite + TypeScript
- **UI**: Dark Apple-style (#0D0D0D background), glassmorphism cards, Framer Motion animations
- **CSS**: Tailwind CSS v4 with custom CSS variables for the dark theme
- **Auth**: Clerk (Replit-managed) — Google OAuth + email/password. Keys in secrets: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
- **Router**: Wouter with base path `/`
- **Routes**:
  - `/` — LandingPage (public, signed-in redirects to `/app`)
  - `/app` — AnalyzerPage (protected, signed-out redirects to `/`)
  - `/history` — HistoryPage (protected)
  - `/learn-more` — LearnMorePage (public)
  - `/pricing` — PricingPage (public)
  - `/sign-in/*?` — Clerk sign-in (Higgsfield-style split-screen)
  - `/sign-up/*?` — Clerk sign-up (Higgsfield-style split-screen)
- **Key pages**:
  - `src/pages/LandingPage.tsx` — Public landing page with hero, features, CTA
  - `src/pages/LearnMorePage.tsx` — Detailed how-it-works documentation
  - `src/pages/PricingPage.tsx` — 4-tier credit pricing (Free/Starter/Creator/Pro)
  - `src/pages/AnalyzerPage.tsx` — Main upload + AI results page (protected)
  - `src/pages/HistoryPage.tsx` — Past analyses list with stats (protected)
- **Key components**:
  - `src/components/RadialProgress.tsx` — Animated SVG radial score bars (Framer Motion count-up)
  - `src/components/AnalysisProgress.tsx` — Step-by-step progress timeline (reading → extracting → sending → transcribing → scoring → researching)
  - `src/components/PaypalButton.tsx` — Dynamic PayPal JS SDK integration for $10 unlock
  - `src/hooks/useVideoProcessor.ts` — ffmpeg-wasm client-side frame extraction (1 frame/2s, max 20 frames)
- **API Client**: `@workspace/api-client-react` — auto-generated React Query hooks from OpenAPI spec

### Backend (`artifacts/api-server`)

- **Framework**: Express + TypeScript, ESBuild bundled
- **Key routes**:
  - `POST /api/videos/analyze` — Accept frames + fingerprint, check cache, call GPT vision API, return scores
  - `GET /api/videos` — List recent analyses
  - `GET /api/videos/:id` — Get single analysis
  - `POST /api/videos/:id/unlock` — Mark premium as unlocked after payment
  - `POST /api/payments/create-order` — Create PayPal order ($10)
  - `POST /api/payments/capture-order` — Capture PayPal payment
  - `GET /api/videos/stats` — Aggregate stats

### Database

PostgreSQL via Drizzle ORM. Schema in `lib/db/src/schema/analyses.ts`.

**Table: `analyses`**
- `id` (uuid, PK)
- `fingerprint` (text, unique) — SHA-256 of first 1MB of video file for cache lookup
- `filename`, `durationSeconds`, `frameCount`
- `overallScore`, `pacingScore`, `visualHookScore`, `captionReadabilityScore` (numeric 0–100)
- `summary`, `pacingFeedback`, `visualHookFeedback`, `captionFeedback`
- `transcript`
- `isPremiumUnlocked` (boolean)
- `professionalAdvice`, `visualHeatmap` (nullable, revealed after payment)
- `paypalOrderId` (nullable)
- `createdAt`

### AI Integration

Uses OpenAI GPT-4 vision (configured via Replit AI Integrations) through `lib/integrations/openai-ai-server`.
Base URL and API key come from `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`.

### Payments

PayPal REST API v2. Requires:
- `PAYPAL_CLIENT_ID` — server-side
- `PAYPAL_CLIENT_SECRET` — server-side
- `VITE_PAYPAL_CLIENT_ID` — frontend (loads PayPal JS SDK)
- `PAYPAL_ENV` — set to `"production"` for live payments (default: sandbox)

## Development Notes

- ffmpeg-wasm requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` headers on the dev server (set in `vite.config.ts`)
- The `.replit` file registers `localPort = 3000` for the cliprank frontend so the workflow detector can find it
- Frame fingerprint is SHA-256 of first 1MB of video — used for edge caching to avoid re-analyzing the same video
- Free tier: overall score + per-dimension scores + feedback summary + transcript
- Premium ($10): professional editing advice + visual attention heatmap

## Key Files

```
artifacts/cliprank/src/
  App.tsx                     — Root with QueryClient + Wouter router
  pages/AnalyzerPage.tsx      — Main upload/analysis UI
  pages/HistoryPage.tsx       — History list
  components/RadialProgress.tsx
  components/PaypalButton.tsx
  hooks/useVideoProcessor.ts
  index.css                   — Full dark theme with CSS variables

artifacts/api-server/src/routes/
  videos.ts                   — AI analysis + caching logic
  payments.ts                 — PayPal order create/capture

lib/
  api-spec/openapi.yaml       — OpenAPI contract (source of truth)
  api-client-react/           — Generated React Query hooks
  api-zod/                    — Generated Zod schemas
  db/src/schema/analyses.ts   — Drizzle DB schema
```
