# Google Play reviewer login (Ohm's)

Normal sign-in is unchanged. One extra Gmail uses a **fixed OTP** from server env vars.

## Step 1 — Create the Gmail (you do this manually)

1. Go to https://accounts.google.com/signup
2. Create: **ohmsplayreview@gmail.com** (or any `@gmail.com` you prefer)
3. Complete profile once in the app after first login (name, phone, region, level)

## Step 2 — Set env on Render

Render Dashboard → **aarambh-api** → **Environment**:

| Key | Value |
|-----|--------|
| `PLAY_REVIEWER_EMAIL` | `ohmsplayreview@gmail.com` |
| `PLAY_REVIEWER_OTP` | `847291` |

Redeploy the backend after saving.

## Step 3 — Test before resubmitting

1. Open app → Sign in
2. Gmail: `ohmsplayreview@gmail.com`
3. Tap **Send OTP**
4. Enter OTP: **847291**
5. You should log in (no email needed for this account)

## Step 4 — Play Console → Sign in details

Select **Yes** (login required), then paste:

**Username:** `ohmsplayreview@gmail.com`  
**Password:** `847291` (use OTP field / instructions if Console asks for password — see below)

**Instructions:**

```
Login required.

1. Tap Sign in or Get started
2. Enter Gmail: ohmsplayreview@gmail.com
3. Tap Send OTP
4. Enter OTP: 847291
5. Complete profile if shown (any valid test data)

All features available after login: Home, Courses, Games, Random Chat, Rewards, Leaderboard, Support.
First API call may take 15–30 seconds (server wake-up).
```

If Play Console has separate **username** and **password** fields, put:
- Username: `ohmsplayreview@gmail.com`
- Password: `847291`
- And add in instructions: "Password field is the fixed 6-digit OTP, not the Gmail password."

## Change OTP later

Update `PLAY_REVIEWER_OTP` on Render and the same value in Play Console instructions.
