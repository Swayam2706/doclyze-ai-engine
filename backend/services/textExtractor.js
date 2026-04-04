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
      // These options improve compatibility with government/complex PDFs:
      disableAutoFetch: true,   // don't try to fetch external resources
      disableStream: true,      // load entire PDF at once
      isEvalSupported: false,   // safer for server-side
      stopAtErrors: false,      // continue past non-fatal errors
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
        // Join text items, preserving line breaks based on Y position
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
  return await extractFromScannedPDF(buffer)
}

async function extractFromScannedPDF(buffer) {
  console.log('  Starting scanned PDF OCR pipeline...')

  const { images, totalPages } = await pdfToImages(buffer)

  if (images.length === 0) {
    console.error('  PDF → image conversion produced 0 images!')
    return { text: '', ocr: true, ocrEngine: null, pagesProcessed: 0 }
  }

  console.log(`  OCR pipeline: processing ${images.length} page image(s)...`)

  const pageTexts = []
  let finalEngine = 'tesseract'

  for (let i = 0; i < images.length; i++) {
    console.log(`  OCR page ${i + 1}/${images.length} (${(images[i].length / 1024).toFixed(1)} KB)`)

    if (images[i].length < 500) {
      console.warn(`  Page ${i + 1}: image buffer suspiciously small — skipping`)
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

    if (result.engine === 'vision') finalEngine = 'vision'
  }

  const combinedText = pageTexts.join('\n\n').trim()
  console.log(`  Scanned PDF OCR complete: ${combinedText.length} total chars, engine=${finalEngine}, pages=${totalPages}`)

  if (combinedText.length === 0) {
    console.error('  All pages returned empty OCR text!')
  }

  return {
    text: combinedText,
    ocr: true,
    ocrEngine: finalEngine,
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
