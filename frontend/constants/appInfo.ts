/** Update these values with your official support and web details before Play Store release. */
export const APP_INFO = {
  appName: "Ohm's",
  companyName: "Ohm's",
  productLine: 'English Learning',
  tagline: 'Practice English with confidence',
  version: '1.0.0',
  mobile: '6204111878',
  whatsapp: '6204111878',
  email: 'support@ohmsapp.com',
};

/** Sidebar / about — e.g. Ohm's : English Learning v1.0.0 */
export function appVersionLabel(): string {
  return `${APP_INFO.appName} : ${APP_INFO.productLine} v${APP_INFO.version}`;
}

/** Digits only (no spaces). */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** India mobile → tel:+91… */
export function phoneTelUri(phone: string = APP_INFO.mobile): string {
  const d = phoneDigits(phone);
  if (d.length === 10) return `tel:+91${d}`;
  if (d.startsWith('91') && d.length === 12) return `tel:+${d}`;
  return `tel:+${d}`;
}

/** WhatsApp wa.me link (India +91). */
export function whatsappUri(phone: string = APP_INFO.whatsapp): string {
  const d = phoneDigits(phone);
  const full = d.length === 10 ? `91${d}` : d.startsWith('91') ? d : `91${d}`;
  return `https://wa.me/${full}`;
}
