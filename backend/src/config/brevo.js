const SibApiV3Sdk = require('sib-api-v3-sdk');

const apiKey = process.env.BREVO_API_KEY?.trim();
const brevoConfigured = Boolean(apiKey);

let transactionalEmailsApi = null;

if (brevoConfigured) {
  const client = SibApiV3Sdk.ApiClient.instance;
  const authentication = client.authentications['api-key'];
  authentication.apiKey = apiKey;
  transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();
}

const senderEmail =
  process.env.BREVO_SENDER_EMAIL?.trim() ||
  process.env.SMTP_FROM?.trim() ||
  '';
const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Ohm's English";

if (brevoConfigured && !senderEmail) {
  console.warn(
    '[Brevo] BREVO_API_KEY set but no sender email — set SMTP_FROM or BREVO_SENDER_EMAIL (verified in Brevo).'
  );
} else if (brevoConfigured) {
  console.log(`[Brevo] API ready — sender ${senderEmail}`);
}

module.exports = {
  transactionalEmailsApi,
  brevoConfigured,
  senderEmail,
  senderName,
};
