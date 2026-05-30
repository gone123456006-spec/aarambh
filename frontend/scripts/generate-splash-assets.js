const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const iconPath = path.join(root, 'assets/images/aarambh-icon.png');
const logoOut = path.join(root, 'assets/images/ohms-logo-mark.png');
const adaptiveForegroundOut = path.join(root, 'assets/images/ohms-adaptive-foreground.png');
const appIconOut = path.join(root, 'assets/images/ohms-icon.png');
const splashOut = path.join(root, 'assets/images/ohms-splash-gradient.png');

const APP_ICON_RED = { r: 230, g: 0, b: 0 };
const ADAPTIVE_ICON_SIZE = 1024;
/** Android adaptive icon safe zone — keep logo within ~54% of canvas. */
const ADAPTIVE_LOGO_SCALE = 0.54;

async function extractWhiteLogo() {
  const { data, info } = await sharp(iconPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isWhite = r > 175 && g > 175 && b > 175;
    data[i + 3] = isWhite ? 255 : 0;
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(logoOut);

  console.log('Wrote', logoOut);
}

async function createAppIconAssets() {
  const trimmedBuf = await sharp(logoOut).trim({ threshold: 12 }).png().toBuffer();
  const meta = await sharp(trimmedBuf).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('Could not trim ohms-logo-mark.png');
  }

  const maxDim = Math.max(meta.width, meta.height);
  const target = Math.round(ADAPTIVE_ICON_SIZE * ADAPTIVE_LOGO_SCALE);
  const scale = target / maxDim;
  const resizedW = Math.round(meta.width * scale);
  const resizedH = Math.round(meta.height * scale);
  const left = Math.round((ADAPTIVE_ICON_SIZE - resizedW) / 2);
  const top = Math.round((ADAPTIVE_ICON_SIZE - resizedH) / 2);

  const logoPng = await sharp(trimmedBuf).resize(resizedW, resizedH).png().toBuffer();

  await sharp({
    create: {
      width: ADAPTIVE_ICON_SIZE,
      height: ADAPTIVE_ICON_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logoPng, left, top }])
    .png()
    .toFile(adaptiveForegroundOut);

  await sharp({
    create: {
      width: ADAPTIVE_ICON_SIZE,
      height: ADAPTIVE_ICON_SIZE,
      channels: 3,
      background: APP_ICON_RED,
    },
  })
    .composite([{ input: logoPng, left, top }])
    .png()
    .toFile(appIconOut);

  console.log('Wrote', adaptiveForegroundOut);
  console.log('Wrote', appIconOut);
}

async function createGradientSplash() {
  const width = 1284;
  const height = 2778;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5c0000"/>
          <stop offset="45%" stop-color="#c40000"/>
          <stop offset="100%" stop-color="#5c0000"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(splashOut);
  console.log('Wrote', splashOut);
}

(async () => {
  await extractWhiteLogo();
  await createAppIconAssets();
  await createGradientSplash();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
