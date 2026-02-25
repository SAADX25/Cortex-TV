const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173')
      .then(() => {
        // Open devtools for debugging renderer errors
        win.webContents.openDevTools({ mode: 'undocked' });
      })
      .catch(err => console.error('Failed to load URL:', err));
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html')).catch(err => console.error('Failed to load file:', err));
  }
}

function waitForServer(url, timeout = 20000, interval = 300) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const now = Date.now();
      if (now - start > timeout) return reject(new Error('Timeout waiting for dev server'));

      const req = http.request(url, { method: 'HEAD' }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) return resolve();
        setTimeout(check, interval);
      });
      req.on('error', () => setTimeout(check, interval));
      req.end();
    };

    check();
  });
}

app.whenReady().then(async () => {
  try {
    if (isDev) {
        // Wait for Vite dev server to be ready before creating the window
        await waitForServer('http://localhost:5173');
    }
    createWindow();
  } catch (err) {
    console.error('Error during app startup:', err);
    // Still attempt to create a window to show the error
    try { createWindow(); } catch (e) { console.error(e); }
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in main process:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
