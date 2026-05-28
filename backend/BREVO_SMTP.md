# Brevo email (OTP)

## API (recommended)

No SMTP IP whitelist issues. In `backend/.env`:

```env
BREVO_API_KEY=your_xkeysib_key
SMTP_FROM=your_verified_sender@gmail.com
```

Test:

```bash
cd backend
npm run test:brevo
node scripts/test-brevo-api.js recipient@gmail.com
```

Restart backend after changing `.env`. OTP uses the API when `BREVO_API_KEY` is set.

---

# Brevo SMTP (fallback)

1. In [Brevo](https://app.brevo.com) go to **Senders, Domains & Dedicated IPs → Senders** and verify the address you want recipients to see (e.g. `your@gmail.com`).
2. Go to **SMTP & API → SMTP** and copy the **SMTP login** and **SMTP key**.
3. In `backend/.env`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_login@smtp-brevo.com
SMTP_PASS=your_smtp_key
SMTP_FROM=your_verified_sender@gmail.com
```

4. Restart the backend: `npm run dev`
5. On startup you should see: `[SMTP] Ready — host smtp-relay.brevo.com, from …`

**Note:** `SMTP_USER` is the Brevo SMTP login, not your Gmail. `SMTP_FROM` must be a sender verified in Brevo.

## Test from terminal

```bash
cd backend
npm run test:smtp
# Or send to a specific inbox:
node scripts/test-smtp.js your@gmail.com
```

## Error: `525 5.7.1 Unauthorized IP address`

Brevo is blocking your current IP. In Brevo go to **SMTP & API → SMTP** (or **Security**) and either:

- Turn off **Authorize only listed IPs**, or  
- Add your PC/server public IP to the allow list.

Then run `npm run test:smtp` again.
