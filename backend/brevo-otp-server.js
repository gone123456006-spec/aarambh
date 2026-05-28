/**
 * Standalone Brevo OTP test server (optional).
 * Main app already sends OTP at POST /api/auth/send-otp (npm run dev).
 *
 * This runs on port 5001 by default so it does not clash with the main API on 5000.
 *
 *   node brevo-otp-server.js
 *   curl -X POST http://localhost:5001/send-otp -H "Content-Type: application/json" -d "{\"email\":\"you@gmail.com\"}"
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const app = express();
const PORT = Number(process.env.BREVO_OTP_PORT) || 5001;

const senderEmail =
  process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM;
const senderName = process.env.BREVO_SENDER_NAME || "Ohm's English";

app.use(cors());
app.use(express.json());

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const api = new SibApiV3Sdk.TransactionalEmailsApi();

app.post('/send-otp', async (req, res) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      return res.status(500).json({ success: false, message: 'BREVO_API_KEY missing in .env' });
    }
    if (!senderEmail) {
      return res.status(500).json({ success: false, message: 'SMTP_FROM missing in .env' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    await api.sendTransacEmail({
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email }],
      subject: 'OTP Verification',
      htmlContent: `
        <div style="font-family:sans-serif">
          <h2>Your OTP Code</h2>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        </div>
      `,
    });

    const body = { success: true, message: `OTP sent to ${email}` };
    // Never return OTP in production — only for local debugging if explicitly enabled
    if (process.env.DEV_RETURN_OTP === 'true') {
      body.otp = otp;
    }

    res.json(body);
  } catch (err) {
    console.error(err?.response?.body || err);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Brevo OTP test server http://localhost:${PORT}`);
  console.log(`POST /send-otp  |  sender: ${senderEmail || '(not set)'}`);
});
