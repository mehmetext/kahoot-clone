## Realtime Kahoot Clone API

A production-ready, real-time “Kahoot”-like quiz game backend. Users create quizzes and start games; players join rooms via a PIN; questions are scheduled and score updates are broadcast instantly to all connected clients over WebSocket.

This repo uses **NestJS + Socket.IO + Redis + BullMQ + PostgreSQL (Prisma)**.

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **HTTP API**        | NestJS 11 (Node.js)                                  |
| **Real-time**       | Socket.IO (`@nestjs/websockets`)                     |
| **Database**        | PostgreSQL (Prisma + `@prisma/adapter-pg`)           |
| **Cache / State**   | Redis (ioredis)                                      |
| **Job Queue**       | BullMQ (`@nestjs/bullmq`)                            |
| **Auth**            | JWT (access token) + refresh token (Redis), bcryptjs |
| **Validation**      | class-validator + global `ValidationPipe`            |
| **Docs**            | Swagger (`/api`)                                     |
| **Language**        | TypeScript                                           |
| **Package Manager** | pnpm                                                 |

## Running Locally

This project requires **PostgreSQL** and **Redis**.

### 1) Environment variables

At minimum, the following are required:

| Variable         | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `PORT`           | **Required.** HTTP port (e.g. `4000`)                         |
| `DATABASE_URL`   | **Required.** PostgreSQL connection string                    |
| `REDIS_URL`      | **Required.** Redis connection string                         |
| `JWT_SECRET`     | **Required.** JWT signing secret                              |
| `JWT_EXPIRES_IN` | **Required in production.** `ms` format (e.g. `15m`)          |
| `NODE_ENV`       | `development` \| `production` (affects token TTL behavior)    |

Notes:

- With `NODE_ENV=development`, the access token TTL is **15 days**.
- Refresh tokens are stored in Redis as `refresh-token:{uuid}` with a **7-day** TTL.
- On login, a user snapshot is written to Redis as `user:{id}` (hash). WebSocket auth also validates from this cache.

### 2) Install + migrations + run

```bash
pnpm install

# Prisma client
pnpm run prisma:generate

# DB migrate (dev)
pnpm run prisma:migrate

# API (watch)
pnpm run start:dev
```

The API runs at `http://localhost:4000` by default (depending on `PORT`).

## API Reference

All successful HTTP responses follow a consistent envelope:

```json
{ "success": true, "data": {} }
```

Swagger UI: `http://localhost:<PORT>/api`

### Auth — `/auth`

| Method | Path                  | Auth   | Description                              |
| ------ | --------------------- | ------ | ---------------------------------------- |
| `POST` | `/auth/register`      | Public | Register (email + password)              |
| `POST` | `/auth/login`         | Public | Login (JWT access token + refresh token) |
| `POST` | `/auth/refresh-token` | Public | Rotate tokens using refresh token        |
| `GET`  | `/auth/me`            | JWT    | Current user (via JWT strategy)          |

### Quizzes — `/quizzes`

| Method   | Path                                         | Auth | Description                      |
| -------- | -------------------------------------------- | ---- | -------------------------------- |
| `POST`   | `/quizzes`                                   | JWT  | Create a quiz                    |
| `GET`    | `/quizzes`                                   | JWT  | List the user’s quizzes          |
| `GET`    | `/quizzes/:id`                               | JWT  | Quiz details                     |
| `PUT`    | `/quizzes/:id`                               | JWT  | Update a quiz                    |
| `DELETE` | `/quizzes/:id`                               | JWT  | Delete a quiz                    |
| `POST`   | `/quizzes/:id/questions`                     | JWT  | Add a question to a quiz         |
| `PUT`    | `/quizzes/:id/questions/:questionId`         | JWT  | Update a question                |
| `PUT`    | `/quizzes/:id/questions/:questionId/options` | JWT  | Update question options          |
| `DELETE` | `/quizzes/:id/questions/:questionId`         | JWT  | Delete a question                |

### Games — `/games`

| Method | Path                  | Auth | Description                        |
| ------ | --------------------- | ---- | ---------------------------------- |
| `POST` | `/games`              | JWT  | Create a game from a quiz (generates a PIN) |
| `GET`  | `/games`              | JWT  | List the user’s games                       |
| `GET`  | `/games/finished`     | JWT  | List finished games                         |
| `GET`  | `/games/finished/:id` | JWT  | Finished game details                       |
| `GET`  | `/games/:pin`         | JWT  | Game state (host only)                      |

## WebSocket API

Namespace: `/game`

Connect with JWT:

```ts
io('http://localhost:4000/game', { auth: { token: '<accessToken>' } });
```

Note: Host events require JWT (`WsGuard`). Player join/answer events are managed based on the room state.

### Client → Server events

| Event                | Auth   | Payload                        |
| -------------------- | ------ | ------------------------------ |
| `host:join-game`     | JWT    | `{ pin }`                      |
| `host:start-game`    | JWT    | `{ pin }`                      |
| `host:end-game`      | JWT    | `{ pin }`                      |
| `host:next-question` | JWT    | `{ pin }`                      |
| `player:join`        | Public | `{ pin, nickname, playerId? }` |
| `player:answer`      | Public | `{ pin, answerId }`            |

### Server → Client events (selected)

| Event            | Payload                     | When?                        |
| ---------------- | --------------------------- | ---------------------------- |
| `player:joined`  | `{ nickname, playerCount }` | When a player joins the room |
| `game:starting`  | `{ countdown }`             | When the host starts the game |
| `question:start` | (question state)            | When a question starts (BullMQ job) |
| `question:end`   | (review state)              | When time expires / job completes |
| `game:ended`     | (summary)                   | When the game ends           |

## Architecture Decisions

### Why Redis?

Redis holds the “hot path” game state in this project:

- **Game room state**: `game:{pin}` hash (status, index, timestamps, etc.)
- **Players**: `game:{pin}:players`, `:nicknames`, `:scores`, `:sockets`
- **Reconnect safety**: server-issued `playerId` is validated via Redis

This avoids hitting the DB on every WebSocket event and enables fast validation and fanout.

### Why BullMQ?

The game flow has time-based steps like countdowns and question deadlines. Doing this with in-process `setTimeout` risks losing state on restart/crash. BullMQ provides:

- **Delayed jobs** for deterministic scheduling
- **Retry/backoff** for resilience to transient failures
- Jobs stored in Redis, so they can be managed **after restarts**

In this project, the `game` queue processes `next-question`, `end-question`, `end-game`, and `clear-game` jobs.

### Why WebSocket (Socket.IO)?

During a game, we need to broadcast events to all clients in the same room, such as:

- “game is starting”
- “question started/ended”
- “score updated”

Socket.IO is used to push these events **instantly**. The room model is `game:{pin}`.

## Scripts

```bash
pnpm run start:dev
pnpm run build
pnpm run start:prod

pnpm run prisma:generate
pnpm run prisma:migrate
pnpm run prisma:migrate:deploy
pnpm run prisma:studio
```
