/**
 * Ensures bundled Icons8 3D Fluency PNGs exist under assets/images/icons3d/.
 * Skips download when files are already present (offline-safe after first run).
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const ICONS = {
  'trophy.png': 'https://img.icons8.com/3d-fluency/94/trophy.png',
  'combo-chart.png': 'https://img.icons8.com/3d-fluency/94/combo-chart.png',
  'speech-bubble.png': 'https://img.icons8.com/3d-fluency/94/speech-bubble.png',
  'phone.png': 'https://img.icons8.com/3d-fluency/94/phone.png',
  'conference-call.png': 'https://img.icons8.com/3d-fluency/94/conference-call.png',
  'crown.png': 'https://img.icons8.com/3d-fluency/94/crown.png',
  'help.png': 'https://img.icons8.com/3d-fluency/94/help.png',
  'puzzle.png': 'https://img.icons8.com/3d-fluency/94/puzzle.png',
  'pencil.png': 'https://img.icons8.com/3d-fluency/94/pencil.png',
  'cards.png': 'https://img.icons8.com/3d-fluency/94/cards.png',
  'seedling.png': 'https://img.icons8.com/3d-fluency/94/sprout.png',
  'graduation-cap.png': 'https://img.icons8.com/3d-fluency/94/graduation-cap.png',
  'medal2.png': 'https://img.icons8.com/3d-fluency/94/medal.png',
  'pdf.png': 'https://img.icons8.com/3d-fluency/94/pdf.png',
};

const OUT_DIR = path.join(__dirname, '..', 'assets', 'images', 'icons3d');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const next = res.headers.location;
          if (!next) {
            reject(new Error(`Redirect without location: ${url}`));
            return;
          }
          download(next, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [name, url] of Object.entries(ICONS)) {
    const dest = path.join(OUT_DIR, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      continue;
    }
    await download(url, dest);
    console.log(`[sync-icons3d] downloaded ${name}`);
  }
}

main().catch((err) => {
  console.error('[sync-icons3d] failed:', err.message);
  process.exit(1);
});
