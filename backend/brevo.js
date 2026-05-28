require('dotenv').config();

const SibApiV3Sdk = require('sib-api-v3-sdk');

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();

const senderEmail =
  process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
const senderName = process.env.BREVO_SENDER_NAME || "Ohm's English";
const to = process.argv[2] || senderEmail;

async function sendEmail() {
  if (!process.env.BREVO_API_KEY) {
    console.error('Missing BREVO_API_KEY in backend/.env');
    process.exit(1);
  }
  if (!senderEmail) {
    console.error('Missing SMTP_FROM or BREVO_SENDER_EMAIL in backend/.env');
    process.exit(1);
  }

  const otp = Math.floor(100000 + Math.random() * 900000);

  try {
    const result = await transactionalEmailsApi.sendTransacEmail({
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email: to }],
      subject: 'OTP Verification',
      htmlContent: `
        <div style="font-family:sans-serif">
          <h2>Your OTP Code</h2>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        </div>
      `,
    });

    console.log('Mail sent:', result?.messageId || result);
    console.log('To:', to);
  } catch (err) {
    console.error(err?.response?.body || err);
    process.exit(1);
  }
}

sendEmail();
