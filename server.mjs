import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ...['app.js', 'reconciliation.js'].map(f => [`/${f}`, [f, 'text/javascript']]),
  ['/style.css', ['style.css', 'text/css']],
  ...['input', 'expected', 'candidates'].map(f => [`/data/${f}.json`, [`data/${f}.json`, 'application/json']]),
]);
const server = createServer(async (req, res) => {
  const file = files.get(req.url);
  if (req.method !== 'GET' || !file) return void res.writeHead(404).end('Not found');
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    res.writeHead(200, {
      'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    }).end(body);
  } catch { res.writeHead(500).end('File unavailable'); }
});
server.listen(Number(process.env.PORT || 4205), '127.0.0.1', () => console.log('設備照合デモを起動しました'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
