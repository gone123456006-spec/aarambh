# Gmail SMTP setup (OTP emails)

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGODB_URI` to your MongoDB connection string.
3. Set JWT secrets (generate long random strings — never commit `.env`):

```env
JWT_ACCESS_SECRET=your_long_random_secret
JWT_REFRESH_SECRET=another_long_random_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

4. Configure Gmail SMTP (the account that **sends** OTP mail):

- Turn on **2-Step Verification** for that Google account.
- Create an **App Password**: Google Account → Security → App passwords → Mail.
- Use that 16-character password as `SMTP_PASS` (not your normal Gmail password).

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_sender@gmail.com
SMTP_PASS=your_16_char_app_password
```

5. Start the API:

```bash
cd backend
npm install
npm run dev
```

6. Point the Expo app at the server (`frontend/.env`):

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
```

Use your computer's LAN IP when testing on a real phone.

## API endpoints

- `POST /api/auth/send-otp` — body: `{ "email": "user@gmail.com" }`
- `POST /api/auth/verify-otp` — body: `{ "email": "user@gmail.com", "code": "123456" }`

Returns `accessToken`, `refreshToken`, and user info on success.
