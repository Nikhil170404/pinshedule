// Template-based pin images drawn on a canvas in the browser. No AI and no server: the text is whatever the
// user types, laid out at Pinterest's recommended 2:3 size (1000 x 1500).

export const PIN_W = 1000
export const PIN_H = 1500

const FONT = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif'

export interface Palette { id: string; name: string; bg: string; fg: string; accent: string; card: string; cardFg: string }

export const PALETTES: Palette[] = [
  { id: 'brand', name: 'Red', bg: '#e60023', fg: '#ffffff', accent: '#ffe3e8', card: '#ffffff', cardFg: '#1c1917' },
  { id: 'ink', name: 'Ink', bg: '#1c1917', fg: '#fafaf9', accent: '#ff5a73', card: '#fafaf9', cardFg: '#1c1917' },
  { id: 'sage', name: 'Sage', bg: '#cfe5da', fg: '#173d2e', accent: '#2f7d5b', card: '#ffffff', cardFg: '#173d2e' },
  { id: 'sand', name: 'Sand', bg: '#f6e7d3', fg: '#4a2f1b', accent: '#c7662b', card: '#ffffff', cardFg: '#4a2f1b' },
  { id: 'sky', name: 'Sky', bg: '#a9dcf0', fg: '#0e3a52', accent: '#1d7fb0', card: '#ffffff', cardFg: '#0e3a52' },
  { id: 'plum', name: 'Plum', bg: '#4b2a5b', fg: '#fdf3ff', accent: '#f4a3d4', card: '#fdf3ff', cardFg: '#4b2a5b' },
]

export type TemplateId = 'headline' | 'card' | 'split' | 'number'

export const TEMPLATES: { id: TemplateId; name: string; hint: string; usesPhoto: boolean }[] = [
  { id: 'headline', name: 'Bold headline', hint: 'Big text on a solid color', usesPhoto: false },
  { id: 'card', name: 'Photo card', hint: 'Full photo with a title card', usesPhoto: true },
  { id: 'split', name: 'Photo + panel', hint: 'Photo on top, text below', usesPhoto: true },
  { id: 'number', name: 'Big number', hint: 'For lists like "7 ideas"', usesPhoto: false },
]

export interface DesignInput {
  template: TemplateId
  palette: Palette
  headline: string
  kicker: string
  number: string
  brand: string
  photo: HTMLImageElement | null
}

export const PLACEHOLDER_HEADLINE = 'Your headline goes here'

type Ctx = CanvasRenderingContext2D

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.arcTo(x + w, y, x + w, y + tr, tr)
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
  ctx.arcTo(x, y + h, x, y + h - bl, bl)
  ctx.arcTo(x, y, x + tl, y, tl)
  ctx.closePath()
}

/** Greedy word wrap. A single word wider than the line is broken by character so nothing overflows. */
function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxW) { line = test; continue }
    if (line) lines.push(line)
    if (ctx.measureText(word).width <= maxW) { line = word; continue }
    let chunk = ''
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxW && chunk) { lines.push(chunk); chunk = ch } else chunk += ch
    }
    line = chunk
  }
  if (line) lines.push(line)
  return lines
}

interface Fitted { lines: string[]; size: number; lineHeight: number }

/** Largest font size (stepping down) at which the wrapped text fits the box; ellipsis only as a last resort. */
function fitText(ctx: Ctx, text: string, maxW: number, maxH: number, maxSize: number, minSize: number, weight = 800, lh = 1.1): Fitted {
  for (let size = maxSize; size >= minSize; size -= 4) {
    ctx.font = `${weight} ${size}px ${FONT}`
    const lines = wrap(ctx, text, maxW)
    if (lines.length * size * lh <= maxH) return { lines, size, lineHeight: lh }
  }
  ctx.font = `${weight} ${minSize}px ${FONT}`
  const all = wrap(ctx, text, maxW)
  const maxLines = Math.max(1, Math.floor(maxH / (minSize * lh)))
  const lines = all.slice(0, maxLines)
  if (all.length > maxLines) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, '')}…`
  return { lines, size: minSize, lineHeight: lh }
}

function drawLines(ctx: Ctx, f: Fitted, x: number, top: number, color: string, align: CanvasTextAlign = 'left', weight = 800) {
  ctx.font = `${weight} ${f.size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  f.lines.forEach((l, i) => ctx.fillText(l, x, top + f.size * 0.86 + i * f.size * f.lineHeight))
  return f.lines.length * f.size * f.lineHeight
}

function drawKicker(ctx: Ctx, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  if (!text) return 0
  ctx.font = `700 34px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ;(ctx as Ctx & { letterSpacing?: string }).letterSpacing = '6px'
  ctx.fillText(text.toUpperCase(), x, y + 30)
  ;(ctx as Ctx & { letterSpacing?: string }).letterSpacing = '0px'
  return 60
}

function drawBrand(ctx: Ctx, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  if (!text) return
  ctx.font = `600 34px ${FONT}`
  ctx.fillStyle = color
  ctx.globalAlpha = 0.85
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, x, y)
  ctx.globalAlpha = 1
}

function drawCover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

/** Soft background shapes used when there is no photo. */
function drawShapes(ctx: Ctx, accent: string) {
  ctx.save()
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.18
  ctx.beginPath(); ctx.arc(PIN_W - 80, 140, 330, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.12
  ctx.beginPath(); ctx.arc(80, PIN_H - 120, 400, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

const PAD = 90

function headlineLayout(ctx: Ctx, d: DesignInput, text: string) {
  const { palette: p } = d
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, PIN_W, PIN_H)
  drawShapes(ctx, p.accent)
  const kick = drawKicker(ctx, d.kicker, PAD, 130, p.accent)
  const f = fitText(ctx, text, PIN_W - PAD * 2, 800, 150, 56)
  const h = f.lines.length * f.size * f.lineHeight
  const top = 300 + (800 - h) / 2 + (kick ? 0 : 0)
  drawLines(ctx, f, PAD, top, p.fg)
  ctx.fillStyle = p.accent
  roundRect(ctx, PAD, top + h + 40, 140, 12, 6); ctx.fill()
  drawBrand(ctx, d.brand, PAD, PIN_H - 90, p.fg)
}

function cardLayout(ctx: Ctx, d: DesignInput, text: string) {
  const { palette: p } = d
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, PIN_W, PIN_H)
  if (d.photo) {
    drawCover(ctx, d.photo, 0, 0, PIN_W, PIN_H)
    const g = ctx.createLinearGradient(0, PIN_H * 0.5, 0, PIN_H)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, PIN_W, PIN_H)
  } else {
    drawShapes(ctx, p.accent)
  }
  const cardW = PIN_W - 120
  const f = fitText(ctx, text, cardW - 100, 380, 96, 48)
  const textH = f.lines.length * f.size * f.lineHeight
  const kickH = d.kicker ? 60 : 0
  const cardH = 56 + kickH + textH + 56
  const cardY = PIN_H - 70 - cardH
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 12
  ctx.fillStyle = p.card
  roundRect(ctx, 60, cardY, cardW, cardH, 36); ctx.fill()
  ctx.restore()
  const k = drawKicker(ctx, d.kicker, 110, cardY + 50, p.accent === p.bg ? p.cardFg : accentOnCard(p))
  drawLines(ctx, f, 110, cardY + 56 + k, p.cardFg)
  if (d.brand) {
    ctx.font = `600 34px ${FONT}` // must match drawBrand, or the pill clips the text
    const w = ctx.measureText(d.brand).width + 56
    ctx.fillStyle = p.card
    roundRect(ctx, 60, 60, w, 66, 33); ctx.fill()
    drawBrand(ctx, d.brand, 88, 104, p.cardFg)
  }
}

/** Accent colors that are pale on a dark palette would vanish on the white card, so use the card text color. */
function accentOnCard(p: Palette) {
  return p.id === 'brand' ? p.bg : p.id === 'ink' || p.id === 'plum' ? p.cardFg : p.accent
}

function splitLayout(ctx: Ctx, d: DesignInput, text: string) {
  const { palette: p } = d
  const panelY = 880
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, PIN_W, PIN_H)
  if (d.photo) drawCover(ctx, d.photo, 0, 0, PIN_W, panelY + 80)
  else {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PIN_W, panelY + 80); ctx.clip(); drawShapes(ctx, p.accent); ctx.restore()
  }
  ctx.fillStyle = p.bg
  roundRect(ctx, 0, panelY, PIN_W, PIN_H - panelY, [64, 64, 0, 0]); ctx.fill()
  const k = drawKicker(ctx, d.kicker, PAD, panelY + 60, p.accent)
  const f = fitText(ctx, text, PIN_W - PAD * 2, PIN_H - panelY - 60 - k - 130, 110, 48)
  drawLines(ctx, f, PAD, panelY + 60 + k, p.fg)
  drawBrand(ctx, d.brand, PAD, PIN_H - 56, p.fg)
}

function numberLayout(ctx: Ctx, d: DesignInput, text: string) {
  const { palette: p } = d
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, PIN_W, PIN_H)
  drawShapes(ctx, p.accent)
  const num = d.number.trim().slice(0, 3)
  ctx.font = `900 ${num.length > 2 ? 420 : num.length > 1 ? 520 : 640}px ${FONT}`
  ctx.fillStyle = p.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(num, PAD - 10, 640)
  const k = drawKicker(ctx, d.kicker, PAD, 700, p.fg)
  const f = fitText(ctx, text, PIN_W - PAD * 2, 520 - k, 110, 52)
  drawLines(ctx, f, PAD, 720 + k, p.fg)
  drawBrand(ctx, d.brand, PAD, PIN_H - 90, p.fg)
}

/** Draw the design onto `canvas` (resized to 1000 x 1500). */
export function renderPin(canvas: HTMLCanvasElement, d: DesignInput) {
  canvas.width = PIN_W
  canvas.height = PIN_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const text = d.headline.trim() || PLACEHOLDER_HEADLINE
  const template: TemplateId = d.template === 'number' && !d.number.trim() ? 'headline' : d.template
  if (template === 'card') cardLayout(ctx, d, text)
  else if (template === 'split') splitLayout(ctx, d, text)
  else if (template === 'number') numberLayout(ctx, d, text)
  else headlineLayout(ctx, d, text)
}

/** JPEG when a photo is used (much smaller), PNG for flat designs. */
export function canvasToFile(canvas: HTMLCanvasElement, hasPhoto: boolean): Promise<File> {
  const type = hasPhoto ? 'image/jpeg' : 'image/png'
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not create the image. Try a smaller photo.'))
      resolve(new File([blob], `pin-design.${hasPhoto ? 'jpg' : 'png'}`, { type }))
    }, type, 0.92)
  })
}

export function loadPhoto(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')) }
    img.src = url
  })
}

// ─── Automatic design ────────────────────────────────────────────────────────

/** "Best pasta recipes | My Blog" -> "Best pasta recipes": drops a trailing site name and keeps the headline short. */
export function tidyHeadline(title: string, max = 90): string {
  const parts = title.split(/\s+[|\u2013\u2014\u00b7]\s+|\s+-\s+/)
  const first = (parts.length > 1 && parts[0].trim().length >= 12 ? parts[0] : title).trim()
  if (first.length <= max) return first
  const cut = first.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trim()}\u2026`
}

export type AutoLayout = 'card' | 'split' | 'mixed'

/** The layout for the i-th pin of a batch: a fixed one, or alternating so a feed does not look repetitive. */
export const layoutFor = (i: number, mode: AutoLayout): TemplateId => (mode === 'mixed' ? (i % 2 === 0 ? 'card' : 'split') : mode)

/** Draw a finished pin from a photo and a headline without showing anything on screen. */
export async function designPinFile(input: Omit<DesignInput, 'photo'> & { photo: HTMLImageElement }): Promise<File> {
  const canvas = document.createElement('canvas')
  renderPin(canvas, input)
  return canvasToFile(canvas, true)
}

/** Load a photo that has been fetched as a Blob (so the canvas stays untainted). */
export const photoFromBlob = (blob: Blob) => loadPhoto(new File([blob], 'photo', { type: blob.type || 'image/jpeg' }))
