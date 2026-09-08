const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
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
  '.webp': 'image/webp'
};

let server;

function startServer(callback) {
  server = http.createServer((req, res) => {
    let rawPath = decodeURIComponent(req.url.split('?')[0]);
    if (rawPath === '/' || rawPath === '') {
      rawPath = '/index.html';
    }

    const outDir = path.join(__dirname, 'out');

    function serveFile(p, statusCode = 200) {
      fs.readFile(p, (err, data) => {
        if (err) {
          res.statusCode = 500;
          res.end(`Error loading file: ${err.code}`);
          return;
        }
        const ext = path.extname(p).toLowerCase();
        res.statusCode = statusCode;
        res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
        res.end(data);
      });
    }

    function tryServe() {
      // 1. Direct path in outDir
      let targetPath = path.join(outDir, rawPath);
      
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.isFile()) {
          return serveFile(targetPath);
        }
        if (stat.isDirectory()) {
          const indexInDir = path.join(targetPath, 'index.html');
          if (fs.existsSync(indexInDir) && fs.statSync(indexInDir).isFile()) {
            return serveFile(indexInDir);
          }
        }
      }

      // 2. Try adding /index.html (e.g. /dashboard -> /dashboard/index.html)
      const dirIndexPath = path.join(outDir, rawPath, 'index.html');
      if (fs.existsSync(dirIndexPath) && fs.statSync(dirIndexPath).isFile()) {
        return serveFile(dirIndexPath);
      }

      // 3. Try adding .html (e.g. /dashboard -> /dashboard.html)
      const htmlPath = targetPath + '.html';
      if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
        return serveFile(htmlPath);
      }

      // 4. Fallback to 404.html or index.html
      const fallback404 = path.join(outDir, '404.html');
      if (fs.existsSync(fallback404) && fs.statSync(fallback404).isFile()) {
        return serveFile(fallback404, 404);
      }

      const fallbackIndex = path.join(outDir, 'index.html');
      if (fs.existsSync(fallbackIndex) && fs.statSync(fallbackIndex).isFile()) {
        return serveFile(fallbackIndex, 200);
      }

      res.statusCode = 404;
      res.end('Not Found');
    }

    try {
      tryServe();
    } catch (e) {
      res.statusCode = 500;
      res.end('Internal Server Error');
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
