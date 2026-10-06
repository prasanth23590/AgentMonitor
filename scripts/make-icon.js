// Generates assets/icon.ico (multi-size) from assets/icon.svg. Run: npm run icon
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const pngToIco = require('png-to-ico')

const SIZES = [16, 24, 32, 48, 64, 128, 256]
const svg = path.join(__dirname, '..', 'assets', 'icon.svg')
const out = path.join(__dirname, '..', 'assets', 'icon.ico')

;(async () => {
  const pngs = await Promise.all(
    SIZES.map(s => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()),
  )
  fs.writeFileSync(out, await pngToIco(pngs))
  console.log(`wrote ${out} (${SIZES.join(', ')} px)`)
})().catch(err => { console.error(err); process.exit(1) })
