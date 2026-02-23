/**
 * DAAN-FERN Desktop — Electron Preload Script
 *
 * Exposes a safe bridge between the Electron shell and the React frontend.
 * The frontend can check `window.daanDesktop` to detect Desktop Mode
 * and get the backend port.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("daanDesktop", {
    // Flag so the React app knows it's running inside Electron
    isDesktop: true,

    // Platform info
    platform: process.platform,

    // App version (from package.json)
    version: require("./package.json").version,
});
