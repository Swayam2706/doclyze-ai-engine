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
    msg.includes('Invalid PDF') ||
    msg.includes('Warning:')
  ) return
  fn.apply(console, args)
}

/**
 * Render a single PDF page to a PNG buffer.
 * Scale 2.0 = 144 DPI — good balance of quality vs memory.
 */
async function renderPage(page, scale = 2.0) {
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

  const imgBuffer = canvas.toBuffer('image/png')
  console.log(`    Page rendered: ${canvas.width}x${canvas.height}px, ${(imgBuffer.length / 1024).toFixed(1)} KB`)
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
      disableFontFace: true,
      verbosity: 0,
    })

    const pdf = await loadingTask.promise
    const totalPages = Math.min(pdf.numPages, maxPages)
    console.log(`  PDF pages converted: ${totalPages} (of ${pdf.numPages} total)`)

    const images = []

    for (let i = 1; i <= totalPages; i++) {
      console.log(`  Rendering page ${i}/${totalPages}...`)
      const page = await pdf.getPage(i)
      const imgBuffer = await renderPage(page, 2.0)

      if (imgBuffer.length < 1000) {
        console.warn(`  Warning: page ${i} image is very small (${imgBuffer.length} bytes) — may be blank`)
      }

      images.push(imgBuffer)
      page.cleanup()
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
