// Render docs/og.jpg, the link-preview image, from the live globe via headless Chrome.
// Usage: npm run dev (in another shell), then `node scripts/og.mjs [url]`.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const URL_ = process.argv[2] || 'http://localhost:8080/';
const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'og.jpg');
const CHROME = process.env.CHROME || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'og-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--window-size=1200,630', 'about:blank',
], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    target = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).then((t) => t.find((x) => x.type === 'page')).catch(() => null);
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  // Let textures, data and the live layers arrive, then drop the UI chrome except the brand.
  await sleep(12000);
  await send('Runtime.evaluate', { expression: `document.head.insertAdjacentHTML('beforeend',
    '<style>.panel,.rail,.timeline,.modes,.disc-toast,#settings-btn,#keys-btn{display:none!important}.brand{top:40px;left:48px;padding:16px 22px}.logo{font-size:30px}.meta{font-size:16px}</style>');
    document.getElementById('meta').textContent = 'This week’s news from trusted outlets, on a live 3D globe';` });
  await sleep(1500);
  const { result } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  await fs.writeFile(OUT, Buffer.from(result.data, 'base64'));
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
  ws.close();
} finally {
  chrome.kill();
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
}
