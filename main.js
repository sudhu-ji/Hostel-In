const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

let server;

function startServer(callback) {
  server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/' || urlPath === '') {
        urlPath = '/index.html';
      }

      const outDir = path.join(__dirname, 'out');

      function sendFile(filePath, statusCode = 200) {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.statusCode = 500;
            res.end(`Error reading file: ${err.message}`);
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.statusCode = statusCode;
          res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(data);
        });
      }

      const cleanRel = urlPath.replace(/^\/+/, '');
      const directPath = path.join(outDir, cleanRel);
      
      // 1. Direct file match in out/
      if (fs.existsSync(directPath)) {
        const stat = fs.statSync(directPath);
        if (stat.isFile()) {
          return sendFile(directPath);
        }
        if (stat.isDirectory()) {
          const indexHtml = path.join(directPath, 'index.html');
          if (fs.existsSync(indexHtml)) {
            return sendFile(indexHtml);
          }
        }
      }

      // 2. Directory index.html match (e.g. /dashboard -> out/dashboard/index.html)
      const routeIndex = path.join(outDir, cleanRel, 'index.html');
      if (fs.existsSync(routeIndex)) {
        return sendFile(routeIndex);
      }

      // 3. Direct .html file (e.g. /dashboard -> out/dashboard.html)
      const directHtml = directPath + '.html';
      if (fs.existsSync(directHtml)) {
        return sendFile(directHtml);
      }

      // 4. Client-side SPA navigation fallback
      const ext = path.extname(urlPath);
      if (!ext || ext === '.html') {
        const rootIndex = path.join(outDir, 'index.html');
        if (fs.existsSync(rootIndex)) {
          return sendFile(rootIndex, 200);
        }
      }

      // 5. 404 fallback for missing assets
      const notFoundPage = path.join(outDir, '404.html');
      if (fs.existsSync(notFoundPage)) {
        return sendFile(notFoundPage, 404);
      }

      res.statusCode = 404;
      res.end('Not Found');
    } catch (err) {
      res.statusCode = 500;
      res.end(`Internal Server Error: ${err.message}`);
    }
  });

  server.listen(0, '127.0.0.1', () => {
    callback(server.address().port);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  startServer((port) => {
    win.loadURL(`http://127.0.0.1:${port}`);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
