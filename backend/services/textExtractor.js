/**
 * Text Extraction Service
 *
 * Pipeline:
 *   PDF (text-based)  → pdf-parse (primary) → pdfjs text (fallback) → OCR (last resort)
 *   PDF (scanned)     → pdfjs render → OCR each page → merge
 *   DOCX              → mammoth
 *   Images            → OCR (Vision → Tesseract)
 *
 * Returns: { text, ocr, ocrEngine, pagesProcessed }
 */

import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { runOCR } from './ocrService.js'
import { pdfToImages } from './pdfRenderer.js'

// Minimum chars to consider PDF text extraction successful
const PDF_TEXT_THRESHOLD = 50

// ─── pdfjs text extraction (no rendering) ────────────────────
// Used as a fallback when pdf-parse fails or returns empty text
// for machine-readable PDFs that pdf-parse can't handle.

const _require = createRequire(import.meta.url)
const _dirname = dirname(fileURLToPath(import.meta.url))

let _pdfjsWorkerSet = false
function ensurePdfjsWorker() {
  if (_pdfjsWorkerSet) return
  try {
    const wp = _require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(`file://${wp}`).href
  } catch {
    // worker already set by pdfRenderer or not needed
  }
  _pdfjsWorkerSet = true
}

/**
 * Extract text from a PDF using pdfjs-dist text layer (no OCR).
 * Handles complex PDFs that pdf-parse fails on.
 */
async function extractTextWithPdfjs(buffer) {
  ensurePdfjsWorker()
  try {
    const uint8Array = new Uint8Array(buffer)
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
      disableAutoFetch: true,
      disableStream: true,
      isEvalSupported: false,
      stopAtErrors: false,      // continue past non-fatal errors
      ignoreErrors: true,       // recover from structural errors
    })
    const pdf = await loadingTask.promise
    const numPages = pdf.numPages
    const pageTexts = []
    console.log(`  pdfjs: loading ${numPages}-page PDF...`)

    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent({
          includeMarkedContent: false,
          disableCombineTextItems: false,
        })
        let pageText = ''
        let lastY = null
        for (const item of content.items) {
          if ('str' in item) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
              pageText += '\n'
            }
            pageText += item.str
            lastY = item.transform[5]
          }
        }
        const trimmed = pageText.trim()
        if (trimmed) pageTexts.push(trimmed)
        console.log(`  pdfjs page ${i}: ${trimmed.length} chars`)
        page.cleanup()
      } catch (pageErr) {
        console.log(`  pdfjs page ${i} error: ${pageErr.message}`)
      }
    }

    const combined = pageTexts.join('\n\n').trim()
    console.log(`  pdfjs text extraction: ${combined.length} chars from ${numPages} pages`)
    return { text: combined, pages: numPages }
  } catch (err) {
    console.log('  pdfjs text extraction failed:', err.message)
    return { text: '', pages: 0 }
  }
}

// ─── Raw PDF binary text extraction ─────────────────────────
// Last-resort fallback: extract readable text strings directly from PDF binary.
// Works on PDFs where all parsers fail due to structural issues.
// Finds text between BT/ET markers and parenthesized strings in content streams.
function extractRawTextFromPDFBinary(buffer) {
  try {
    const raw = buffer.toString('latin1')
    const chunks = []

    // Method 1: Extract text between BT (begin text) and ET (end text) markers
    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g
    let m
    while ((m = btEtRegex.exec(raw)) !== null) {
      const block = m[1]
      // Extract parenthesized strings: (text here)
      const strRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g
      let sm
      while ((sm = strRegex.exec(block)) !== null) {
        const s = sm[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .trim()
        if (s.length > 1) chunks.push(s)
      }
    }

    // Method 2: Extract from stream objects directly
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
    while ((m = streamRegex.exec(raw)) !== null) {
      const stream = m[1]
      // Only process streams that look like content streams (contain Tf, Tj, TJ)
      if (!/\bT[fjJm]\b/.test(stream)) continue
      const strRegex2 = /\(([^)\\]{2,}(?:\\.[^)\\]*)*)\)/g
      let sm2
      while ((sm2 = strRegex2.exec(stream)) !== null) {
        const s = sm2[1]
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .trim()
        if (s.length > 2 && /[a-zA-Z]{2,}/.test(s)) chunks.push(s)
      }
    }

    if (chunks.length === 0) return ''

    // Deduplicate and join
    const seen = new Set()
    const unique = chunks.filter(c => {
      if (seen.has(c)) return false
      seen.add(c)
      return true
    })

    const result = unique.join(' ').replace(/\s{3,}/g, '  ').trim()
    console.log(`  Raw binary extraction: ${chunks.length} chunks → ${result.length} chars`)
    return result
  } catch (err) {
    console.log('  Raw binary extraction failed:', err.message)
    return ''
  }
}

// ─── PDF ─────────────────────────────────────────────────────

async function extractFromPDF(buffer) {
  console.log(`  PDF buffer size: ${(buffer.length / 1024).toFixed(1)} KB`)

  // Step 1: Try pdf-parse (fast, handles most text PDFs)
  let parserText = ''
  let parserPages = 1
  try {
    const data = await pdfParse(buffer)
    parserText = (data.text || '').trim()
    parserPages = data.numpages || 1
    // Check for garbage text — pdf-parse sometimes returns whitespace-only strings
    // when its bundled pdfjs (v2) can't decode the font/encoding
    const meaningfulChars = parserText.replace(/[\s\n\r\t]/g, '').length
    console.log(`  pdf-parse: ${parserText.length} chars total, ${meaningfulChars} meaningful (${parserPages} pages)`)
    // Require at least 30 meaningful (non-whitespace) chars to consider it valid
    if (meaningfulChars < 30) {
      console.log(`  pdf-parse: text is mostly whitespace — treating as failed`)
      parserText = ''
    }
  } catch (err) {
    console.log('  pdf-parse failed:', err.message)
  }

  if (parserText.length >= PDF_TEXT_THRESHOLD) {
    console.log('  PDF is text-based (pdf-parse) — no OCR needed')
    return { text: parserText, ocr: false, ocrEngine: null, pagesProcessed: parserPages }
  }

  // Step 2: Try pdfjs text extraction — handles complex/encrypted/non-standard PDFs
  // that pdf-parse fails on but are still machine-readable
  console.log(`  pdf-parse insufficient (${parserText.length} chars) — trying pdfjs text extraction...`)
  const { text: pdfjsText, pages: pdfjsPages } = await extractTextWithPdfjs(buffer)

  if (pdfjsText.length >= PDF_TEXT_THRESHOLD) {
    console.log(`  PDF is text-based (pdfjs) — ${pdfjsText.length} chars, no OCR needed`)
    return { text: pdfjsText, ocr: false, ocrEngine: null, pagesProcessed: pdfjsPages || 1 }
  }

  // Step 3: Scanned PDF — render to images and OCR (last resort)
  console.log(`  Both parsers returned insufficient text — treating as scanned PDF, attempting OCR`)

  // Before OCR, try one more thing: raw text extraction from PDF binary
  // Some PDFs have readable text embedded in the binary that parsers miss
  const rawText = extractRawTextFromPDFBinary(buffer)
  if (rawText.length >= PDF_TEXT_THRESHOLD) {
    console.log(`  Raw binary extraction: ${rawText.length} chars — using this`)
    return { text: rawText, ocr: false, ocrEngine: null, pagesProcessed: 1 }
  }

  return await extractFromScannedPDF(buffer)
}

async function extractFromScannedPDF(buffer) {
  console.log('  Starting scanned PDF OCR pipeline...')

  const { images, totalPages } = await pdfToImages(buffer)

  if (images.length === 0) {
    console.error('  PDF → image conversion produced 0 images — PDF may be corrupt or image-only without renderable content')
    // OCR was attempted (rendering was tried) but failed — set engine to 'failed' so metadata is honest
    return { text: '', ocr: true, ocrEngine: 'failed', pagesProcessed: 0 }
  }

  console.log(`  OCR pipeline: processing ${images.length} page image(s)...`)

  const pageTexts = []
  let finalEngine = null  // will be set to actual engine used

  for (let i = 0; i < images.length; i++) {
    const imgKB = (images[i].length / 1024).toFixed(1)
    console.log(`  OCR page ${i + 1}/${images.length} (${imgKB} KB)`)

    if (images[i].length < 5000) {
      console.warn(`  Page ${i + 1}: image buffer too small (${images[i].length} bytes) — may be blank, skipping`)
      continue
    }

    const result = await runOCR(images[i])
    const pageText = (result.text || '').trim()

    console.log(`  Page ${i + 1} OCR result: ${pageText.length} chars, engine=${result.engine}`)

    if (pageText.length > 0) {
      pageTexts.push(pageText)
    } else {
      console.warn(`  Page ${i + 1}: OCR returned empty text`)
    }

    // Track which engine was actually used (prefer vision over tesseract)
    if (result.engine === 'vision') {
      finalEngine = 'vision'
    } else if (finalEngine === null && result.engine) {
      finalEngine = result.engine
    }
  }

  const combinedText = pageTexts.join('\n\n').trim()
  // If no engine was recorded (all pages skipped), default to tesseract since that's what would have run
  const resolvedEngine = finalEngine || 'tesseract'

  console.log(`  Scanned PDF OCR complete: ${combinedText.length} total chars, engine=${resolvedEngine}, pages=${totalPages}`)

  if (combinedText.length === 0) {
    console.error('  All pages returned empty OCR text!')
  }

  return {
    text: combinedText,
    ocr: true,
    ocrEngine: resolvedEngine,
    pagesProcessed: totalPages,
  }
}

// ─── DOCX ─────────────────────────────────────────────────────

async function extractFromDOCX(buffer) {
  console.log(`  DOCX buffer size: ${(buffer.length / 1024).toFixed(1)} KB`)
  const result = await mammoth.extractRawText({ buffer })
  const text = result.value || ''
  console.log(`  DOCX extracted: ${text.length} chars`)
  return { text, ocr: false, ocrEngine: null, pagesProcessed: 1 }
}

// ─── Image ────────────────────────────────────────────────────

async function extractFromImage(buffer) {
  console.log(`  Image buffer size: ${(buffer.length / 1024).toFixed(1)} KB`)

  if (buffer.length < 100) {
    console.error('  Image buffer is too small — likely corrupt or empty')
    return { text: '', ocr: true, ocrEngine: null, pagesProcessed: 1 }
  }

  const result = await runOCR(buffer)
  const text = (result.text || '').trim()
  console.log(`  Image OCR complete: ${text.length} chars, engine=${result.engine}`)
  return { text, ocr: true, ocrEngine: result.engine, pagesProcessed: 1 }
}

// ─── Main export ──────────────────────────────────────────────

export async function extractText(file) {
  const { buffer, mimetype } = file
  console.log(`\n  [extractText] mimetype=${mimetype}, size=${(buffer.length / 1024).toFixed(1)} KB`)

  let result
  switch (mimetype) {
    case 'application/pdf':
      result = await extractFromPDF(buffer)
      break
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      result = await extractFromDOCX(buffer)
      break
    case 'image/png':
    case 'image/jpeg':
    case 'image/jpg':
      result = await extractFromImage(buffer)
      break
    default:
      throw new Error(`Unsupported file type: ${mimetype}`)
  }

  console.log(`  Final extracted text length: ${result.text.length} chars, ocr=${result.ocr}, engine=${result.ocrEngine || 'none'}`)
  return result
}
