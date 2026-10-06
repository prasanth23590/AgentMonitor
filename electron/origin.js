// electron/origin.js — exact origin comparison. A prefix test (url.startsWith(origin)) is bypassable:
// "http://127.0.0.1:5000@evil.com/" and "http://127.0.0.1:50001/" both start with "http://127.0.0.1:5000".

function isSameOrigin(url, origin) {
  try { return new URL(url).origin === origin } catch { return false }
}

module.exports = { isSameOrigin }
