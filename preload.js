const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktopApp', Object.freeze({
  name: 'Text Editor',
  version: process.env.npm_package_version || appVersion(),
  platform: process.platform,
  isDesktop: true
}))

function appVersion () {
  // Keep the preload bridge intentionally small; privileged filesystem APIs
  // will be introduced behind explicit, validated IPC contracts in Phase 3.
  return '0.2.0'
}
