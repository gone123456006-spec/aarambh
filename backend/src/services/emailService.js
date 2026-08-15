const transporter = require('../config/nodemailer');
const { smtpConfigured, smtpFrom } = require('../config/nodemailer');
const { getPublicBaseUrl } = require('../config/env');

/**
 * Send subscription confirmation email to user
 */
async function sendSubscriptionConfirmationEmail(user, subscription) {
  if (!smtpConfigured) {
    console.warn('[Email] SMTP not configured, skipping subscription confirmation email');
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const baseUrl = getPublicBaseUrl();
    const appName = 'Ohm\'s English';
    
    const expiryDateStr = subscription.expiryDate 
      ? new Date(subscription.expiryDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'N/A';
    
    const purchaseDateStr = subscription.purchaseDate
      ? new Date(subscription.purchaseDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'N/A';

    const subject = `${appName} - Subscription Confirmed! 🎉`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #e60000 0%, #ff3355 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                🎉 Subscription Activated!
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi <strong>${user.name || 'there'}</strong>,
              </p>
              
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                Thank you for subscribing to <strong>${appName} ${subscription.planName || 'Pro'}</strong>! Your payment has been successfully verified and your subscription is now active.
              </p>
              
              <!-- Subscription Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px; color: #e60000; font-size: 18px; font-weight: 600;">
                      Subscription Details
                    </h2>
                    
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <strong>Plan:</strong>
                        </td>
                        <td style="color: #333333; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0; text-align: right;">
                          ${subscription.planName || 'Pro'}${subscription.category && subscription.category !== 'all' ? ` (${subscription.category})` : ''}
                        </td>
                      </tr>
                      ${subscription.originalPrice != null && subscription.discountAmount > 0 ? `
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <strong>Original price:</strong>
                        </td>
                        <td style="color: #333333; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0; text-align: right;">
                          ₹${subscription.originalPrice}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <strong>Discount${subscription.couponCode ? ` (${subscription.couponCode})` : ''}:</strong>
                        </td>
                        <td style="color: #00b894; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0; text-align: right;">
                          −₹${subscription.discountAmount}
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <strong>Amount Paid:</strong>
                        </td>
                        <td style="color: #333333; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0; text-align: right;">
                          ₹${subscription.price || 0}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <strong>Purchase Date:</strong>
                        </td>
                        <td style="color: #333333; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0; text-align: right;">
                          ${purchaseDateStr}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <strong>Expiry Date:</strong>
                        </td>
                        <td style="color: #333333; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e0e0e0; text-align: right;">
                          ${expiryDateStr}
                        </td>
                      </tr>
                      ${subscription.razorpayPaymentId ? `
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 8px 0;">
                          <strong>Transaction ID:</strong>
                        </td>
                        <td style="color: #333333; font-size: 14px; padding: 8px 0; text-align: right; font-family: monospace;">
                          ${subscription.razorpayPaymentId}
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                You now have access to ${subscription.planName || 'your'} courses. Start learning and enjoy your enhanced experience!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${baseUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #e60000 0%, #ff3355 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Open App
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions or need assistance, please don't hesitate to contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 8px; color: #666666; font-size: 13px;">
                Thank you for choosing ${appName}!
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `
${appName} - Subscription Confirmed!

Hi ${user.name || 'there'},

Thank you for subscribing to ${appName} ${subscription.planName || 'Pro'}! Your payment has been successfully verified and your subscription is now active.

Subscription Details:
- Plan: ${subscription.planName || 'Pro'}
- Amount Paid: ₹${subscription.price || 0}
- Purchase Date: ${purchaseDateStr}
- Expiry Date: ${expiryDateStr}
${subscription.razorpayPaymentId ? `- Transaction ID: ${subscription.razorpayPaymentId}` : ''}

You now have full access to all premium features, courses, and content. Start learning and enjoy your enhanced experience!

If you have any questions or need assistance, please don't hesitate to contact our support team.

Thank you for choosing ${appName}!

© ${new Date().getFullYear()} ${appName}. All rights reserved.
    `.trim();

    const mailOptions = {
      from: `"${appName}" <${smtpFrom}>`,
      to: user.email,
      subject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[Email] Subscription confirmation sent to ${user.email} (messageId: ${info.messageId})`);
    
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed to send subscription confirmation:', error);
    return { sent: false, error: error.message };
  }
}

/**
 * Send subscription expiry reminder email
 */
async function sendSubscriptionExpiryReminderEmail(user, subscription, daysRemaining) {
  if (!smtpConfigured) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const baseUrl = getPublicBaseUrl();
    const appName = 'Ohm\'s English';
    
    const expiryDateStr = subscription.expiryDate 
      ? new Date(subscription.expiryDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'N/A';

    const subject = `${appName} - Your Subscription Expires in ${daysRemaining} Days`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Expiry Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                ⏰ Subscription Expiring Soon
              </h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi <strong>${user.name || 'there'}</strong>,
              </p>
              
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                Your ${appName} ${subscription.planName || 'Pro'} subscription will expire in <strong>${daysRemaining} days</strong> on <strong>${expiryDateStr}</strong>.
              </p>
              
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                Renew now to continue enjoying uninterrupted access to all premium features, courses, and content.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${baseUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #e60000 0%, #ff3355 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Renew Subscription
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `
${appName} - Subscription Expiring Soon

Hi ${user.name || 'there'},

Your ${appName} ${subscription.planName || 'Pro'} subscription will expire in ${daysRemaining} days on ${expiryDateStr}.

Renew now to continue enjoying uninterrupted access to all premium features, courses, and content.

Visit: ${baseUrl}

© ${new Date().getFullYear()} ${appName}. All rights reserved.
    `.trim();

    const mailOptions = {
      from: `"${appName}" <${smtpFrom}>`,
      to: user.email,
      subject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[Email] Expiry reminder sent to ${user.email} (messageId: ${info.messageId})`);
    
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed to send expiry reminder:', error);
    return { sent: false, error: error.message };
  }
}

module.exports = {
  sendSubscriptionConfirmationEmail,
  sendSubscriptionExpiryReminderEmail,
};
