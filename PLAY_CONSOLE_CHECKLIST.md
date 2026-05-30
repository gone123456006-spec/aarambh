# Google Play Console — AAB Upload Guide (Ohm's)

Use this checklist before uploading `com.ohms.english` to Google Play Console.

## Quick URLs (paste into Play Console)

| Field | URL |
|-------|-----|
| Privacy policy | `https://gone123456006-spec.github.io/aarambh/privacy-policy.html` |
| Terms (optional) | `https://gone123456006-spec.github.io/aarambh/terms-and-conditions.html` |
| Render API (after redeploy) | `https://aarambh-api.onrender.com/privacy-policy` |
| Support email | `support@ohmsapp.com` |

**Important — enable hosting (pick one):**

1. **GitHub Pages (recommended for Play Console now):**  
   GitHub repo → **Settings → Pages** → Build from branch **main** → folder **`/docs`** → Save.  
   After 1–2 minutes open:  
   `https://gone123456006-spec.github.io/aarambh/privacy-policy.html`

2. **Render API (optional):** Dashboard → **aarambh-api** → **Manual Deploy** → Deploy latest commit.  
   Then: `https://aarambh-api.onrender.com/privacy-policy`

---

## Step 1 — Build the AAB

```bash
cd frontend
npx eas login
npm run build:aab
```

Or:

```bash
npx eas build -p android --profile production
```

Configured in `eas.json`:
- `buildType: app-bundle` (AAB, not APK)
- `autoIncrement: true` (version code bumps automatically)
- Package: `com.ohms.english`
- Version name: `1.0.0`
- Target SDK: **35**

Download the `.aab` from the EAS build page when finished.

---

## Step 2 — Create app in Play Console

1. [Google Play Console](https://play.google.com/console) → **Create app**
2. App name: **Ohm's**
3. Default language: English
4. App / game: **App**
5. Free or paid: **Free**

---

## Step 3 — Upload AAB (Internal testing first)

1. **Testing → Internal testing → Create new release**
2. Upload the `.aab` from EAS
3. Add release notes (e.g. "Initial release — English learning, courses, chat")
4. Save → Review release → **Start rollout to Internal testing**

Common upload errors and fixes:

| Error | Fix |
|-------|-----|
| Version code already used | Run a new EAS production build (`autoIncrement` bumps code) |
| Wrong signing key | Use the same EAS/Google Play upload key; do not mix local APK signing |
| Target API level too low | Already set to SDK 35 in `app.json` |
| Duplicate package name | Package must be unique; `com.ohms.english` |

---

## Step 4 — Store listing

Assets in `play-console-assets/`:

- [x] `phone-screenshot-1.png` (1080×1920)
- [x] `phone-screenshot-2.png` (1080×1920)
- [x] `feature-graphic-1024x500.png` (1024×500)

Copy text from `frontend/constants/playStore.ts` → `PLAY_STORE_LISTING`.

Required fields:
- Short description (≤ 80 chars)
- Full description
- App icon (512×512 — export from `ohms-icon.png`)
- Feature graphic 1024×500
- At least 2 phone screenshots
- **Privacy policy URL:** `https://aarambh-api.onrender.com/privacy-policy`
- Contact email: `support@ohmsapp.com`

---

## Step 5 — App content (required before production)

### Data safety
Declare data collected (match `frontend/constants/privacyContent.ts`):

- Email (OTP login)
- Name, phone, gender, region, learning level (profile)
- Messages (random chat)
- App activity / diagnostics (if collected server-side)

- Data encrypted in transit: **Yes**
- Users can request deletion: **Yes** (Contact Us → Delete my account)
- Account deletion URL: same privacy policy URL

### Ads
- App does **not** use advertising ID (`AD_ID` blocked in manifest)

### Content rating
Complete the questionnaire honestly — random chat / user-generated text may affect rating.

### Target audience
- Minimum age **13+** (matches Terms)

### News apps / COVID / etc.
- Select **No** where not applicable

---

## Step 6 — Permissions declaration

Declared in app:
- `CAMERA` — video English practice (user-initiated)
- `RECORD_AUDIO` — voice/video practice (user-initiated)
- `INTERNET` — API and chat

Blocked (not used):
- Advertising ID, media storage, external storage

Explain each sensitive permission in Play Console forms using text from `PLAY_STORE_PERMISSIONS` in `playStore.ts`.

---

## Step 7 — App access (for reviewers)

If login is required:
- **Testing → Internal testing** → add tester Gmail addresses, or
- **App content → App access** → provide test Gmail + note that OTP is sent to that email

---

## Step 8 — Submit for review

1. Complete all **Policy** and **Store listing** sections (green checkmarks)
2. Promote Internal testing → Closed/Open testing when ready
3. **Production** rollout after testing passes

Optional EAS submit after build:

```bash
npm run submit:play
```

---

## Project config summary

| Item | Value |
|------|-------|
| Package | `com.ohms.english` |
| Version | `1.0.0` |
| EAS project | `7ff2aadf-dae7-4b7c-9024-1bd25662363e` |
| Backend API | `https://aarambh-api.onrender.com` |
| Account deletion | Contact Us → Delete my account + `DELETE /api/users/me` |

---

## Before you upload — verify

- [ ] Backend redeployed (legal URLs open in browser)
- [ ] `npm run build:aab` succeeded on EAS
- [ ] Privacy policy URL loads over HTTPS
- [ ] Data safety form filled
- [ ] Content rating completed
- [ ] Internal test install works (login, chat, delete account flow)
