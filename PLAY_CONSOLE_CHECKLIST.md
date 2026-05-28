# Google Play Console Upload Checklist (Ohm's)

This checklist is based on the current project configuration in `frontend`.

## 1) App Bundle / Package

- [x] Application ID (package name): `com.ohms.english`
- [x] Version name: `1.0.0`
- [x] Version code present: `1` (auto-increment enabled via EAS production profile)
- [x] AAB build profile configured (`frontend/eas.json` -> `production.android.buildType: app-bundle`)
- [ ] Build and upload first `.aab` to Internal testing

Commands:

```bash
cd frontend
npx eas login
npx eas build -p android --profile production
```

## 2) Store Listing Assets

### App icon
- [x] Launcher icon source exists: `frontend/assets/images/aarambh-icon.png` (`1254x1254`)
- [x] Play icon candidate exists: `frontend/assets/images/icon.png` (`1024x1024`)

### Required Play assets to prepare in Console
- [ ] Phone screenshots: at least 2 (recommended 4-8), JPEG/24-bit PNG, each side 320-3840 px, aspect ratio 16:9 to 9:16
- [ ] Feature graphic: exactly `1024x500` PNG/JPG
- [ ] Optional but recommended: promo video URL

Prepared assets:
- [x] `play-console-assets/phone-screenshot-1.png` (`1080x1920`)
- [x] `play-console-assets/phone-screenshot-2.png` (`1080x1920`)
- [x] `play-console-assets/feature-graphic-1024x500.png` (`1024x500`)

## 3) Privacy Policy / Legal

- [x] In-app privacy page exists: `frontend/app/privacy.tsx`
- [x] In-app terms page exists: `frontend/app/terms.tsx`
- [x] In-app contact page exists: `frontend/app/contact-us.tsx`
- [ ] Public privacy policy URL (HTTPS) for Play Console (required if personal/sensitive data is collected)
- [ ] Put the same URL in Play listing + in-app where users can open it

Suggested URL format:
- `https://your-domain.com/privacy-policy`
- `https://your-domain.com/terms-and-conditions`

Prepared page file:
- [x] `play-console-assets/privacy-policy.html` (ready to host on HTTPS)

## 4) App Content -> Data safety (fill this carefully)

Based on current code and privacy text, declare the following:

### Data collected
- [x] Personal info -> Email address (login OTP)
- [x] Personal info -> Phone number (profile/contact)
- [x] Personal info -> Name (profile)
- [x] Personal info -> Other personal info (gender, region, learning level)
- [x] Messages (random chat content)
- [x] App info and performance (basic diagnostics/security/performance if collected server-side)

### Data shared with third parties
- [ ] Mark according to your backend reality.  
  If only your own backend and essential processors (SMTP/hosting) are used for app operation, do **not** mark advertising sharing.

### Security and handling
- [x] Data transmitted in transit (socket/API over network)
- [ ] Account deletion mechanism: confirm and declare accurately in Console
- [ ] Data deletion request flow: provide email/process in policy

## 5) Permissions / Sensitive APIs

Configured permissions (from app config/plugins):
- [x] Camera
- [x] Microphone

Store declaration readiness:
- [x] Permission purpose text exists for camera/microphone
- [ ] Ensure no undeclared permission gets added in final Android manifest
- [ ] If photo/library access is used later, keep Data safety + privacy policy aligned

## 6) Content Rating & Target Audience

Your app includes real-time random chat with user-generated text.  
This usually increases moderation/safety expectations.

- [ ] Complete Content rating questionnaire conservatively (do not under-rate)
- [ ] If minors can access app, ensure strong UGC safeguards and reporting/moderation
- [ ] Target audience form must match terms/privacy age statements (`13+` currently)

## 7) Policy Areas to Double-Check

- [ ] User-generated content policy compliance (report, block, and moderation workflow)
- [ ] Spam/deceptive behavior: no misleading metadata
- [ ] Stable support contact in Play listing (email should be monitored)
- [ ] App access instructions (if login required for reviewer testing)

## 8) Before Final Production Rollout

- [ ] Upload to Internal testing first
- [ ] Install from Play internal track and verify login/chat/profile flows
- [ ] Confirm no crash on launch on Android 13/14+
- [ ] Recheck Data safety answers after first review feedback

---

## Fast "Not To Miss" Blockers

1. Add a real **public privacy policy URL** (HTTPS) in Play Console.
2. Create valid **phone screenshots** and **1024x500 feature graphic**.
3. Fill **Data safety** exactly matching collected fields (email/phone/name/profile/chat).
4. Ensure **content rating/target audience** answers reflect random chat capability.
