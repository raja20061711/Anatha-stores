import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1100,
    minHeight: 700,
    title: 'ANANTHA STORES — Supermarket Desktop POS',
    backgroundColor: '#F1F5F9',
    show: false, // Wait until ready-to-show to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Remove standard top menu bar for a clean, professional commercial POS feel
  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in dev mode if requested via env
    if (process.env.OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('get-system-info', () => ({
  platform: process.platform,
  arch: process.arch,
  version: app.getVersion(),
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron,
}));

ipcMain.handle('print-bill', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  try {
    const printOptions = {
      silent: options.silent || false,
      printBackground: true,
      deviceName: options.deviceName || '',
      margins: { marginType: 'none' },
    };
    if (options.receiptFormat === 'A4') {
      printOptions.pageSize = 'A4';
    }
    mainWindow.webContents.print(printOptions, (success, failureReason) => {
      if (!success && failureReason !== 'cancelled') {
        console.error('Print failed:', failureReason);
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-to-pdf', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  try {
    const defaultFilename = options.filename || 'anantha-stores-bill.pdf';
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Receipt as PDF — ANANTHA STORES',
      defaultPath: path.join(app.getPath('documents'), defaultFilename),
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const pdfOptions = {
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
    };
    if (options.receiptFormat === 'A4') {
      pdfOptions.pageSize = 'A4';
    }

    const pdfBuffer = await mainWindow.webContents.printToPDF(pdfOptions);

    await fs.promises.writeFile(filePath, pdfBuffer);
    return { success: true, filePath };
  } catch (err) {
    console.error('Save to PDF error:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
