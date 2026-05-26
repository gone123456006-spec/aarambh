# Deploy Aarambh backend to Render

## 1. MongoDB Atlas

1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Database Access** → user with read/write.
3. **Network Access** → **Add IP Address** → `0.0.0.0/0` (allow Render; restrict later if needed).
4. **Connect** → Drivers → copy connection string → replace `<password>` and set database name, e.g. `aarambh`.

## 2. Gmail SMTP (OTP)

1. Google Account → Security → 2-Step Verification ON.
2. **App passwords** → create app → copy 16-character password.
3. Use that as `SMTP_PASS` (no spaces).

## 3. Create Render Web Service

### Option A — Blueprint (`render.yaml`)

1. Push repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect repo; Render detects `backend/render.yaml`.
4. Fill secret env vars when prompted (`MONGODB_URI`, `SMTP_*`, etc.).

### Option B — Manual

1. **New** → **Web Service** → connect repo.
2. **Root Directory:** `backend`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. **Health Check Path:** `/health`

## 4. Environment variables

Copy every key from [`.env.render.example`](./.env.render.example) into **Environment** in Render.

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | `production` |
| `MONGODB_URI` | Yes | Atlas connection string |
| `JWT_ACCESS_SECRET` | Yes | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Yes | different random string |
| `SMTP_USER` / `SMTP_PASS` | Yes | Gmail + app password |
| `CLIENT_URL` | Yes | `*` for Expo mobile |
| `KEEP_ALIVE_ENABLED` | Optional | `true` on free tier |

**Uploads:** Videos/PDFs save to `backend/uploads/` and are served at `/uploads/...`. On Render free tier, disk is **ephemeral** (files reset on redeploy). For persistent storage later, use S3 or similar — Cloudinary is not used.

Render injects automatically:

- `PORT`
- `RENDER=true`
- `RENDER_EXTERNAL_URL` → `https://your-service.onrender.com`

## 5. Verify deploy

```text
https://YOUR-SERVICE.onrender.com/health
```

Expected JSON: `"status": "UP"`.

Test OTP:

```text
POST https://YOUR-SERVICE.onrender.com/api/auth/send-otp
Content-Type: application/json

{"email":"you@gmail.com"}
```

## 6. Connect Expo frontend (two phones / any network)

In `frontend/.env`:

```env
EXPO_PUBLIC_REMOTE_API_URL=https://YOUR-SERVICE.onrender.com
EXPO_PUBLIC_API_PORT=5000
```

Then:

```bash
cd frontend
npx expo start --clear
```

Login screen should show **Server connected** with the `onrender.com` URL.

## 7. Admin user

There is no password login UI. After deploy, in MongoDB Atlas → **Browse Collections** → `users`:

- Find your Gmail user after first OTP login, set `role` to `"admin"`,  
  **or** insert a user document with `email`, `role: "admin"`, `profileCompleted: true`.

Admin API: `GET /api/admin/dashboard` with `Authorization: Bearer <accessToken>`.

## 8. Free tier notes

- Service sleeps after ~15 min idle; first request may take 30–60s.
- Keep-alive pings `/health` every 60s when `KEEP_ALIVE_ENABLED=true`.
- Socket.io chat works on the same Render URL (`wss://` via HTTPS).

## Local vs Render env files

| File | Use |
|------|-----|
| `.env` | Local dev only (gitignored) — copy from `.env.example` |
| `.env.render.example` | Template for Render Dashboard (no secrets committed) |
| `.env.example` | Local development template |
