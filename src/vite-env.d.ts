/// <reference types="vite/client" />

interface Window {
  /** Present only inside the Electron app (see electron/preload.js). */
  agentMonitor?: { quit: () => void }
}
