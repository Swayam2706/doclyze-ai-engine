/**
 * Text Extraction Service
 *
 * Pipeline:
 *   PDF (text-based)  → pdf-parse
 *   PDF (scanned)     → pdfjs render → OCR each page → merge
 *   DOCX              → mammoth
 *   Images            → OCR (Vision → Tesseract)
 *
 * Returns: { text, ocr, ocrEngine, pagesProcessed }
 */

import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { runOCR } from './ocrService.js'
import { pdfToImages } from './pdfRenderer.js'

// Minimum chars to consider PDF text extraction successful
const PDF_TEXT_THRESHOLD = 50

// ─── PDF ─────────────────────────────────────────────────────

async function extractFromPDF(buffer) {
  console.log(`  PDF buffer size: ${(buffer.length / 1024).toFixed(1)} KB`)

  // Step 1: Try standard text extraction
  try {
    const data = await pdfParse(buffer)
    const text = (data.text || '').trim()
    console.log(`  PDF text extraction length: ${text.length} chars (${data.numpages} pages)`)

    if (text.length >= PDF_TEXT_THRESHOLD) {
      console.log('  PDF is text-based — no OCR needed')
      return {
        text,
        ocr: false,
        ocrEngine: null,
        pagesProcessed: data.numpages || 1,
      }
    }

    console.log(`  PDF text too short (${text.length} chars < ${PDF_TEXT_THRESHOLD}) — treating as scanned`)
  } catch (err) {
    console.log('  pdf-parse failed:', err.message, '— will attempt OCR')
  }

  // Step 2: Scanned PDF — render to images and OCR
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
