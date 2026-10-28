import { contextBridge, ipcRenderer, webUtils } from 'electron'

// The only bridge between the sandboxed renderer and Node. Nothing else is exposed.
const api = {
  // API key storage (electron-store, main process)
  getApiKey: () => ipcRenderer.invoke('store:getApiKey'),
  setApiKey: (key) => ipcRenderer.invoke('store:setApiKey', key),
  clearApiKey: () => ipcRenderer.invoke('store:clearApiKey'),

  // Model preference + discovery
  getModel: () => ipcRenderer.invoke('store:getModel'),
  setModel: (model) => ipcRenderer.invoke('store:setModel', model),
  listModels: (apiKey) => ipcRenderer.invoke('ai:listModels', apiKey),

  // File handling
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  parseFile: (filePath) => ipcRenderer.invoke('file:parse', filePath),
  // Electron 29+ removed File.path; this is the supported way to resolve a dropped
  // file's absolute path from the renderer.
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // AI analysis
  analyze: (payload) => ipcRenderer.invoke('ai:analyze', payload),

  // Subscribe to backoff retry notifications. Returns an unsubscribe function.
  onAiRetry: (callback) => {
    const listener = (_event, info) => callback(info)
    ipcRenderer.on('ai:retry', listener)
    return () => ipcRenderer.removeListener('ai:retry', listener)
  },

  // Fired when a deprecated model was auto-swapped mid-analysis. Returns an unsubscribe fn.
  onModelSwitched: (callback) => {
    const listener = (_event, info) => callback(info)
    ipcRenderer.on('ai:modelSwitched', listener)
    return () => ipcRenderer.removeListener('ai:modelSwitched', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
