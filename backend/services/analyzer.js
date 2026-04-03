import { extractText } from './textExtractor.js'
import { cleanText, prepareForAI, extractContactBlock } from './textCleaner.js'
import { detectDocumentType } from './docTypeDetector.js'
import { extractDeterministicEntities } from './regexExtractor.js'
import { runAIAnalysis } from './aiAnalyzer.js'
import { mergeAndValidate, computeConfidence, validateSummary, classifySentiment } from './postProcessor.js'

/**
 * Main Document Analysis Pipeline
 *
 * 1. Extract raw text
 * 2. Clean & normalize
 * 3. Classify document type
 * 4. Extract contact block (resumes)
 * 5. Regex/rule-based entity extraction
 * 6. AI analysis (summary + sentiment + entity supplement)
 * 7. Validate summary (strip contact leaks for resumes)
 * 8. Merge, validate, deduplicate entities
 * 9. Compute confidence programmatically
 * 10. Return consistent JSON
 */
export async function analyzeDocument(file, onProgress) {
  const t0 = Date.now()
  const emit = (step, msg) => { if (onProgress) onProgress(step, msg) }

  try {
    // 1. Extract
    emit(0, 'Extracting text from document')
    console.log('  [1/7] Extracting text...')
    const { text: rawText, ocr: ocrUsed, ocrEngine, pagesProcessed } = await extractText(file)
    if (!rawText || rawText.trim().length < 10) {
      return emptyResponse('No readable text could be extracted from this document. If this is a scanned document, ensure the image quality is sufficient for OCR.', t0, ocrUsed, file.originalname || '', file.size || 0)
    }
    console.log(`        ${rawText.length} chars, ocr=${ocrUsed}, engine=${ocrEngine || 'none'}, pages=${pagesProcessed || 1}`)

    // 2. Clean
    emit(1, 'Detecting document structure')
    console.log('  [2/7] Cleaning...')
    const cleaned = cleanText(rawText)

    // 3. Classify
    console.log('  [3/7] Classifying...')
    const docType = detectDocumentType(cleaned)
    console.log(`        type=${docType}`)

    // 4. Contact block (resumes only)
    let contactBlock = []
    if (docType === 'resume') {
      const cb = extractContactBlock(cleaned)
      contactBlock = cb.contactBlock
      console.log(`        contact block: ${contactBlock.length} lines`)
    }

    // 5. Regex extraction
    emit(2, 'Identifying entities with pattern matching')
    console.log('  [4/7] Regex extraction...')
    const regexEnt = extractDeterministicEntities(rawText, cleaned, docType)
    console.log(`        emails=${regexEnt.emails.length} phones=${regexEnt.phone_numbers.length} urls=${regexEnt.urls.length} dates=${regexEnt.dates.length} skills=${(regexEnt.skills||[]).length} projects=${(regexEnt.projects||[]).length} orgs=${(regexEnt.organizations||[]).length} locs=${(regexEnt.locations||[]).length}`)
    if (regexEnt.organizations?.length) console.log(`        orgs: [${regexEnt.organizations.slice(0,5).join(', ')}]`)
    if (regexEnt.persons?.length) console.log(`        persons: [${regexEnt.persons.join(', ')}]`)
    if (regexEnt.locations?.length) console.log(`        locations: [${regexEnt.locations.slice(0,5).join(', ')}]`)

    // 6. AI
    emit(3, 'Analyzing sentiment and generating summary')
    console.log('  [5/7] AI analysis...')
    const aiText = prepareForAI(cleaned, docType)
    const aiResult = await runAIAnalysis(aiText, docType)
    console.log(`        AI ${aiResult ? 'ok' : 'failed'}`)

    // 7. Summary validation
    let summaryRejected = false
    let summary = ''

    const rawSummary = (aiResult?.summary && aiResult.summary.length > 20)
      ? aiResult.summary
      : ''

    if (rawSummary) {
      const validated = validateSummary(rawSummary, docType, contactBlock)
      summary = validated.summary
      summaryRejected = validated.wasRejected
    }

    // If AI summary was rejected or empty, build fallback from body text
    if (!summary || summary.length < 40) {
      const { bodyText } = docType === 'resume' ? extractContactBlock(cleaned) : { bodyText: cleaned }
      summary = buildBodySummary(bodyText, docType)
      // Validate fallback too
      const recheck = validateSummary(summary, docType, contactBlock)
      summary = recheck.summary
      if (recheck.wasRejected || !summary || summary.length < 30) {
        summary = `This ${docType} document has been processed and analyzed.`
      }
      summaryRejected = true
    }

    console.log(`        summary: ${summary.length} chars, rejected=${summaryRejected}`)

    // 8. Merge & validate entities
    emit(4, 'Finalizing and validating results')
    console.log('  [6/7] Merging...')
    const entities = mergeAndValidate(regexEnt, aiResult, docType)

    // 9. Sentiment — use AI result, then keyword fallback
    const sentimentLabel = aiResult?.sentiment || classifySentiment(cleaned, docType)

    // 10. Confidence (with penalty if summary was rejected)
    let confidence = computeConfidence(summary, entities, sentimentLabel, docType, ocrUsed)
    if (summaryRejected) {
      confidence = Math.max(0.50, confidence - 0.04)
      confidence = Math.round(confidence * 100) / 100
    }

    const ms = Date.now() - t0
    console.log(`  [7/7] ✅ ${ms}ms | type=${docType} | conf=${confidence} | sentiment=${sentimentLabel}`)
    console.log(`        final entities — persons:${entities.persons?.length||0} orgs:${entities.organizations?.length||0} locs:${entities.locations?.length||0} skills:${entities.skills?.length||0} dates:${entities.dates?.length||0} amounts:${entities.monetary_amounts?.length||0}`)

    return {
      success: true,
      document_type: docType,
      summary,
      entities,
      sentiment: { label: sentimentLabel, confidence },
      confidence,
      metadata: { ocr_used: ocrUsed, ocr_engine: ocrEngine || null, pages_processed: pagesProcessed || 1, processing_time_ms: ms },
      extractedText: rawText.substring(0, 5000),
      fileName: file.originalname || '',
      fileSize: file.size || 0,
    }
  } catch (err) {
    console.error('  Pipeline error:', err.message)
    return emptyResponse(err.message, t0, false, file?.originalname || '', file?.size || 0)
  }
}

/**
 * Build a summary from body text (contact block already removed for resumes).
 * Picks the first 2 meaningful sentences that aren't headings or contact lines.
 */
/**
 * Build a document-type-aware fallback summary from body text.
 * Used when AI summary is unavailable or rejected.
 */
function buildBodySummary(bodyText, docType) {
  // For invoices — try to build a structured summary from key fields
  if (docType === 'invoice' || docType === 'receipt') {
    const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean)
    const parts = []
    // Look for vendor/client
    for (const line of lines.slice(0, 20)) {
      if (/(?:from|vendor|issued by|company)[:\s]+(.+)/i.test(line)) {
        parts.push(line); break
      }
    }
    for (const line of lines.slice(0, 20)) {
      if (/(?:bill to|client|customer)[:\s]+(.+)/i.test(line)) {
        parts.push(line); break
      }
    }
    // Look for total
    for (const line of lines) {
      if (/(?:total|amount due|grand total)[:\s]+.+/i.test(line)) {
        parts.push(line); break
      }
    }
    if (parts.length >= 2) return parts.join('. ').trim()
  }

  const sentences = bodyText.match(/[^.!?]+[.!?]+/g) || []
  const good = sentences
    .map(s => s.trim())
    .filter(s => s.length > 40)
    .filter(s => !/^(professional summary|education|skills|projects|certifications|experience|technical skills|achievements|contact|references|objective)/i.test(s))
    .filter(s => !/@/.test(s))
    .filter(s => !/\+?\d{10,}/.test(s.replace(/\D/g, '')))
    .filter(s => !/https?:\/\//.test(s))
    .filter(s => !/github|linkedin|leetcode/i.test(s))
    .filter(s => (s.match(/[|–—]/g) || []).length < 3)

  if (good.length >= 3) return good.slice(0, 3).join(' ').trim()
  if (good.length >= 2) return good.slice(0, 2).join(' ').trim()
  if (good.length === 1) return good[0].trim()

  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 30)
  if (lines.length >= 2) return lines.slice(0, 2).join(' ').trim()
  if (lines.length === 1) return lines[0]

  return `This ${docType} document has been processed and analyzed.`
}

function emptyResponse(msg, t0, ocr, fileName = '', fileSize = 0) {
  return {
    success: false,
    document_type: 'general',
    summary: msg,
    entities: {
      persons: [], organizations: [], dates: [], locations: [],
      monetary_amounts: [], emails: [], phone_numbers: [],
      urls: [], skills: [], projects: [], invoice_numbers: [],
    },
    sentiment: { label: 'neutral', confidence: 0 },
    confidence: 0,
    metadata: { ocr_used: ocr, ocr_engine: null, pages_processed: 0, processing_time_ms: Date.now() - t0 },
    extractedText: '',
    fileName,
    fileSize,
  }
}
