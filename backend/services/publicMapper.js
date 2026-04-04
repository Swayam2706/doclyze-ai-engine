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
  // Additional false-positive sources
  'abstract','introduction','conclusion','appendix','figure','table',
  'reference','bibliography','disclaimer','legal','terms','conditions',
  'section','chapter','notice','announcement','subject','invoice',
  'total','subtotal','balance','payment','billing','shipping',
  'safe','drinking','water','copper','rule','act','regulation',
  'compliance','enforcement','violation','penalty','sanction',
  'assistant','administrator','director','officer','manager','coordinator',
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
  return cleanAndFilter(arr, val => {
    if (!/\d/.test(val)) return false
    // Must look like a real date — reject version numbers, IDs, pure numbers
    // Must contain a month name, slash/dash date pattern, or year range
    const hasMonth = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(val)
    const hasSlashDate = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(val)
    const hasISODate = /\d{4}-\d{2}-\d{2}/.test(val)
    const hasYearRange = /\d{4}\s*[–\-—]\s*(\d{4}|present|current)/i.test(val)
    const hasYear = /\b(19|20)\d{2}\b/.test(val)
    return hasMonth || hasSlashDate || hasISODate || hasYearRange || hasYear
  })
}

// Labels that should never be returned as organizations
const ORG_LABEL_BLACKLIST = new Set([
  'bill to','ship to','sold to','billed to','invoice','invoice number',
  'total','subtotal','amount due','grand total','balance due',
  'hosting charges','service charges','item description',
  'quantity','unit price','tax','discount','payment terms',
  'notice','announcement','subject','re','dear','sincerely',
  'contact','references','qualifications','declaration',
  'safe drinking water act','lead and copper rule','clean water act',
  'drinking water','copper rule','safe drinking',
])

function validateOrganizations(arr) {
  return cleanAndFilter(arr, val => {
    if (/^\d/.test(val)) return false
    if (val.split(/\s+/).length > 12) return false
    if (isSectionHeadingLike(val)) return false
    if (/^(built|implemented|developed|designed|created|managed|led|deployed)/i.test(val)) return false
    // Reject known label strings
    if (ORG_LABEL_BLACKLIST.has(val.toLowerCase().trim())) return false
    // Reject if it's a policy/act/rule phrase (not an org name)
    if (/\b(act|rule|regulation|policy|law|code|standard|guideline|directive)\b/i.test(val) &&
        !/\b(inc|corp|llc|ltd|co|group|agency|authority|commission|department|ministry|office|bureau)\b/i.test(val)) {
      return false
    }
    return true
  })
}

function validateAmounts(arr) {
  return cleanAndFilter(arr, val => {
    // Strip label prefixes like "Total: $1,400" → check "$1,400"
    const stripped = val.replace(/^[A-Za-z\s]+:\s*/, '').trim()
    const check = stripped || val
    // Has currency symbol
    if (/[$₹€£¥\u20B9\u20AC\u00A3\u00A5]/.test(check)) return true
    // Has currency code + digits
    if (/\b(USD|INR|EUR|GBP|JPY|AUD|CAD)\b/i.test(check) && /\d/.test(check)) return true
    // Plain decimal amount like "5,750.00" (must have comma or be >3 digits before decimal)
    if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(check.trim())) return true
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
    'abstract', 'introduction', 'conclusion', 'appendix',
    'figure', 'table', 'reference', 'bibliography', 'disclaimer',
    'legal', 'terms', 'conditions', 'notice', 'announcement',
    'bill to', 'ship to', 'sold to', 'invoice', 'total', 'subtotal',
    'amount due', 'grand total', 'balance due', 'payment terms',
    'item description', 'quantity', 'unit price',
  ]
  if (headings.includes(lower)) return true
  // All-caps multi-word line (but not short acronyms like EPA, OCR, USA)
  if (/^[A-Z\s&/\-]+$/.test(val.trim()) && val.trim().length >= 8 && val.trim().length < 35 && val.trim().split(/\s+/).length >= 2) return true
  return false
}

function capitalizeSentiment(label) {
  if (!label || typeof label !== 'string') return 'Neutral'
  const lower = label.toLowerCase()
  if (lower === 'positive') return 'Positive'
  if (lower === 'negative') return 'Negative'
  return 'Neutral'
}
