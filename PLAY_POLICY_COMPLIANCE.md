# Google Play Policy Compliance — Ohm's (com.ohms.english)

**Policy pages last synced:** 3 June 2026 (`npm run sync-legal` in `frontend/`)

Use this guide to fix **Policy status** rejections and complete Play Console declarations for **your app only**.

---

## Policy page audit (fixed)

| Google requirement | Before | After |
|--------------------|--------|-------|
| Data collected listed | Partial | Email, phone, profile, chat, progress |
| Data **not** collected | Missing | Contacts, location, gallery, AD ID stated |
| Account deletion | Partial | In-app + email + public URL |
| UGC / random chat moderation | Weak in web HTML | Filters, skip, report, not dating |
| Encryption in transit | Missing | HTTPS / secure chat stated |
| Photo library claim | Terms said "photos" | Removed — camera/mic only |
| In-app vs web mismatch | Different text | Synced via `sync-legal-html.js` |
| Terms web link in app | Missing | Added on Terms screen |

**Public privacy URL:** `https://gone123456006-spec.github.io/aarambh/privacy-policy.html`

---

## What blocked you (most likely)

| Issue | Fix |
|-------|-----|
| **Missing demo login** | Sign in details → **Yes** + reviewer Gmail + OTP `847291` → see `PLAY_REVIEWER_LOGIN.md` |
| **App content incomplete** | Complete every item under **Policy and programs → App content** (green checkmarks) |
| **Data safety mismatch** | Match answers to what the app actually collects (below) |
| **UGC (random chat)** | Declare user-generated content + moderation (below) |

The generic message *"Not adhering to Google Play Developer Program policies"* means one or more sections above are still wrong — not necessarily the April 2026 announcements.

---

## April 2026 policy announcements — does Ohm's need changes?

| Policy | Applies to Ohm's? | Action |
|--------|-------------------|--------|
| **Contacts Permissions** | **No** — app does not read contacts | Already blocked in `app.json`. Data safety: **No contacts** |
| **Location Permissions** | **No** — app does not use GPS | Blocked in `app.json`. Data safety: **No location** |
| **Geofencing foreground service** | **No** | Nothing to do |
| **Account Transfer workflow** | Only if selling the developer account | Nothing now |
| **Photo/Video permissions clarification** | **Yes** — camera for practice only | Declare camera/mic in Data safety + permission forms |
| **Dating / matchmaking clarification** | **No** — chat is **English practice**, not dating | Answer content rating honestly (Education, not dating) |
| **News app self-declaration** | **No** | Select **Not a news app** |
| **Health Connect / fitness data** | **No** | Data safety: **No health data** |
| **Prediction markets** | **No** | Nothing to do |

**Deadline:** April 15, 2026 (+ 30 days). Your app already avoids contacts/location — rebuild AAB after permission blocks if needed.

---

## Play Console — complete every section

### 1. Sign in details (was: App access)

**Path:** Policy and programs → App content → **Sign in details**

- Select **Yes** — login required  
- **Username:** `ohmsplayreview@gmail.com`  
- **Password / OTP:** `847291`  
- **Instructions:** copy from `PLAY_REVIEWER_LOGIN.md`  

**Backend:** Set on Render and redeploy:
```
PLAY_REVIEWER_EMAIL=ohmsplayreview@gmail.com
PLAY_REVIEWER_OTP=847291
```

---

### 2. Privacy policy

**URL (paste in Store listing + Data safety):**
```
https://gone123456006-spec.github.io/aarambh/privacy-policy.html
```

Must open in browser (HTTP 200).

---

### 3. Data safety form (exact answers for Ohm's)

**Does your app collect or share user data?** → **Yes**

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Yes | No | Account / OTP login |
| Name | Yes | No | Profile |
| Phone number | Yes | No | Profile |
| Other info (gender, region, level) | Yes | No | Profile |
| Messages (chat text) | Yes | No | App functionality (random chat) |
| App activity (scores, progress) | Yes | No | App functionality |

**NOT collected:** Location, Contacts, Photos (gallery), Health, Financial, AD ID

| Question | Answer |
|----------|--------|
| Data encrypted in transit | **Yes** (HTTPS / WSS) |
| Users can request deletion | **Yes** — Contact Us → Delete my account |
| Data optional? | Email required for login; profile fields optional until complete |
| Ads / ad ID | **No ads**, AD_ID blocked |
| Sold to third parties | **No** |
| Purpose | App functionality, account management |

---

### 4. Ads

**Path:** App content → **Ads**

→ **No**, app does not contain ads

---

### 5. Content rating (IARC)

Answer honestly for an **Education** app with **user text chat**:

- **Violence, sexual content, drugs:** No / None  
- **User interaction / communication:** **Yes** (learners chat)  
- **Shares user location:** **No**  
- **Unrestricted internet:** **Yes** (API + chat)  
- **Gambling, alcohol, tobacco:** No  

**Not a dating app** — random chat is for **English practice** only.

**Target age:** **13+** (matches Terms)

---

### 6. Target audience and content

- Target age: **13 and older**  
- **Not designed for children under 13**  
- App is **not** primarily for children  

---

### 7. User-generated content (random chat)

**Path:** App content → look for **User-generated content** / **UGC** (or answer in Content rating / Policy questionnaires)

Declare:

- **UGC:** Yes (chat messages)  
- **Not dating/matchmaking** — educational English practice  
- **Moderation in app:**
  - Profanity / abuse filter on messages  
  - English-only chat rules  
  - Skip partner button  
  - **Report** button (flag) → email support  
  - Terms & Privacy prohibit harassment and inappropriate content  
- **Reporting channel:** Contact Us + `aarambhfoundation111@gmail.com`  
- **Account deletion:** Contact Us → Delete my account  

---

### 8. Sensitive permissions (Camera & microphone)

**Path:** App content → **Sensitive permissions** / **Photo and video permissions** (if shown)

| Permission | Why |
|------------|-----|
| **Camera** | Video English practice — only when user taps to start a call |
| **Record audio** | Voice/video practice — only when user taps to start a call |

**Not used:** Contacts, location, photo library, SMS, phone

Paste from `frontend/constants/playStore.ts` → `PLAY_STORE_PERMISSIONS`.

---

### 9. News, health, financial, government apps

For each declaration in App content:

| Type | Answer |
|------|--------|
| News app | **No** |
| COVID-19 contact tracing | **No** |
| Health app | **No** |
| Financial features | **No** (free app, no Play Billing yet) |

---

### 10. Store listing

- Remove extra languages (**Hindi**, **en-IN**) if incomplete — keep **English (US)** only  
- Short description ≤ **80** characters  
- At least **2** phone screenshots (1080×1920)  
- Feature graphic **1024×500**  
- Contact email: **aarambhfoundation111@gmail.com**

---

## Rebuild & resubmit checklist

1. [ ] Render env: `PLAY_REVIEWER_EMAIL` + `PLAY_REVIEWER_OTP` → **Manual Deploy**  
2. [ ] Test reviewer login: Gmail + OTP `847291`  
3. [ ] Sign in details → **Yes** + credentials saved  
4. [ ] Data safety completed (table above)  
5. [ ] Content rating completed  
6. [ ] UGC / chat moderation declared  
7. [ ] Privacy URL works in browser  
8. [ ] New **AAB** build (`npm run build:aab`) if permissions changed  
9. [ ] Upload AAB → **Publishing overview** → **Send changes for review**

---

## If rejected again

1. Open **Policy status** → click the **specific issue** (not the generic page)  
2. Read the exact policy name (e.g. User Generated Content, Data safety, Login credentials)  
3. Fix only that item and resubmit  

---

## App technical summary (for forms)

| Item | Value |
|------|--------|
| Package | `com.ohms.english` |
| Category | Education |
| Login | Gmail + OTP |
| Reviewer login | Fixed OTP via env |
| Chat | Text UGC, filtered, skip + report; optional voice/video (user-initiated, peer-to-peer, not stored) |
| Permissions | INTERNET, CAMERA, RECORD_AUDIO only |
| Account delete | In-app + API |
| Privacy | GitHub Pages URL above |
| Min age | 13+ |
