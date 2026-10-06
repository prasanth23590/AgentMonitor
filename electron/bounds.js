// electron/bounds.js — pure helper deciding which saved window bounds are safe to reuse.

const DEFAULTS = { width: 1400, height: 900 }
const MIN_WIDTH = 900
const MIN_HEIGHT = 600
const MIN_VISIBLE = 100 // px of the window that must overlap some display

const finite = n => typeof n === 'number' && Number.isFinite(n)

// Smaller of the horizontal/vertical overlap (negative when the rects don't touch)
function overlap(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return Math.min(w, h)
}

function resolveBounds(saved, displays) {
  if (!saved || !finite(saved.width) || !finite(saved.height) || saved.width < MIN_WIDTH || saved.height < MIN_HEIGHT) {
    return { ...DEFAULTS }
  }
  const size = { width: saved.width, height: saved.height }
  if (!finite(saved.x) || !finite(saved.y)) return size
  const rect = { x: saved.x, y: saved.y, ...size }
  // A saved position on a monitor that has since been unplugged would strand the window off-screen.
  const visible = displays.some(d => overlap(rect, d.workArea) >= MIN_VISIBLE)
  return visible ? rect : size
}

module.exports = { resolveBounds, DEFAULTS, MIN_WIDTH, MIN_HEIGHT }
