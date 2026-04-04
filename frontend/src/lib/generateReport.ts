import jsPDF from 'jspdf'
import type { AnalysisResult } from './api'

// ── Palette ───────────────────────────────────────────────────
const C = {
  pageBg:   [12, 14, 28]  as [number,number,number],
  surface:  [20, 23, 46]  as [number,number,number],
  surface2: [26, 30, 56]  as [number,number,number],
  border:   [44, 50, 90]  as [number,number,number],
  accent:   [99, 102, 241] as [number,number,number],
  accentLo: [55, 58, 140] as [number,number,number],
  white:    [245, 246, 252] as [number,number,number],
  muted:    [140, 145, 185] as [number,number,number],
  dim:      [72, 78, 120]  as [number,number,number],
  success:  [34, 197, 94]  as [number,number,number],
  negative: [239, 68, 68]  as [number,number,number],
  hdrBg:    [16, 18, 40]  as [number,number,number],
  // chip fill colours (pre-baked, no opacity tricks)
  chipIndigo:  [30, 32, 80]  as [number,number,number],
  chipGreen:   [14, 50, 28]  as [number,number,number],
  chipAmber:   [55, 42, 8]   as [number,number,number],
  chipViolet:  [38, 22, 72]  as [number,number,number],
  chipBlue:    [16, 36, 72]  as [number,number,number],
  chipSlate:   [28, 32, 52]  as [number,number,number],
  chipEmerald: [12, 48, 36]  as [number,number,number],
}

const PW = 210
const PH = 297
const ML = 15
const MR = 15
const CW = PW - ML - MR   // 180 mm
const FH = 13              // footer height

// ── Sentiment helpers ─────────────────────────────────────────
function sentColor(l: string): [number,number,number] {
  if (l === 'positive') return C.success
  if (l === 'negative') return C.negative
  return C.muted
}
function sentBg(l: string): [number,number,number] {
  if (l === 'positive') return [16, 52, 28]
  if (l === 'negative') return [52, 16, 16]
  return [26, 28, 52]
}

// ── Chip colour map ───────────────────────────────────────────
const CHIP_COLORS: Record<string, { fill: [number,number,number]; border: [number,number,number] }> = {
  'Persons / Names':  { fill: C.chipIndigo,  border: [99, 102, 241] },
  'Organizations':    { fill: C.chipIndigo,  border: [129, 140, 248] },
  'Locations':        { fill: C.chipEmerald, border: [52, 211, 153] },
  'Dates':            { fill: C.chipAmber,   border: [251, 191, 36] },
  'Monetary Amounts': { fill: C.chipGreen,   border: [34, 197, 94] },
  'Skills':           { fill: C.chipViolet,  border: [167, 139, 250] },
  'Projects':         { fill: C.chipViolet,  border: [139, 92, 246] },
  'Emails':           { fill: C.chipBlue,    border: [96, 165, 250] },
  'Phone Numbers':    { fill: C.chipBlue,    border: [96, 165, 250] },
  'URLs':             { fill: C.chipSlate,   border: [148, 163, 184] },
  'Invoice Numbers':  { fill: C.chipAmber,   border: [251, 191, 36] },
}

export function generatePDFReport(result: AnalysisResult, fileName: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  let y = 0

  // ── Page primitives ───────────────────────────────────────

  function bg() {
    doc.setFillColor(...C.pageBg)
    doc.rect(0, 0, PW, PH, 'F')
  }

  function footer() {
    const n = doc.getNumberOfPages()
    doc.setFillColor(...C.hdrBg)
    doc.rect(0, PH - FH, PW, FH, 'F')
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.2)
    doc.line(ML, PH - FH, PW - MR, PH - FH)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.dim)
    doc.text('Doclyze  ·  AI Document Intelligence', ML, PH - 4.5)
    doc.setTextColor(...C.muted)
    doc.text(`Page ${n}`, PW - MR, PH - 4.5, { align: 'right' })
  }

  function newPage() {
    doc.addPage(); y = 0; bg(); footer()
  }

  function safe(need: number) {
    if (y + need > PH - FH - 6) newPage()
  }

  // ── Drawing helpers ───────────────────────────────────────

  function card(cy: number, ch: number, bg2: [number,number,number] = C.surface) {
    doc.setFillColor(...bg2)
    doc.roundedRect(ML, cy, CW, ch, 3, 3, 'F')
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.18)
    doc.roundedRect(ML, cy, CW, ch, 3, 3, 'S')
  }

  function pill(py: number, ph: number) {
    doc.setFillColor(...C.accent)
    doc.roundedRect(ML, py, 3, ph, 1.5, 1.5, 'F')
  }

  function secTitle(title: string, ty: number) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.muted)
    doc.text(title.toUpperCase(), ML + 8, ty)
    const tw = doc.getTextWidth(title.toUpperCase())
    doc.setDrawColor(...C.accentLo)
    doc.setLineWidth(0.22)
    doc.line(ML + 8, ty + 1.3, ML + 8 + tw, ty + 1.3)
  }

  // ── Chip ─────────────────────────────────────────────────

  function chip(
    text: string, cx: number, cy: number,
    fill: [number,number,number], border: [number,number,number]
  ): number {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    const tw = doc.getTextWidth(text) + 7
    const th = 5.8
    doc.setFillColor(...fill)
    doc.roundedRect(cx, cy - 4, tw, th, 1.5, 1.5, 'F')
    doc.setDrawColor(...border)
    doc.setLineWidth(0.18)
    doc.roundedRect(cx, cy - 4, tw, th, 1.5, 1.5, 'S')
    doc.setTextColor(...border)
    doc.text(text, cx + 3.5, cy)
    return tw + 2.5
  }

  // ── Entity category ───────────────────────────────────────

  function entityCat(label: string, items: string[], startY: number): number {
    if (!items.length) return startY
    const cc = CHIP_COLORS[label] || { fill: C.chipIndigo, border: C.accent }

    // Category label row
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.muted)
    doc.text(label, ML + 8, startY)
    // Hairline to right
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.12)
    const lx = ML + 8 + doc.getTextWidth(label) + 3
    doc.line(lx, startY - 1, ML + CW - 4, startY - 1)

    let tx = ML + 8
    let ly = startY + 5.5
    const maxX = ML + CW - 4

    for (const item of items.slice(0, 20)) {
      const tw = doc.getTextWidth(item) + 9.5
      if (tx + tw > maxX) {
        tx = ML + 8; ly += 8; safe(9)
      }
      chip(item, tx, ly, cc.fill, cc.border)
      tx += tw
    }
    return ly + 10
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  bg(); footer()

  // ── HEADER ───────────────────────────────────────────────
  const HDR = 54
  doc.setFillColor(...C.hdrBg)
  doc.rect(0, 0, PW, HDR, 'F')
  // Accent stripe
  doc.setFillColor(...C.accent)
  doc.rect(0, 0, 4, HDR, 'F')
  // Bottom rule
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.25)
  doc.line(0, HDR, PW, HDR)

  // Wordmark
  doc.setFontSize(21)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('Doclyze', 12, 19)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text('AI Document Intelligence', 12, 26.5)

  // Divider
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.2)
  doc.line(76, 8, 76, HDR - 8)

  // Report title
  doc.setFontSize(13.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('Document Analysis Report', PW - MR, 16, { align: 'right' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text(`${dateStr}  ·  ${timeStr}`, PW - MR, 23.5, { align: 'right' })

  // File row
  const MY = 38
  doc.setFontSize(8)
  doc.setTextColor(...C.dim)
  doc.text('File', 12, MY)
  doc.setTextColor(...C.white)
  doc.text((fileName || result.fileName || 'Unknown').substring(0, 52), 12 + doc.getTextWidth('File') + 3, MY)

  // Doc-type badge
  const dt = (result.document_type || 'general').toUpperCase()
  const bw = doc.getTextWidth(dt) + 8
  const bx = PW - MR - bw
  doc.setFillColor(...C.accentLo)
  doc.roundedRect(bx, MY - 4.5, bw, 6.5, 1.5, 1.5, 'F')
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.18)
  doc.roundedRect(bx, MY - 4.5, bw, 6.5, 1.5, 1.5, 'S')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.accent)
  doc.text(dt, bx + 4, MY)

  y = HDR + 10

  // ── PROCESSING INSIGHTS ───────────────────────────────────
  const ins: Array<[string, string]> = []
  if (result.fileSize > 0) ins.push(['File Size', (result.fileSize / 1024).toFixed(1) + ' KB'])
  if (result.metadata?.processing_time_ms > 0) ins.push(['Processing Time', (result.metadata.processing_time_ms / 1000).toFixed(1) + ' s'])
  ins.push(['OCR Engine', result.metadata?.ocr_used
    ? (result.metadata.ocr_engine === 'vision' ? 'Google Vision' : result.metadata.ocr_engine || 'OCR')
    : 'Not Used'])
  if (result.confidence > 0) ins.push(['Confidence', Math.round(result.confidence * 100) + '%'])

  // 4-cell grid: 2 rows × 2 cols
  const IH = 38
  safe(IH)
  card(y, IH)
  pill(y + 4, IH - 8)
  secTitle('Processing Insights', y + 8.5)

  const colW2 = (CW - 16) / 2
  ins.forEach(([k, v], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const ix = ML + 8 + col * (colW2 + 4)
    const iy = y + 16 + row * 12
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.dim)
    doc.text(k, ix, iy)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.white)
    doc.text(v, ix, iy + 6)
  })
  y += IH + 7

  // ── SENTIMENT + CONFIDENCE ────────────────────────────────
  const sl = (typeof result.sentiment === 'string'
    ? result.sentiment
    : (result.sentiment as any)?.label || 'Neutral').toLowerCase()
  const sc = typeof result.sentiment === 'object' && (result.sentiment as any)?.confidence
    ? Math.round((result.sentiment as any).confidence * 100) + '%'
    : result.confidence > 0 ? Math.round(result.confidence * 100) + '%' : '—'

  const SH = 30
  safe(SH)

  // Sentiment card (58%)
  const sw = CW * 0.58
  doc.setFillColor(...sentBg(sl))
  doc.roundedRect(ML, y, sw, SH, 3, 3, 'F')
  doc.setDrawColor(...sentColor(sl))
  doc.setLineWidth(0.2)
  doc.roundedRect(ML, y, sw, SH, 3, 3, 'S')
  doc.setFillColor(...sentColor(sl))
  doc.roundedRect(ML, y, 3, SH, 1.5, 1.5, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.muted)
  doc.text('SENTIMENT', ML + 8, y + 9)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...sentColor(sl))
  doc.text(sl.charAt(0).toUpperCase() + sl.slice(1), ML + 8, y + 23)

  // Confidence card (39%)
  const cx2 = ML + sw + 4
  const cw2 = CW - sw - 4
  doc.setFillColor(...C.surface2)
  doc.roundedRect(cx2, y, cw2, SH, 3, 3, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.18)
  doc.roundedRect(cx2, y, cw2, SH, 3, 3, 'S')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.muted)
  doc.text('CONFIDENCE', cx2 + 6, y + 9)
  doc.setFontSize(19)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.accent)
  doc.text(sc, cx2 + 6, y + 24)

  y += SH + 8

  // ── SUMMARY (HERO SECTION) ────────────────────────────────
  if (result.summary && result.summary.length > 10) {
    const lines = doc.splitTextToSize(result.summary, CW - 18)
    const LH = 6
    const SUM_H = 22 + lines.length * LH
    safe(Math.min(SUM_H, 70))

    // Hero card — slightly brighter background + accent top border
    doc.setFillColor(...C.surface2)
    doc.roundedRect(ML, y, CW, SUM_H, 3, 3, 'F')
    // Accent top border (full width)
    doc.setFillColor(...C.accent)
    doc.roundedRect(ML, y, CW, 2.5, 1.5, 1.5, 'F')
    // Side border
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.18)
    doc.roundedRect(ML, y, CW, SUM_H, 3, 3, 'S')

    // Title — larger than other sections
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text('AI GENERATED SUMMARY', ML + 8, y + 10)

    // Summary text — comfortable, readable
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(225, 228, 248)
    doc.text(lines, ML + 8, y + 18, { lineHeightFactor: 1.55 })

    y += SUM_H + 9
  }

  // ── EXTRACTED ENTITIES ────────────────────────────────────
  const ent = result.entities || {}
  const cats: Array<[string, string[]]> = ([
    ['Persons / Names',    ent.persons],
    ['Organizations',      ent.organizations],
    ['Locations',          ent.locations],
    ['Dates',              ent.dates],
    ['Monetary Amounts',   ent.monetary_amounts],
    ['Skills',             ent.skills],
    ['Projects',           ent.projects],
    ['Emails',             ent.emails],
    ['Phone Numbers',      ent.phone_numbers],
    ['URLs',               ent.urls],
    ['Invoice Numbers',    ent.invoice_numbers],
  ] as Array<[string, string[] | undefined]>)
    .filter(([, v]) => Array.isArray(v) && v.length > 0) as Array<[string, string[]]>

  if (cats.length > 0) {
    safe(18)
    // Section header
    const EHH = 14
    card(y, EHH)
    pill(y + 3, EHH - 6)
    secTitle('Extracted Entities', y + 8.5)
    y += EHH + 5

    for (const [label, items] of cats) {
      // Estimate rows: avg chip width ~22mm, maxX span ~162mm → ~7 per row
      const estRows = Math.ceil(Math.min(items.length, 20) / 7)
      const catH = 14 + estRows * 9
      safe(catH + 5)

      card(y, catH, C.surface2)
      y = entityCat(label, items, y + 8)
      y += 5
    }

  } else {
    safe(20)
    const EH = 18
    card(y, EH)
    pill(y + 3, EH - 6)
    secTitle('Extracted Entities', y + 8.5)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...C.dim)
    doc.text('No structured entities detected in this document.', ML + 8, y + 14)
    y += EH + 6
  }

  // ── Save ─────────────────────────────────────────────────
  const safe_name = (fileName || result.fileName || 'report')
    .replace(/\.[^.]+$/, '').replace(/[^a-z0-9_\-]/gi, '_')
  doc.save(`${safe_name}_doclyze_report.pdf`)
}
