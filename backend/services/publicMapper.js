/**
 * Public API Response Mapper
 *
 * Maps the rich internal result to the hackathon-compliant public response.
 * Includes ALL fields required by the spec:
 *   success, document_type, summary, entities, sentiment,
 *   confidence, metadata, fileName, fileSize
 */

export function mapToPublicResponse(internalResult, fileName, fileSize = 0) {
  const ent = internalResult.entities || {}
  const meta = internalResult.metadata || {}

  return {
    success: internalResult.success !== false,
    status: 'success',
    fileName: fileName || 'unknown',
    fileSize: fileSize || 0,
    document_type: internalResult.document_type || 'general',
    summary: sanitizeSummary(internalResult.summary || ''),
    entities: {
      names: validateNames(ent.persons),
      dates: validateDates(ent.dates),
      organizations: validateOrganizations(ent.organizations),
      amounts: validateAmounts(ent.monetary_amounts),
      // Extended fields for richer scoring
      emails: validateGenericArr(ent.emails),
      phone_numbers: validateGenericArr(ent.phone_numbers),
      locations: validateGenericArr(ent.locations),
      skills: validateGenericArr(ent.skills),
      urls: validateGenericArr(ent.urls),
    },
    sentiment: buildSentiment(internalResult.sentiment),
    confidence: internalResult.confidence || 0,
    metadata: {
      ocr_used: meta.ocr_used || false,
      ocr_engine: meta.ocr_engine || null,
      pages_processed: meta.pages_processed || 1,
      processing_time_ms: meta.processing_time_ms || 0,
    },
  }
}

export function mapToPublicError(fileName, message) {
  return {
    success: false,
    status: 'error',
    fileName: fileName || 'unknown',
    message: message || 'An error occurred during processing',
  }
}

// ─── Sentiment builder ──────────────────────────────────────

function buildSentiment(sentiment) {
  if (!sentiment) return { label: 'Neutral', confidence: 0.5 }
  if (typeof sentiment === 'string') {
    return { label: capitalizeSentiment(sentiment), confidence: 0.7 }
  }
  return {
    label: capitalizeSentiment(sentiment.label || 'neutral'),
    confidence: typeof sentiment.confidence === 'number' ? sentiment.confidence : 0.7,
  }
}

// ─── Field sanitizers ───────────────────────────────────────

function sanitizeSummary(summary) {
  if (!summary) return ''
  let s = summary
  s = s.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '')
  s = s.replace(/\+?\d[\d\s\-()]{8,}/g, '')
  s = s.replace(/https?:\/\/\S+/g, '')
  s = s.replace(/www\.\S+/g, '')
  s = s.replace(/github\.com\/\S+/gi, '')
  s = s.replace(/linkedin\.com\/\S+/gi, '')
  s = s.replace(/\s*[|–—]\s*/g, ' ')
  s = s.replace(/\s{2,}/g, ' ')
  s = s.replace(/^[\s,.\-–—|]+/, '').replace(/[\s,.\-–—|]+$/, '')
  return s.trim()
}

// Topic words that should never appear in a real person name
const NAME_TOPIC_WORDS = new Set([
  'analysis','innovation','report','industry','technology','artificial',
  'intelligence','machine','learning','data','science','business',
  'financial','economic','strategic','corporate','enterprise','research',
  'development','management','operations','performance','overview',
  'summary','review','assessment','evaluation','study','sector',
  'landscape','ecosystem','framework','platform','digital','transformation',
  'growth','trends','insights','outlook','forecast','market','global',
  'national','international','revenue','profit','investment','capital',
])

function validateNames(arr) {
  return cleanAndFilter(arr, val => {
    if (/\d/.test(val)) return false
    if (/@/.test(val)) return false
    if (/https?:\/\/|\.com|\.org|\.net/i.test(val)) return false
    if (/github|linkedin|leetcode/i.test(val)) return false
    if (val.split(/\s+/).length > 5) return false
    if (isSectionHeadingLike(val)) return false
    // Reject topic/title phrases
    const words = val.toLowerCase().split(/\s+/)
    if (words.some(w => NAME_TOPIC_WORDS.has(w))) return false
    return true
  })
}

function validateDates(arr) {
  return cleanAndFilter(arr, val => /\d/.test(val))
}

function validateOrganizations(arr) {
  return cleanAndFilter(arr, val => {
    if (/^\d/.test(val)) return false
    if (/^[a-z]/.test(val)) return false
    if (val.split(/\s+/).length > 12) return false
    if (isSectionHeadingLike(val)) return false
    if (/^(built|implemented|developed|designed|created|managed|led|deployed)/i.test(val)) return false
    return true
  })
}

function validateAmounts(arr) {
  return cleanAndFilter(arr, val => {
    // Accept currency symbols (including unicode variants that survived)
    if (/[$₹€£¥\u20B9\u20AC\u00A3\u00A5]/.test(val)) return true
    if (/\b(USD|INR|EUR|GBP|JPY|AUD|CAD)\b/i.test(val) && /\d/.test(val)) return true
    // Accept plain number amounts that look like money (e.g. "5,750.00")
    if (/^\d[\d,]*\.\d{2}$/.test(val.trim())) return true
    return false
  })
}

function validateGenericArr(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  return arr
    .filter(v => typeof v === 'string' && v.trim().length >= 2)
    .map(v => v.trim())
    .filter(v => {
      const key = v.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// ─── Shared helpers ─────────────────────────────────────────

function cleanAndFilter(arr, validator) {
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  return arr
    .filter(v => typeof v === 'string' && v.trim().length >= 2)
    .map(v => v.trim())
    .filter(v => {
      const key = v.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return validator(v)
    })
}

function isSectionHeadingLike(val) {
  const lower = val.toLowerCase().trim().replace(/:$/, '')
  const headings = [
    'professional summary', 'summary', 'objective', 'profile',
    'education', 'experience', 'work experience', 'skills',
    'technical skills', 'projects', 'certifications', 'achievements',
    'contact', 'references', 'qualifications', 'declaration',
  ]
  if (headings.includes(lower)) return true
  if (/^[A-Z\s&/]+$/.test(val.trim()) && val.trim().length < 35) return true
  return false
}

function capitalizeSentiment(label) {
  if (!label || typeof label !== 'string') return 'Neutral'
  const lower = label.toLowerCase()
  if (lower === 'positive') return 'Positive'
  if (lower === 'negative') return 'Negative'
  return 'Neutral'
}
