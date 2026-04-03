/**
 * OCR Service
 *
 * Strategy:
 *   1. PRIMARY  → Google Vision API  (if GOOGLE_VISION_API_KEY is set)
 *   2. FALLBACK → Tesseract.js       (ALWAYS runs if Vision fails or returns empty)
 *
 * Security: API key is NEVER logged, printed, or exposed anywhere.
 */

import axios from 'axios'
import Tesseract from 'tesseract.js'

// ─── Google Vision OCR ───────────────────────────────────────

async function ocrWithVision(imageBuffer) {
  const key = process.env.GOOGLE_VISION_API_KEY
  if (!key || key.includes('your_') || key.length < 10) {
    console.log('  Vision API: key not configured, skipping')
    return null
  }

  console.log(`  Using Google Vision OCR — image size: ${(imageBuffer.length / 1024).toFixed(1)} KB`)

  try {
    const base64 = imageBuffer.toString('base64')

    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
      {
        requests: [{
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        }],
      },
      {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const responses = response.data?.responses
    if (!responses || responses.length === 0) {
      console.log('  Vision API: empty responses array')
      return null
    }

    const firstResponse = responses[0]

    // Check for API-level error
    if (firstResponse.error) {
      console.log('  Vision API error in response:', firstResponse.error.message)
      return null
    }

    // Try fullTextAnnotation first (better for documents)
    const fullText = firstResponse.fullTextAnnotation?.text || ''
    if (fullText.trim().length > 0) {
      console.log(`  Google Vision OCR text length: ${fullText.length} chars`)
      return { text: fullText, engine: 'vision' }
    }

    // Fallback to textAnnotations
    const annotations = firstResponse.textAnnotations
    if (annotations && annotations.length > 0) {
      const text = annotations[0].description || ''
      console.log(`  Vision OCR text length: ${text.length} chars (textAnnotations)`)
      if (text.trim().length > 0) {
        return { text, engine: 'vision' }
      }
    }

    console.log('  Vision API: returned no text (image may be blank or unreadable)')
    return null
  } catch (err) {
    const status = err.response?.status
    const errMsg = err.response?.data?.error?.message || err.message
    if (status === 429) {
      console.log('  Vision API: quota exceeded (429), falling back to Tesseract')
    } else if (status === 403) {
      console.log('  Vision API: auth error (403), falling back to Tesseract')
    } else if (status === 400) {
      console.log('  Vision API: bad request (400):', errMsg)
    } else {
      console.log('  Vision API error:', errMsg)
    }
    return null
  }
}

// ─── Tesseract OCR ───────────────────────────────────────────

async function ocrWithTesseract(imageBuffer) {
  try {
    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: () => {},
    })

    const text = data.text || ''
    console.log(`  Tesseract OCR text length: ${text.length} chars`)

    if (text.trim().length === 0) {
      console.log('  Tesseract: returned empty text — image may be blank or low quality')
    }

    return { text, engine: 'tesseract' }
  } catch (err) {
    console.error('  Tesseract error:', err.message)
    return { text: '', engine: 'tesseract' }
  }
}

// ─── Main OCR function ───────────────────────────────────────

/**
 * Run OCR on a single image buffer.
 * 1. Try Google Vision (if configured)
 * 2. ALWAYS fall back to Tesseract if Vision fails or returns empty
 *
 * Returns { text, engine }
 */
export async function runOCR(imageBuffer) {
  if (!imageBuffer || imageBuffer.length === 0) {
    console.error('  OCR: received empty image buffer!')
    return { text: '', engine: 'none' }
  }

  console.log(`  Running OCR on image buffer: ${(imageBuffer.length / 1024).toFixed(1)} KB`)

  // Step 1: Try Google Vision
  const visionResult = await ocrWithVision(imageBuffer)
  if (visionResult && visionResult.text.trim().length >= 20) {
    console.log(`  OCR complete: Vision API, ${visionResult.text.length} chars`)
    return visionResult
  }

  // Step 2: ALWAYS fall back to Tesseract
  console.log('  Falling back to Tesseract OCR...')
  const tesseractResult = await ocrWithTesseract(imageBuffer)

  if (!tesseractResult.text || tesseractResult.text.trim().length === 0) {
    console.log('  OCR: both Vision and Tesseract returned empty text')
  } else {
    console.log(`  OCR complete: Tesseract, ${tesseractResult.text.length} chars`)
  }

  return tesseractResult
}
