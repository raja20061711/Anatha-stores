const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  appVersion: '1.0.0',
  isElectron: true,
  ping: () => ipcRenderer.invoke('ping'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  printBill: (options) => ipcRenderer.invoke('print-bill', options),
  saveToPdf: (options) => ipcRenderer.invoke('save-to-pdf', options),
});
