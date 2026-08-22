# TTRPG Club Website

The website for a tabletop RPG club: a public site (game log, game masters, game
systems, member signup) plus an admin dashboard, and a Telegram Mini App that's
embedded inside the club's Telegram bot (see [`../ttrpg_poll_bot`](../ttrpg_poll_bot)).

All AWS infrastructure (Lambda, API Gateway, DynamoDB, Cognito, S3/CloudFront) is
defined in the sibling [`../aws_infra`](../aws_infra) repo, not here — this repo is
application code only. **Two fully independent, symmetric environments exist — dev and
prod** — see [Deployment](#deployment).

## What's here

- **Public pages**: Home, About, Game Masters (+ per-GM detail/stats), Game Systems,
  Game Log (session list → detail with rating poll results + comments), Signup, Login.
- **Member pages** (login required): Statistics (club-wide), Profile.
- **Game Master pages** (dm or admin role): Log a Game session.
- **Admin dashboard** (admin role): approve/reject signup requests, manage game
  systems/games/comments, manage members' roles, settings.
- **Telegram Mini App** (`/telegram/*`, no site nav — renders inside Telegram's own
  WebView chrome): personal rating stats, a leaderboard, per-session "who voted what",
  and a private session-feedback form. Authenticated via Telegram's signed `initData`,
  not Cognito — see [Data Model](#data-model-dynamodb) and
  [`../ttrpg_poll_bot/README_LAMBDA.md`](../ttrpg_poll_bot/README_LAMBDA.md).

## Monorepo layout

npm workspaces, three packages:

| Workspace | What |
|---|---|
| `frontend/` | React + TypeScript + Vite + Tailwind CSS v4. Static SPA, deployed to S3 + CloudFront. |
| `backend/` | Node.js/TypeScript. **One** Lambda function that routes 40 endpoints internally (see [API](#api)) — bundled with esbuild, not a per-route Lambda. |
| `shared/` | Types shared between frontend and backend (`Role`, `TelegramLeaderboardEntry`, etc.) — imported as `@ttrpg-club/shared`. |

## Prerequisites

- Node.js 24+, npm
- AWS CLI configured with credentials (only needed for deploying/inspecting the actual
  AWS infra — not required to run the frontend against an already-deployed backend)
- Terraform (only for infra changes — see `../aws_infra`)

## Local development

```bash
npm install
cp frontend/.env.example frontend/.env   # fill in — see table below
npm run dev:frontend
```

The backend can't be run as a local server the way an Express app could — it's a
Lambda handler (`api.handler`), invoked only via API Gateway. To develop against it,
point `frontend/.env` at an already-deployed dev backend (see table below), or deploy
your own changes with `npm run build:backend` + `aws lambda update-function-code`
(see [Deployment](#deployment)).

```bash
npm run typecheck   # both workspaces
npm run lint --workspace frontend
npm run build:frontend   # tsc -b && vite build
npm run build:backend    # esbuild bundle into backend/dist/api.js
```

### Frontend environment variables

All four come from Terraform outputs in `../aws_infra` — use the **dev** stack's
outputs for local development (`frontend/.env` is gitignored):

| Variable | Source |
|---|---|
| `VITE_API_BASE_URL` | `aws_infra/lambda/ttrpg_club_api_dev` → `terraform output api_base_url` |
| `VITE_COGNITO_USER_POOL_ID` | `aws_infra/cognito/ttrpg_club_dev` → `terraform output user_pool_id` |
| `VITE_COGNITO_CLIENT_ID` | `aws_infra/cognito/ttrpg_club_dev` → `terraform output web_client_id` |
| `VITE_AVATAR_CDN_BASE_URL` | `https://` + `aws_infra/s3/ttrpg_club_avatars_dev` → `terraform output distribution_domain_name` |

## Architecture

- **Frontend**: static SPA on S3, served through CloudFront
  (`aws_infra/s3_cloudfront/ttrpg_club_frontend_<env>`).
- **Backend**: one Lambda (`ttrpg-club-api-<env>`) behind an HTTP API (v2) Gateway.
  Every route has authorization type `NONE` — there's deliberately no API Gateway JWT
  authorizer, because several public routes (e.g. the Game Log) need to behave
  differently for logged-in vs anonymous callers, which an authorizer can't express as
  "optional". The Lambda verifies the Cognito ID token itself when a route needs one.
- **Auth**: Cognito User Pool, admin-provisioned members only (no public self-signup —
  see [Roles](#roles)). The frontend sends the ID token as a Bearer header.
- **Telegram auth**: separate from Cognito entirely. `/telegram/*` routes verify
  Telegram's own signed `initData` (HMAC against the poll bot's token, fetched from
  SSM) — see `backend/src/lib/telegramAuth.ts`. People who vote in the Telegram chat
  don't need a website account at all; Mini App stats are keyed purely by Telegram user
  ID.
- **Data**: 11 DynamoDB tables — see [Data Model](#data-model-dynamodb).
- **Avatars**: presigned PUT uploads go straight from the browser to S3 (not through
  the API Lambda), then served read-only via a separate CloudFront distribution.

## Roles

`Role = "player" | "dm" | "admin"`, stored as an array on each user (`users.roles` —
someone can be both `dm` and `admin`). No role means logged out / not yet a member.

| Role | Grants |
|---|---|
| *(none)* | Public pages only |
| `player` | + Statistics, Profile |
| `dm` (Game Master) | + Log a Game (`/games/log`) |
| `admin` | + Admin Dashboard (`/admin`): signup approvals, game system/game/comment management, user role management, settings |

The very first admin has to be created manually — there's no admin until one exists.
See `../aws_infra/README.md`'s "Website stack" section.

## Data Model (DynamoDB)

Owned by `aws_infra/dynamodb/ttrpg_club/<env>` — one Terraform state, all 14 tables,
dev and prod fully separate (`ttrpg_club_dev_*` / `ttrpg_club_prod_*` names). Point-in-time
recovery is enabled on all prod tables.

| Table | Key | Purpose |
|---|---|---|
| `users` | `userId` | Member accounts — profile fields, `roles`, avatar URL. |
| `signup_requests` | `requestId` (+ `status-index` GSI) | Pending club membership applications; admin approves/rejects. Has a DynamoDB Stream → triggers `notifySignup` in `ttrpg_poll_bot`, DMing the admin. |
| `game_systems` | `systemId` | The TTRPG systems the club plays (D&D, Blades in the Dark, etc.) — admin-managed reference data. |
| `games` | `gameId` | Logged session records — system, GM, date, description. |
| `game_participants` | `userId` + `gameId` | Who played in which session (site-side attendance, distinct from the Telegram poll-vote data below). |
| `game_poll_votes` | `gameId` + `userId` | Website's own in-session rating poll (separate feature from the Telegram `/rate` polls). |
| `game_comments` | `gameId` + `commentId` | Comments on a logged session. |
| `settings` | `pk` | Site-wide settings (e.g. an anonymize toggle for public stats). |
| `telegram_rating_polls` | `pollId` (+ `creatorUserId-index` GSI) | One row per `/rate` poll created in the Telegram chat — question text, GM (`creatorUserId`). Written by `ttrpg_poll_bot`, read by this backend for the Mini App. |
| `telegram_rating_votes` | `pollId` + `telegramUserId` (+ `telegramUserId-index` GSI) | One row per person's rating on a poll — the row's mere existence is the vote; a retraction deletes it. Same pipeline as above. |
| `telegram_feedback` | `pollId` + `feedbackId` | Detailed, mostly-anonymous per-session feedback submitted via the Mini App's feedback form. Gated on `telegram_rating_votes`: only someone who voted on that poll's `/rate` may submit, and only once per poll (`POST /telegram/feedback/eligibility` lets the Mini App check both before rendering the form; `POST /telegram/feedback` re-checks both server-side). Has a DynamoDB Stream → triggers `notifyFeedback` in `ttrpg_poll_bot`, DMing the GM. |
| `telegram_xp_ledger` | `telegramUserId` + `sourceId` | Append-only audit trail of every XP award (gamification) — written and read only by `ttrpg_poll_bot`; this backend never touches it. |
| `telegram_player_level` | `telegramUserId` | One row per player: current level/XP plus lifetime `gamesPlayed`/`feedbackGiven` counters. Written by `ttrpg_poll_bot`, read by this backend for `/telegram/stats` and `/telegram/achievements`. |
| `telegram_achievements` | `telegramUserId` + `achievementId` | One-time badges (no XP) — a row's existence is the unlock. Written by `ttrpg_poll_bot`, read by this backend for `/telegram/achievements`. |

The `telegram_*` tables are the ones this website *reads* to power the Mini App
(`TABLE_TELEGRAM_RATING_VOTES`/`_POLLS`/`_FEEDBACK`/`_PLAYER_LEVEL`/`_ACHIEVEMENTS` env
vars) — they're *written* by `ttrpg_poll_bot`, not by this backend (except
`telegram_feedback`, which the Mini App's feedback form itself writes to via
`POST /telegram/feedback`; XP/levels/achievements are deliberately awarded only by the
bot, never this backend — see `../ttrpg_poll_bot/README_LAMBDA.md`'s Gamification
section for why). See that same doc for exactly how/when each table gets written.

## API

One Lambda, routed internally by `event.routeKey` (see `backend/src/handlers/api.ts`).
Grouped by area:

**Public / member**: `GET /health`, `POST /signup`, `GET /game-systems`,
`GET /game-masters(/:userId)`, `GET /games(/:gameId)`,
`POST /games/:gameId/poll-vote`, `GET /games/:gameId/poll-results`,
`GET /games/:gameId/poll-voters`, `GET|POST /games/:gameId/comments`, `GET /members`,
`GET /statistics`, `GET /me(/stats)`, `PATCH /me/profile`, `POST /me/avatar-upload-url`.

**Admin only**: `POST|PATCH|DELETE /admin/game-systems(/:systemId)`,
`POST|PATCH|DELETE /admin/games(/:gameId)`,
`DELETE /admin/games/:gameId/comments/:commentId`, `GET /admin/signup-requests`,
`POST /admin/signup-requests/:requestId/approve|reject`,
`PATCH /admin/settings/anonymize-toggle`, `GET /admin/users`,
`PATCH /admin/users/:userId/roles`.

**Telegram Mini App** (`initData`-authenticated, no Cognito token):
`POST /telegram/stats`, `POST /telegram/feedback`, `POST /telegram/feedback/eligibility`,
`POST /telegram/games/played|conducted|all`, `POST /telegram/games/:pollId/voters`,
`POST /telegram/leaderboard`, `POST /telegram/achievements`.

## Deployment

Two fully independent, symmetric stacks — **dev** and **prod** — nothing is shared
(separate DynamoDB tables, Cognito pools, S3 buckets, CloudFront distributions, API
Gateways) except the domain itself: prod is `dnaclub.com.ua` (`www.` redirects to it),
dev is `dev.dnaclub.com.ua`, both TLS via free auto-renewing ACM certificates — see
`../aws_infra/dns/dnaclub_com_ua`. The API's `cors_allowed_origins` is locked to each
environment's real domain (dev also allows `http://localhost:5173` for local frontend
development). Full apply order and one-time infra setup: `../aws_infra/README.md`'s
"Website stack" section.

**Branch → environment promotion**, via `.github/workflows/deploy-backend.yml` /
`deploy-frontend.yml`:

| Push to | Deploys |
|---|---|
| `develop` | dev stack (`ttrpg-club-api-dev`, `ttrpg-club-frontend-dev`) |
| `main` | prod stack (`ttrpg-club-api-prod`, `ttrpg-club-frontend-prod`) |

Each workflow picks a GitHub **Environment** (`development` / `production`) by branch
name, and reads that environment's own variables — `LAMBDA_FUNCTION_NAME`,
`FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `VITE_API_BASE_URL`,
`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_AVATAR_CDN_BASE_URL` — set
these per-environment in *Settings → Environments* to point at each stack's Terraform
outputs. `AWS_DEPLOY_ROLE_ARN` is a single shared repo secret (one broadened OIDC role
covers both stacks' exact resource ARNs — see `aws_infra/iam/github_actions_ttrpg_club`).

Routine code changes need nothing beyond a push to the right branch — CI builds, zips,
and calls `aws lambda update-function-code` / `aws s3 sync` + CloudFront invalidation.
No CloudFormation, no Serverless Framework involved.

## Related repos

- [`../aws_infra`](../aws_infra) — all Terraform for this site and the poll bot
  (DynamoDB, Lambda, API Gateway, Cognito, S3/CloudFront, IAM, monitoring/alerting).
- [`../ttrpg_poll_bot`](../ttrpg_poll_bot) — the Telegram bot that creates the `/rate`
  polls this site's Mini App reads, and that embeds the Mini App itself.
