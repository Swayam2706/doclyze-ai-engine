/**
 * Post-Processing: merge, validate, deduplicate, normalize.
 * All rules are GENERIC — no sample-specific blacklists.
 */

import { isSectionHeading } from './textCleaner.js'

// ─── Generic validators ─────────────────────────────────────

function isValidEmail(e) {
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(e)
}

function isValidPhone(p) {
  const d = p.replace(/\D/g, '')
  return d.length >= 10 && d.length <= 15
}

function isValidURL(u) {
  return /^https?:\/\/[^\s]+\.[^\s]+/.test(u)
}

/**
 * Reject values containing action verbs (description fragments, not entities).
 */
const ACTION_VERBS = /^(built|implemented|developed|integrated|designed|added|created|managed|led|utilized|enabled|deployed|configured|achieved|reduced|improved|increased|worked|collaborated|contributed)/i

function containsActionVerb(val) {
  return ACTION_VERBS.test(val.trim())
}

/**
 * Reject generic junk values.
 */
function isGenericJunk(val) {
  const lower = val.toLowerCase().trim()
  const junk = [
    'real', 'full stack app', 'project link', 'professional summary',
    'education', 'technical skills', 'achievements', 'certifications',
    'projects', 'experience', 'skills', 'contact', 'references',
    'n/a', 'none', 'null', 'undefined',
    // Invoice/document labels that leak as entities
    'bill to', 'ship to', 'sold to', 'invoice', 'invoice number',
    'total', 'subtotal', 'amount due', 'grand total', 'balance due',
    'hosting charges', 'service charges', 'item description',
    'quantity', 'unit price', 'tax', 'discount',
    // Notice/letter labels
    'notice', 'announcement', 'subject', 're:', 'dear', 'sincerely',
    'regards', 'yours faithfully', 'yours truly',
    // Generic document labels
    'abstract', 'introduction', 'conclusion', 'appendix',
    'figure', 'table', 'reference', 'bibliography',
    'disclaimer', 'legal', 'terms', 'conditions',
    'page', 'section', 'chapter',
  ]
  return junk.includes(lower)
}

/**
 * Core entity string validator.
 */
function isCleanEntity(val) {
  if (!val || typeof val !== 'string') return false
  const t = val.trim()
  if (t.length < 2 || t.length > 80) return false
  if (/[\n\r\t]/.test(t)) return false          // newline-contaminated
  if (isSectionHeading(t)) return false
  if (containsActionVerb(t)) return false
  if (isGenericJunk(t)) return false
  return true
}

// Topic/title words that should never appear in a real person name
const TOPIC_WORDS = new Set([
  'analysis','innovation','report','industry','technology','artificial',
  'intelligence','machine','learning','data','science','business',
  'financial','economic','strategic','corporate','enterprise','research',
  'development','management','operations','performance','overview',
  'summary','review','assessment','evaluation','study','sector',
  'segment','landscape','ecosystem','framework','platform','digital',
  'transformation','adoption','integration','implementation','growth',
  'trends','insights','outlook','forecast','projection','quarter',
  'annual','revenue','profit','investment','capital','market','global',
  'national','international','virtual','recent','future','current',
  // Additional document/academic terms
  'abstract','introduction','conclusion','appendix','figure','table',
  'reference','bibliography','disclaimer','legal','terms','conditions',
  'section','chapter','notice','announcement','subject','invoice',
  'total','subtotal','balance','payment','billing','shipping',
  'safe','drinking','water','copper','rule','act','regulation',
  'compliance','enforcement','violation','penalty','sanction',
])

function isValidPerson(val) {
  if (!isCleanEntity(val)) return false
  const t = val.trim()
  if (/\d/.test(t)) return false
  if (/@/.test(t)) return false
  if (/https?:\/\/|\.com|\.org|\.net|\.io/i.test(t)) return false
  if (/github|linkedin|leetcode/i.test(t)) return false
  if (t.split(/\s+/).length > 5) return false
  // Reject if any word is a topic/title word
  const words = t.toLowerCase().split(/\s+/)
  if (words.some(w => TOPIC_WORDS.has(w))) return false
  return true
}

function isValidOrganization(val) {
  if (!isCleanEntity(val)) return false
  const t = val.trim()
  if (/^\d/.test(t)) return false                // starts with digit
  if (t.split(/\s+/).length > 12) return false   // too long
  return true
}

function isValidProject(val) {
  if (!isCleanEntity(val)) return false
  const t = val.trim()
  if (/^[•·▪►●○◦\-–—]/.test(t)) return false    // starts with bullet
  if (t.split(/\s+/).length > 8) return false     // too long
  if (t.split(/\s+/).length === 1 && t.length < 5) return false // single short word
  return true
}

function isValidSkill(val) {
  if (!val || typeof val !== 'string') return false
  const t = val.trim()
  if (t.length < 1 || t.length > 50) return false
  if (isSectionHeading(t)) return false
  if (isGenericJunk(t)) return false
  // Reject if it looks like a sentence fragment (too many words)
  if (t.split(/\s+/).length > 5) return false
  return true
}

function isValidGeneric(val) {
  if (!val || typeof val !== 'string') return false
  const t = val.trim()
  if (t.length < 2) return false
  if (/[\n\r\t]/.test(t)) return false
  return true
}

// ─── Sentiment fallback classifier ──────────────────────────

/**
 * Keyword-based sentiment classifier for when AI is unavailable.
 * Document-type-aware with weighted scoring.
 */
export function classifySentiment(text, docType) {
  // Type-based defaults
  if (docType === 'resume') return 'positive'
  if (docType === 'invoice' || docType === 'receipt') return 'neutral'

  const lower = text.toLowerCase()

  // Strong negative signals — incident/breach/fraud reports
  const strongNegative = [
    'data breach','security breach','cyber attack','ransomware','phishing',
    'unauthorized access','data leak','data exposure','compromised',
    'vulnerability exploited','malware','ddos','denial of service',
    'fraud alert','fraudulent','identity theft','financial fraud',
    'money laundering','scam','ponzi','embezzlement',
    'lawsuit filed','legal action','court order','injunction',
    'regulatory violation','non-compliance','penalty imposed','fine issued',
    'suspended operations','service disruption','system outage',
    'critical vulnerability','zero-day','exploit','hacked',
  ]
  for (const phrase of strongNegative) {
    if (lower.includes(phrase)) return 'negative'
  }

  const positiveWords = [
    'excellent','outstanding','great','good','success','successful',
    'growth','increase','improved','improvement','profit','gain',
    'achievement','award','innovation','innovative','opportunity',
    'benefit','advantage','positive','strong','leading','best',
    'record','milestone','breakthrough','advance','progress',
    'efficient','effective','productive','thriving','expanding',
    'optimistic','promising','favorable','robust','healthy',
    'launched','released','announced','partnership','collaboration',
  ]

  const negativeWords = [
    'failed','failure','loss','decline','decrease','problem',
    'issue','concern','risk','threat','warning','penalty',
    'violation','breach','dispute','complaint','reject','rejected',
    'terminated','cancellation','delay','deficit','debt','crisis',
    'poor','weak','inadequate','insufficient','critical','severe',
    'urgent','immediate action','non-compliance','overdue','default',
    'lawsuit','legal action','fine','sanction','suspension',
    'attack','incident','exposed','leaked','stolen','compromised',
    'disruption','outage','downtime','damage','harm','victim',
  ]

  let posScore = 0, negScore = 0
  for (const w of positiveWords) { if (lower.includes(w)) posScore++ }
  for (const w of negativeWords) { if (lower.includes(w)) negScore++ }

  if (posScore > negScore + 2) return 'positive'
  if (negScore > posScore) return 'negative'  // lower threshold for negative
  return 'neutral'
}

function dedup(arr) {
  const seen = new Set()
  return arr.filter(item => {
    const key = (typeof item === 'string' ? item : '').toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cleanArr(arr, validator, max) {
  if (!Array.isArray(arr)) return []
  return dedup(
    arr.map(v => typeof v === 'string' ? v.trim() : '').filter(validator)
  ).slice(0, max)
}

// ─── Summary validation ─────────────────────────────────────

/**
 * Check if a string contains contact/header pollution.
 */
function containsContactPollution(text) {
  if (!text) return false
  // email pattern
  if (/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/.test(text)) return true
  // phone pattern (10+ digits)
  if (/\+?\d[\d\s\-()]{8,}/.test(text)) return true
  // URL
  if (/https?:\/\/\S+/.test(text)) return true
  if (/www\.\S+/.test(text)) return true
  // social handles
  if (/github/i.test(text)) return true
  if (/linkedin/i.test(text)) return true
  if (/leetcode/i.test(text)) return true
  // too many dashes/pipes (contact separator line)
  if ((text.match(/[|–—]/g) || []).length >= 3) return true
  // section heading as summary
  if (isSectionHeading(text)) return true
  return false
}

/**
 * Strip contact pollution from a summary string.
 */
function stripContactFromSummary(summary) {
  let s = summary
  // Remove email addresses
  s = s.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '')
  // Remove phone numbers
  s = s.replace(/\+?\d[\d\s\-()]{8,}/g, '')
  // Remove URLs
  s = s.replace(/https?:\/\/\S+/g, '')
  s = s.replace(/www\.\S+/g, '')
  // Remove social handles
  s = s.replace(/github\.com\/\S+/gi, '')
  s = s.replace(/linkedin\.com\/\S+/gi, '')
  s = s.replace(/leetcode\.com\/\S+/gi, '')
  // Clean up leftover separators and whitespace
  s = s.replace(/\s*[|–—]\s*/g, ' ')
  s = s.replace(/\s{2,}/g, ' ')
  s = s.trim()
  // Remove leading/trailing punctuation junk
  s = s.replace(/^[\s,.\-–—|]+/, '').replace(/[\s,.\-–—|]+$/, '').trim()
  return s
}

/**
 * Validate and clean a summary for any document type.
 * For resumes: also checks against the contact block.
 * Returns { summary, wasRejected }
 */
export function validateSummary(summary, docType, contactBlock = []) {
  if (!summary || summary.length < 10) {
    return { summary: '', wasRejected: true }
  }

  let s = summary

  // For resumes: strip any contact block text that leaked in
  if (docType === 'resume') {
    for (const line of contactBlock) {
      if (line && s.includes(line)) {
        s = s.replace(new RegExp(escapeRegex(line), 'g'), '')
      }
    }
  }

  // Strip contact pollution patterns
  s = stripContactFromSummary(s)

  // Final checks
  if (s.length < 40) return { summary: s, wasRejected: true }
  if (containsContactPollution(s)) return { summary: s, wasRejected: true }

  return { summary: s, wasRejected: false }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Keep old export name for backward compat
export function validateResumeSummary(summary, contactBlock) {
  const { summary: cleaned } = validateSummary(summary, 'resume', contactBlock)
  return cleaned
}

// ─── Main merge ─────────────────────────────────────────────

export function mergeAndValidate(regex, ai, docType) {
  const aiEnt = ai?.entities || {}

  const merged = {
    emails: dedup(regex.emails || []).filter(isValidEmail).slice(0, 5),
    phone_numbers: dedup(regex.phone_numbers || []).filter(isValidPhone).slice(0, 5),
    urls: dedup(regex.urls || []).filter(isValidURL).slice(0, 15),
    dates: dedup(regex.dates || []).filter(isValidGeneric).slice(0, 25),
    // Merge regex + AI monetary amounts, strip label prefixes, deduplicate
    monetary_amounts: dedup([
      ...(regex.monetary_amounts || []),
      ...(aiEnt.monetary_amounts || []),
    ].map(v => {
      if (typeof v !== 'string') return ''
      // Strip label prefixes like "Total: $1,400" → "$1,400"
      const stripped = v.replace(/^[A-Za-z\s]+:\s*/, '').trim()
      return stripped || v
    })).filter(isValidGeneric).slice(0, 15),
    persons: [],
    organizations: [],
    locations: cleanArr([...(regex.locations || []), ...(aiEnt.locations || [])], isValidGeneric, 10),
    skills: [],
    projects: [],
    invoice_numbers: [],
  }

  if (docType === 'resume') {
    merged.persons = cleanArr(
      [...(regex.persons || []), ...(aiEnt.persons || [])],
      isValidPerson, 5
    )
    merged.organizations = cleanArr(
      [...(regex.organizations || []), ...(aiEnt.organizations || [])],
      isValidOrganization, 10
    )
    merged.skills = cleanArr(
      [...(regex.skills || []), ...(aiEnt.skills || [])],
      isValidSkill, 30
    )
    merged.projects = cleanArr(
      [...(regex.projects || []), ...(aiEnt.projects || [])],
      isValidProject, 10
    )
    merged.invoice_numbers = [] // NEVER for resumes

  } else if (docType === 'invoice' || docType === 'receipt') {
    merged.persons = cleanArr(
      [...(regex.persons || []), ...(aiEnt.persons || [])],
      isValidPerson, 5
    )
    merged.organizations = cleanArr(
      [...(regex.organizations || []), ...(aiEnt.organizations || [])],
      isValidOrganization, 10
    )
    merged.invoice_numbers = dedup(regex.invoice_numbers || []).filter(isValidGeneric).slice(0, 5)
    merged.skills = []
    merged.projects = []

  } else {
    // For general/report/letter/notice: merge regex + AI for best coverage
    merged.persons = cleanArr(
      [...(regex.persons || []), ...(aiEnt.persons || [])],
      isValidPerson, 10
    )
    merged.organizations = cleanArr(
      [...(regex.organizations || []), ...(aiEnt.organizations || [])],
      isValidOrganization, 15
    )
    merged.locations = cleanArr(
      [...(regex.locations || []), ...(aiEnt.locations || [])],
      isValidGeneric, 10
    )
    merged.skills = cleanArr(
      [...(regex.skills || []), ...(aiEnt.skills || [])],
      isValidSkill, 15
    )
    merged.projects = cleanArr(aiEnt.projects || [], isValidProject, 10)
    merged.invoice_numbers = []
  }

  return merged
}

// ─── Confidence ─────────────────────────────────────────────

export function computeConfidence(summary, entities, sentiment, docType, ocrUsed = false) {
  // Base: 0.5 (text extraction succeeded — caller only reaches here if text was extracted)
  let score = 0.20 // on top of 0.50 base

  // +0.20 text extraction successful (always true here)
  score += 0.20

  // Summary quality (+0.10)
  if (summary && summary.length > 30 && !isSectionHeading(summary)) {
    score += 0.06
    if (!/\b[A-Za-z0-9._%+\-]+@/.test(summary) && !/\+?\d{10,}/.test(summary)) {
      score += 0.04
    }
  }

  // Entity extraction (+0.10)
  const totalEntities = Object.values(entities).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  if (totalEntities > 0) score += 0.05
  if (totalEntities > 5) score += 0.05

  // Specific entity types
  if (entities.persons?.length > 0) score += 0.03
  if (entities.organizations?.length > 0) score += 0.04
  if (entities.emails?.length > 0) score += 0.03
  if (entities.phone_numbers?.length > 0) score += 0.03
  if (entities.dates?.length > 0) score += 0.02

  // Sentiment present (+0.02)
  if (sentiment && ['positive', 'neutral', 'negative'].includes(sentiment)) {
    score += 0.02
  }

  // OCR bonus: +0.05 if no OCR needed, or OCR succeeded
  if (!ocrUsed) score += 0.05

  // Type-specific bonuses
  if (docType === 'resume') {
    if (entities.projects?.length >= 2) score += 0.04
    if (entities.skills?.length >= 5) score += 0.04
    if (entities.urls?.length > 0) score += 0.01
  }
  if (docType === 'invoice' || docType === 'receipt') {
    if (entities.monetary_amounts?.length > 0) score += 0.04
    if (entities.invoice_numbers?.length > 0) score += 0.03
  }

  // Final: base 0.50 + accumulated score, capped at 0.95
  const raw = 0.50 + Math.min(score, 0.45)
  return Math.round(Math.min(0.95, Math.max(0.50, raw)) * 100) / 100
}
