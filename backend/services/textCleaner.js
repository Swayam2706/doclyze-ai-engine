/**
 * Text Cleaning & Preprocessing
 */

/**
 * Normalize raw extracted text for all document types.
 */
export function cleanText(raw) {
  if (!raw) return ''
  let t = raw
  t = t.replace(/(\w)-\s*[\r\n]+\s*(\w)/g, '$1$2')   // fix broken hyphenated words
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n')    // normalize line endings
  t = t.replace(/^[\-=_*~|#]{3,}$/gm, '')              // remove separator lines
  t = t.replace(/^\s*Page\s+\d+\s*(of\s+\d+)?\s*$/gim, '') // remove page numbers
  t = t.replace(/\n{3,}/g, '\n\n')                      // collapse blank lines
  t = t.replace(/[^\S\n]+/g, ' ')                       // collapse spaces (keep newlines)
  // OCR-specific noise removal — preserve currency symbols and common unicode
  // Keep: printable ASCII + currency (₹€£¥₩₦) + em/en dash + smart quotes
  t = t.replace(/[^\x20-\x7E\u20A0-\u20CF\u00A2-\u00A5\u2013\u2014\u2018\u2019\u201C\u201D\n\r\t]/g, ' ')
  t = t.replace(/\b([a-z])([A-Z])\b/g, '$1 $2')        // fix merged words like "theDocument"
  t = t.replace(/\s{2,}/g, ' ')                         // final space collapse
  t = t.split('\n').map(l => l.trim()).join('\n').trim()
  return t
}

// ─── Resume-specific contact block extraction ───────────────

/**
 * Detect whether a line is part of a contact header block.
 */
function isContactLine(line) {
  const t = line.trim()
  if (!t) return false
  // pure email
  if (/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(t)) return true
  // pure phone
  if (/^\+?\d[\d\s\-()]{8,}$/.test(t)) return true
  // pure URL or domain link
  if (/^https?:\/\//i.test(t) && t.split(/\s+/).length <= 2) return true
  // bare domain links (github.com/x, linkedin.com/in/x, leetcode.com/u/x)
  if (/^[a-z0-9\-]+\.(com|org|net|io)\//i.test(t) && t.split(/\s+/).length <= 2) return true
  // line containing email + phone + links separated by pipes/dashes (combined contact line)
  if (/@/.test(t) && /\d{10,}/.test(t.replace(/\D/g, ''))) return true
  // line that is mostly separators, pipes, dashes with contact fragments
  if ((t.match(/[|–—·•]/g) || []).length >= 2 && (/@/.test(t) || /github|linkedin|leetcode/i.test(t))) return true
  // line containing github/linkedin/leetcode handle
  if (/github|linkedin|leetcode/i.test(t) && t.split(/\s+/).length <= 5) return true
  return false
}

function isNameLine(line, index) {
  const t = line.trim()
  if (index > 2) return false
  if (!t || t.length < 3) return false
  if (/\d/.test(t)) return false
  if (/@/.test(t)) return false
  if (/https?:\/\/|\.com|\.org|\.net|\.io/i.test(t)) return false
  if (t.split(/\s+/).length > 4) return false
  if (t.split(/\s+/).length < 2) return false
  return true
}

/**
 * Extract the contact block from the top of a resume.
 * Returns { contactBlock: string[], bodyText: string }
 */
export function extractContactBlock(cleaned) {
  const lines = cleaned.split('\n')
  const contactLines = []
  let bodyStart = 0

  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i].trim()
    if (!line) { contactLines.push(''); continue }
    if (isContactLine(line) || isNameLine(line, i)) {
      contactLines.push(line)
      bodyStart = i + 1
    } else {
      break
    }
  }

  const bodyText = lines.slice(bodyStart).join('\n')
  return { contactBlock: contactLines.filter(Boolean), bodyText }
}

// ─── Section heading detection ──────────────────────────────

const SECTION_HEADINGS = new Set([
  'professional summary', 'summary', 'objective', 'profile',
  'education', 'academic background', 'experience', 'work experience',
  'employment history', 'skills', 'technical skills', 'core competencies',
  'key skills', 'projects', 'personal projects', 'academic projects',
  'certifications', 'certificates', 'achievements', 'awards',
  'references', 'contact', 'contact information', 'languages',
  'interests', 'hobbies', 'qualifications', 'declaration',
  'additional information', 'about me', 'about',
])

export function isSectionHeading(line) {
  const t = line.trim()
  if (t.length > 50 || t.length < 2) return false
  const lower = t.toLowerCase().replace(/:$/, '')
  if (SECTION_HEADINGS.has(lower)) return true
  // All-caps short line
  if (/^[A-Z\s&/]+$/.test(t) && t.length < 35 && t.length > 2) return true
  return false
}

/**
 * Prepare text for AI summary generation.
 * Strips contact block, section headings, and contact-pattern lines.
 * For resumes: aggressive cleaning to ensure summary is body-only.
 */
export function prepareForAI(cleaned, docType) {
  if (docType === 'resume') {
    const { bodyText } = extractContactBlock(cleaned)
    const lines = bodyText.split('\n').filter(l => l.trim())
    const filtered = lines.filter(line => {
      const t = line.trim()
      // Remove section headings
      if (isSectionHeading(t)) return false
      // Remove any remaining contact-pattern lines in body
      if (/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(t)) return false
      if (/^\+?\d[\d\s\-()]{8,}$/.test(t)) return false
      if (/^https?:\/\//i.test(t) && t.split(/\s+/).length <= 2) return false
      if (/github\.com|linkedin\.com|leetcode\.com/i.test(t) && t.split(/\s+/).length <= 3) return false
      // Remove lines that are mostly separators
      if (/^[\s|–—\-•·,]+$/.test(t)) return false
      return true
    })
    return filtered.join('\n').substring(0, 4500)
  }

  // For non-resume types: light cleanup only
  const lines = cleaned.split('\n').filter(l => l.trim())
  return lines.join('\n').substring(0, 4500)
}
