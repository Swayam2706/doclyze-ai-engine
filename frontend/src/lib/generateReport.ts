import jsPDF from 'jspdf'
import type { AnalysisResult } from './api'

// ── Design tokens ─────────────────────────────────────────────
// Light-on-dark palette optimised for PDF export readability
const C = {
  pageBg:    [14, 16, 30]   as [number,number,number],  // deep navy
  surface:   [22, 25, 48]   as [number,number,number],  // card surface
  surface2:  [28, 32, 58]   as [number,number,number],  // slightly lighter card
  border:    [48, 54, 96]   as [number,number,number],  // subtle border
  accent:    [99, 102, 241] as [number,number,number],  // indigo
  accentDim: [60, 63, 160]  as [number,number,number],  // dim indigo
  white:     [248, 248, 252] as [number,number,number], // near-white
  muted:     [148, 152, 190] as [number,number,number], // muted text
  dim:       [80, 85, 130]  as [number,number,number],  // very dim
  success:   [34, 197, 94]  as [number,number,number],
  warning:   [251, 191, 36] as [number,number,number],
  negative:  [239, 68, 68]  as [number,number,number],
  headerBg:  [18, 20, 42]   as [number,number,number],  // header band
}

const PAGE_W = 210
const PAGE_H = 297
const ML = 16        // margin left
const MR = 16        // margin right
const CW = PAGE_W - ML - MR   // 178mm content width
const FOOTER_H = 14  // footer band height

function sentimentColor(label: string): [number,number,number] {
  const l = label.toLowerCase()
  if (l === 'positive') return C.success
  if (l === 'negative') return C.negative
  return C.muted
}

function sentimentBg(label: string): [number,number,number] {
  const l = label.toLowerCase()
  if (l === 'positive') return [20, 60, 35]
  if (l === 'negative') return [60, 20, 20]
  return [30, 32, 55]
}

export function generatePDFReport(result: AnalysisResult, fileName: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  let y = 0

  // ── Page helpers ─────────────────────────────────────────

  function drawPageBg() {
    doc.setFillColor(...C.pageBg)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  }

  function drawPageFooter() {
    const pageNum = doc.getNumberOfPages()
    // Footer band
    doc.setFillColor(...C.headerBg)
    doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, 'F')
    // Top border line
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.25)
    doc.line(ML, PAGE_H - FOOTER_H, PAGE_W - MR, PAGE_H - FOOTER_H)
    // Left: branding
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.dim)
    doc.text('Doclyze  ·  AI Document Intelligence', ML, PAGE_H - 5)
    // Right: page number
    doc.setTextColor(...C.muted)
    doc.text(`Page ${pageNum}`, PAGE_W - MR, PAGE_H - 5, { align: 'right' })
  }

  function newPage() {
    doc.addPage()
    y = 0
    drawPageBg()
    drawPageFooter()
  }

  function checkY(needed: number) {
    if (y + needed > PAGE_H - FOOTER_H - 4) newPage()
  }

  // ── Section card ─────────────────────────────────────────

  function card(cardY: number, cardH: number, variant: 'default' | 'accent' = 'default') {
    const bg = variant === 'accent' ? C.surface2 : C.surface
    doc.setFillColor(...bg)
    doc.roundedRect(ML, cardY, CW, cardH, 3, 3, 'F')
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.2)
    doc.roundedRect(ML, cardY, CW, cardH, 3, 3, 'S')
  }

  function accentPill(barY: number, barH: number) {
    doc.setFillColor(...C.accent)
    doc.roundedRect(ML, barY, 3, barH, 1.5, 1.5, 'F')
  }

  function sectionLabel(title: string, labelY: number) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.muted)
    doc.text(title.toUpperCase(), ML + 8, labelY)
    // Subtle underline
    const tw = doc.getTextWidth(title.toUpperCase())
    doc.setDrawColor(...C.accentDim)
    doc.setLineWidth(0.25)
    doc.line(ML + 8, labelY + 1.2, ML + 8 + tw, labelY + 1.2)
  }

  // ── Tag chip ─────────────────────────────────────────────

  function chip(text: string, tx: number, ty: number, color: [number,number,number] = C.accent): number {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    const tw = doc.getTextWidth(text) + 6
    const th = 5.5
    // Fill
    doc.setFillColor(color[0], color[1], color[2])
    doc.setGState(doc.GState({ opacity: 0.12 }))
    doc.roundedRect(tx, ty - 3.8, tw, th, 1.5, 1.5, 'F')
    doc.setGState(doc.GState({ opacity: 1 }))
    // Border
    doc.setDrawColor(color[0], color[1], color[2])
    doc.setLineWidth(0.18)
    doc.roundedRect(tx, ty - 3.8, tw, th, 1.5, 1.5, 'S')
    // Text
    doc.setTextColor(...color)
    doc.text(text, tx + 3, ty)
    return tw + 2.5
  }

  // ── Entity category block ─────────────────────────────────

  function entityBlock(label: string, items: string[], blockY: number): number {
    if (!items || items.length === 0) return blockY
    checkY(18)

    // Category label
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.muted)
    doc.text(label, ML + 8, blockY)

    // Thin separator line
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.15)
    doc.line(ML + 8 + doc.getTextWidth(label) + 3, blockY - 1, ML + CW - 4, blockY - 1)

    blockY += 5.5

    let tx = ML + 8
    let lineY = blockY
    const maxX = ML + CW - 4

    // Choose chip color by category
    const colorMap: Record<string, [number,number,number]> = {
      'Persons / Names': [129, 140, 248],
      'Organizations':   [99, 102, 241],
      'Locations':       [52, 211, 153],
      'Dates':           [251, 191, 36],
      'Monetary Amounts':[34, 197, 94],
      'Skills':          [167, 139, 250],
      'Projects':        [139, 92, 246],
      'Emails':          [96, 165, 250],
      'Phone Numbers':   [96, 165, 250],
      'URLs':            [148, 163, 184],
      'Invoice Numbers': [251, 191, 36],
    }
    const chipColor = colorMap[label] || C.accent

    for (const item of items.slice(0, 18)) {
      const tw = doc.getTextWidth(item) + 8.5
      if (tx + tw > maxX) {
        tx = ML + 8
        lineY += 7.5
        checkY(8)
      }
      chip(item, tx, lineY, chipColor)
      tx += tw
    }
    return lineY + 10
  }

  // ── Horizontal rule ───────────────────────────────────────

  function hr(hrY: number) {
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.2)
    doc.line(ML, hrY, ML + CW, hrY)
  }

  // ─────────────────────────────────────────────────────────
  // PAGE 1
  // ─────────────────────────────────────────────────────────
  drawPageBg()
  drawPageFooter()

  // ── HEADER BAND ──────────────────────────────────────────
  const HEADER_H = 52

  // Header background
  doc.setFillColor(...C.headerBg)
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F')

  // Left accent stripe
  doc.setFillColor(...C.accent)
  doc.rect(0, 0, 4, HEADER_H, 'F')

  // Bottom border
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.line(0, HEADER_H, PAGE_W, HEADER_H)

  // Doclyze wordmark
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('Doclyze', 12, 18)

  // Tagline
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text('AI Document Intelligence', 12, 25)

  // Vertical divider
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.25)
  doc.line(75, 8, 75, HEADER_H - 8)

  // Report title (right of divider)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('Document Analysis Report', PAGE_W - MR, 15, { align: 'right' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text(`${dateStr}  ·  ${timeStr}`, PAGE_W - MR, 22, { align: 'right' })

  // File metadata row
  const metaY = 36
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')

  // File name
  doc.setTextColor(...C.dim)
  doc.text('File', 12, metaY)
  doc.setTextColor(...C.white)
  const displayName = (fileName || result.fileName || 'Unknown').substring(0, 55)
  doc.text(displayName, 12 + doc.getTextWidth('File') + 3, metaY)

  // Document type badge
  const docType = (result.document_type || 'general').toUpperCase()
  const badgeX = PAGE_W - MR - doc.getTextWidth(docType) - 8
  doc.setFillColor(...C.accent)
  doc.setGState(doc.GState({ opacity: 0.18 }))
  doc.roundedRect(badgeX - 2, metaY - 4.5, doc.getTextWidth(docType) + 8, 6.5, 1.5, 1.5, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.2)
  doc.roundedRect(badgeX - 2, metaY - 4.5, doc.getTextWidth(docType) + 8, 6.5, 1.5, 1.5, 'S')
  doc.setTextColor(...C.accent)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text(docType, badgeX + 2, metaY)

  y = HEADER_H + 10

  // ── PROCESSING INSIGHTS (2-column grid) ──────────────────
  const insightData: Array<[string, string]> = []
  if (result.fileSize > 0) insightData.push(['File Size', (result.fileSize / 1024).toFixed(1) + ' KB'])
  if (result.metadata?.processing_time_ms > 0) insightData.push(['Processing Time', (result.metadata.processing_time_ms / 1000).toFixed(1) + ' s'])
  insightData.push(['OCR Engine', result.metadata?.ocr_used
    ? (result.metadata.ocr_engine === 'vision' ? 'Google Vision' : result.metadata.ocr_engine || 'OCR')
    : 'Not Used'])
  if (result.confidence > 0) insightData.push(['Confidence', Math.round(result.confidence * 100) + '%'])

  const INSIGHT_CARD_H = 36
  checkY(INSIGHT_CARD_H)
  card(y, INSIGHT_CARD_H)
  accentPill(y + 4, INSIGHT_CARD_H - 8)
  sectionLabel('Processing Insights', y + 8)

  // 2-column layout for insight rows
  const colW = CW / 2 - 4
  insightData.forEach(([k, v], idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const ix = ML + 8 + col * (colW + 4)
    const iy = y + 16 + row * 10

    // Label
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.dim)
    doc.text(k, ix, iy)

    // Value — larger, brighter
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.white)
    doc.text(v, ix, iy + 5.5)
  })

  y += INSIGHT_CARD_H + 7

  // ── SENTIMENT + CONFIDENCE (side by side) ────────────────
  const sentLabel = typeof result.sentiment === 'string'
    ? result.sentiment
    : (result.sentiment as any)?.label || 'Neutral'
  const sentConf = typeof result.sentiment === 'object' && (result.sentiment as any)?.confidence
    ? Math.round((result.sentiment as any).confidence * 100) + '%'
    : result.confidence > 0 ? Math.round(result.confidence * 100) + '%' : ''

  const SENT_H = 28
  checkY(SENT_H)

  // Sentiment card (left 55%)
  const sentW = CW * 0.55
  doc.setFillColor(...sentimentBg(sentLabel))
  doc.roundedRect(ML, y, sentW, SENT_H, 3, 3, 'F')
  doc.setDrawColor(...sentimentColor(sentLabel))
  doc.setLineWidth(0.2)
  doc.roundedRect(ML, y, sentW, SENT_H, 3, 3, 'S')
  // Left accent
  doc.setFillColor(...sentimentColor(sentLabel))
  doc.roundedRect(ML, y, 3, SENT_H, 1.5, 1.5, 'F')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.muted)
  doc.text('SENTIMENT', ML + 8, y + 8)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...sentimentColor(sentLabel))
  doc.text(sentLabel.charAt(0).toUpperCase() + sentLabel.slice(1).toLowerCase(), ML + 8, y + 21)

  // Confidence card (right 42%)
  const confX = ML + sentW + 4
  const confW = CW - sentW - 4
  card(y, SENT_H)
  doc.setFillColor(...C.surface)
  doc.roundedRect(confX, y, confW, SENT_H, 3, 3, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.2)
  doc.roundedRect(confX, y, confW, SENT_H, 3, 3, 'S')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.muted)
  doc.text('CONFIDENCE', confX + 6, y + 8)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.accent)
  doc.text(sentConf || '—', confX + 6, y + 22)

  y += SENT_H + 8

  // ── AI GENERATED SUMMARY ─────────────────────────────────
  if (result.summary && result.summary.length > 10) {
    const summaryLines = doc.splitTextToSize(result.summary, CW - 16)
    const LINE_H = 5.8
    const summaryH = 18 + summaryLines.length * LINE_H
    checkY(Math.min(summaryH, 60))

    card(y, summaryH)
    accentPill(y + 4, summaryH - 8)
    sectionLabel('AI Generated Summary', y + 8)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 222, 240)
    doc.text(summaryLines, ML + 8, y + 15, { lineHeightFactor: 1.5 })

    y += summaryH + 8
  }

  // ── EXTRACTED ENTITIES ────────────────────────────────────
  const ent = result.entities || {}
  const entitySections: Array<[string, string[]]> = [
    ['Persons / Names',    ent.persons || []],
    ['Organizations',      ent.organizations || []],
    ['Locations',          ent.locations || []],
    ['Dates',              ent.dates || []],
    ['Monetary Amounts',   ent.monetary_amounts || []],
    ['Skills',             ent.skills || []],
    ['Projects',           ent.projects || []],
    ['Emails',             ent.emails || []],
    ['Phone Numbers',      ent.phone_numbers || []],
    ['URLs',               ent.urls || []],
    ['Invoice Numbers',    ent.invoice_numbers || []],
  ].filter(([, items]) => Array.isArray(items) && items.length > 0) as Array<[string, string[]]>

  if (entitySections.length > 0) {
    checkY(20)

    // Section header card
    const headerCardH = 14
    card(y, headerCardH)
    accentPill(y + 3, headerCardH - 6)
    sectionLabel('Extracted Entities', y + 8)
    y += headerCardH + 4

    // Each entity category as its own mini-card
    for (const [label, items] of entitySections) {
      // Estimate height for this category
      const rows = Math.ceil(Math.min(items.length, 18) / 6)
      const catH = 8 + rows * 8 + 6
      checkY(catH + 4)

      const catCardY = y
      card(catCardY, catH, 'accent')

      y = catCardY + 4
      y = entityBlock(label, items, y)
      y = Math.max(y, catCardY + catH) + 4
    }

  } else {
    checkY(20)
    const emptyH = 18
    card(y, emptyH)
    accentPill(y + 3, emptyH - 6)
    sectionLabel('Extracted Entities', y + 8)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...C.dim)
    doc.text('No structured entities detected in this document.', ML + 8, y + 14)
    y += emptyH + 6
  }

  // ── Save ─────────────────────────────────────────────────
  const safeName = (fileName || result.fileName || 'report')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_\-]/gi, '_')
  doc.save(`${safeName}_doclyze_report.pdf`)
}
