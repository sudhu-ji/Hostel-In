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
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

let server;

function startServer(callback) {
  server = http.createServer((req, res) => {
    let safePath = decodeURIComponent(req.url.split('?')[0]);
    if (safePath === '/') {
      safePath = '/index.html';
    }

    let filePath = path.join(__dirname, 'out', safePath);

    function serveFile(p) {
      fs.readFile(p, (err, data) => {
        if (err) {
          res.statusCode = 500;
          res.end(`Error loading file: ${err.code}`);
          return;
        }
        const ext = path.extname(p).toLowerCase();
        res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
        res.end(data);
      });
    }

    // Check if the requested file exists
    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        serveFile(filePath);
      } else {
        // If it's not a file (likely a Next.js route like /dashboard), check if appending .html matches a file
        const htmlPath = filePath + '.html';
        fs.stat(htmlPath, (err2, stats2) => {
          if (!err2 && stats2.isFile()) {
            serveFile(htmlPath);
          } else {
            // Fallback to 404
            const fallbackPath = path.join(__dirname, 'out', '404.html');
            fs.stat(fallbackPath, (err3, stats3) => {
              if (!err3 && stats3.isFile()) {
                serveFile(fallbackPath);
              } else {
                res.statusCode = 404;
                res.end('Not Found');
              }
            });
          }
        });
      }
    });
  });

  // Listen on a random available port (0) on localhost
  server.listen(0, '127.0.0.1', () => {
    callback(server.address().port);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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
