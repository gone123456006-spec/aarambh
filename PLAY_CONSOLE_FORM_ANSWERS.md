# Google Play Console Form Answers (Ohm's)

Use this as a copy-paste guide while filling Play Console.

## A) Privacy Policy URL (Public HTTPS)

You must host `play-console-assets/privacy-policy.html` on a public HTTPS URL.

Recommended final URL:
- `https://ohmsapp.com/privacy-policy`

Temporary option (fast):
- Upload `play-console-assets/privacy-policy.html` to any static host (Netlify / Vercel / GitHub Pages) and use that HTTPS URL in Play Console.

Do not submit with a localhost, private IP, or non-HTTPS URL.

## B) Data Safety (Based on current app behavior)

### Does your app collect or share data?
- **Yes**

### Data collected (select these)
- Personal info -> Email address
- Personal info -> Name
- Personal info -> Phone number
- Personal info -> Other info (gender, region, learning level)
- Messages (random chat content)
- App activity (learning progress, reward progress, game progress)

### Is data shared?
- **No** for advertising/data brokerage.
- If you rely on processors (hosting/OTP email provider) only for app operations, this is typically not "shared" for ads; keep policy text aligned with this.

### Is all user data encrypted in transit?
- **Yes**

### Can users request data deletion?
- **Yes** (provide support email process: `support@ohmsapp.com`)

### Data collection purpose (mark as applicable)
- App functionality
- Account management
- Analytics / app improvement (only if actually done server-side)
- Fraud prevention / security

## C) Content Rating (Conservative for UGC Random Chat)

Because app has user-to-user chat, answer conservatively.

Select/indicate:
- User-generated communication: **Yes**
- User interaction between strangers: **Yes**
- Moderation/reporting capability: **Should be Yes in product behavior**
- Blocking capability: **Should be Yes in product behavior**

If moderation/report/block tooling is incomplete, implement before production rollout to reduce rejection risk.

## D) Target Audience

- App not directed to children under 13.
- Set audience according to policy text and actual UX.
- Ensure all legal pages and listing copy match this.

## E) Store Listing Assets to upload

Already generated in repo:
- `play-console-assets/phone-screenshot-1.png` (1080x1920)
- `play-console-assets/phone-screenshot-2.png` (1080x1920)
- `play-console-assets/feature-graphic-1024x500.png` (1024x500)

Also upload your final app icon in Play listing as needed.
