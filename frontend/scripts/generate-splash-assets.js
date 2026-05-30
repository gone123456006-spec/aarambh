const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const iconPath = path.join(root, 'assets/images/aarambh-icon.png');
const logoOut = path.join(root, 'assets/images/ohms-logo-mark.png');
const splashOut = path.join(root, 'assets/images/ohms-splash-gradient.png');

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
  await createGradientSplash();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
