/* Local UI preview. Authentication is disabled; no production requests are made. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };

function createPreviewServer() {
  return http.createServer((req, res) => {
    let relative;
    try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'login.html'; }
    catch { res.writeHead(400); return res.end(); }
    const send = (type, body) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
    if (relative === 'js/supabase-config.js') return send('text/javascript', 'window.KagieAPI.configureSupabase({enabled:false});');
    if (relative === 'vendor/supabase.js') return send('text/javascript', fs.readFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js')));
    if (relative === 'api/runtime-config') return send('application/json', JSON.stringify({ data: { supabase: { enabled: false } } }));
    const file = path.resolve(root, relative);
    const allowed = /^(?:(?:css|js|images)\/[\w./-]+|[\w-]+\.html|manifest\.webmanifest)$/i.test(relative);
    if (!allowed || !file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).join('/') !== relative || !mime[path.extname(file)] || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Preview file unavailable.'); }
    let body = fs.readFileSync(file);
    if (path.extname(file) === '.html') body = body.toString().replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', '/vendor/supabase.js');
    send(mime[path.extname(file)], body);
  });
}
module.exports = { createPreviewServer };
if (require.main === module) {
  const server = createPreviewServer();
  server.listen(Number(process.env.KAGIE_LOGIN_PREVIEW_PORT || 0), '127.0.0.1', () => console.log(`Login UI preview: http://127.0.0.1:${server.address().port}/login.html (authentication disabled)`));
}
