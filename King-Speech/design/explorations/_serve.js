const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/reading.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8799, () => console.log('serving on 8799'));
