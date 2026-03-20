const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;
let nextServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS native window controls
    trafficLightPosition: { x: -100, y: -100 }, // Hide default position, we'll render custom
    transparent: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Ensure links (e.g. `<a target="_blank">`) open in the system browser.
  // Electron would otherwise create a new BrowserWindow for "new-window" requests.
  const appOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  // Firebase OAuth popup needs to be allowed to complete *inside* Electron.
  // Otherwise, `signInWithPopup` breaks because the flow expects the popup window to
  // finish authentication and close, not a system browser.
  const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN; // e.g. localchat-5f3b2.firebaseapp.com
  const authInternalHosts = new Set([
    'accounts.google.com',
    // Common Google OAuth / token endpoints that may be reached during popup redirects.
    'oauth2.googleapis.com',
    'securetoken.googleapis.com',
    'identitytoolkit.googleapis.com',
    'www.googleapis.com',
    'apis.google.com',
  ]);
  if (firebaseAuthDomain) authInternalHosts.add(firebaseAuthDomain);

  const shouldOpenExternal = (url) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      // Avoid breaking internal popup/webview lifecycles with special schemes.
      if (parsed.protocol === 'about:' || parsed.protocol === 'blob:' || parsed.protocol === 'data:') {
        return false;
      }

      const origin = `${parsed.protocol}//${parsed.host}`;

      // Allow navigating our app.
      if (appOrigins.has(origin)) return false;

      // Allow Firebase/Google OAuth popups to finish internally.
      if (authInternalHosts.has(parsed.hostname)) return false;

      // Everything else (including `target="_blank"` sources) opens externally.
      return true;
    } catch {
      // If URL parsing fails, err on the side of external for safety.
      return true;
    }
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternal(url)) shell.openExternal(url);
    return { action: shouldOpenExternal(url) ? 'deny' : 'allow' };
  });

  mainWindow.webContents.on('new-window', (event, url) => {
    if (shouldOpenExternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow app-internal navigations to our Next.js server; open everything else externally.
    if (!shouldOpenExternal(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  // Load the app
  if (isDev) {
    // Wait for Next.js dev server
    const checkServer = () => {
      mainWindow.loadURL('http://localhost:3000').catch(() => {
        setTimeout(checkServer, 1000);
      });
    };
    checkServer();
    
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Load from the built Next.js app
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Send window state changes to renderer
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: false });
  });
}

// IPC handlers for window controls
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

app.whenReady().then(() => {
  if (isDev) {
    // Start Next.js dev server
    nextServer = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      stdio: 'inherit',
    });
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill();
  }
});
