/**
 * PDF Renderer
 * Converts PDF pages to image buffers using pdfjs-dist + canvas.
 * Pure JavaScript — no native binary dependencies.
 */

import { createCanvas } from 'canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Set worker path — resolve from pdfjs-dist package location for deployment safety
const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Try multiple resolution strategies for different deployment environments
let workerSrc
try {
  // Strategy 1: resolve from package (works on most platforms)
  const pkgPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  workerSrc = new URL(`file://${pkgPath}`).href
} catch {
  // Strategy 2: relative path fallback
  workerSrc = new URL(
    resolve(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
    import.meta.url
  ).href
}
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

// Suppress pdfjs verbose warnings
const originalWarn = console.warn
const originalError = console.error

function suppressPdfjsNoise(fn, ...args) {
  const msg = String(args[0] || '')
  if (
    msg.includes('Indexing all PDF') ||
    msg.includes('getHexString') ||
    msg.includes('Warning:')
    // NOTE: do NOT suppress 'Invalid PDF' — we need to see those errors
  ) return
  fn.apply(console, args)
}

/**
 * Render a single PDF page to a PNG buffer.
 * Scale 3.5 = ~252 DPI — high enough for Tesseract to read small text reliably.
 * Government letters and notices often have small fonts that need higher DPI.
 */
async function renderPage(page, scale = 3.5) {
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')

  // Fill white background (important for OCR accuracy)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({
    canvasContext: context,
    viewport,
    background: 'white',
  }).promise

  // Apply contrast enhancement for better OCR accuracy on scanned/faint text
  // This is a simple brightness/contrast pass on the canvas pixels
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const contrast = 1.3  // 30% contrast boost
  const brightness = 10 // slight brightness lift
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, factor * (data[i]     - 128) + 128 + brightness))
    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128 + brightness))
    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128 + brightness))
  }
  context.putImageData(imageData, 0, 0)

  const imgBuffer = canvas.toBuffer('image/png')
  console.log(`    Page rendered: ${canvas.width}x${canvas.height}px @ scale ${scale}, ${(imgBuffer.length / 1024).toFixed(1)} KB`)
  return imgBuffer
}

/**
 * Convert a PDF buffer to an array of image buffers (one per page).
 * Limits to first 10 pages to avoid memory issues.
 */
export async function pdfToImages(pdfBuffer, maxPages = 10) {
  // Temporarily suppress pdfjs noise
  console.warn = (...args) => suppressPdfjsNoise(originalWarn, ...args)
  console.error = (...args) => suppressPdfjsNoise(originalError, ...args)

  try {
    const uint8Array = new Uint8Array(pdfBuffer)
    console.log(`  PDF buffer size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: false,  // allow font rendering for better visual fidelity
      verbosity: 0,
      stopAtErrors: false,     // continue past non-fatal errors
      ignoreErrors: true,      // recover from structural errors in government/complex PDFs
    })

    const pdf = await loadingTask.promise
    const totalPages = Math.min(pdf.numPages, maxPages)
    console.log(`  PDF pages converted: ${totalPages} (of ${pdf.numPages} total)`)

    const images = []

    for (let i = 1; i <= totalPages; i++) {
      console.log(`  Rendering page ${i}/${totalPages}...`)
      try {
        const page = await pdf.getPage(i)
        const imgBuffer = await renderPage(page, 3.5)

        if (imgBuffer.length < 5000) {
          console.warn(`  Warning: page ${i} image is very small (${imgBuffer.length} bytes) — may be blank`)
        }

        images.push(imgBuffer)
        page.cleanup()
      } catch (pageErr) {
        console.error(`  Page ${i} render error: ${pageErr.message} — skipping`)
      }
    }

    console.log(`  PDF → images complete: ${images.length} images generated`)
    return { images, totalPages }
  } catch (err) {
    console.error('  PDF rendering error:', err.message)
    return { images: [], totalPages: 0 }
  } finally {
    // Restore console
    console.warn = originalWarn
    console.error = originalError
  }
}
