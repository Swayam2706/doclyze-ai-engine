/**
 * Document type classification — keyword scoring.
 * Optimized for hackathon evaluation across PDF, DOCX, and image inputs.
 */

export function detectDocumentType(text) {
  const lower = text.toLowerCase()
  const s = { resume: 0, invoice: 0, receipt: 0, contract: 0, report: 0, letter: 0, notice: 0, article: 0 }

  const score = (type, words, w = 2) => {
    for (const word of words) {
      if (lower.includes(word)) s[type] += w
    }
  }

  // ── Resume ──────────────────────────────────────────────
  score('resume', [
    'professional summary', 'work experience', 'technical skills',
    'education', 'certifications', 'projects', 'objective',
    'university', 'college', 'bachelor', 'master', 'degree',
    'resume', 'curriculum vitae', 'proficient in', 'responsibilities',
    'core competencies', 'gpa', 'cgpa', 'internship', 'volunteer',
    'references available', 'career objective', 'professional experience',
  ])

  // ── Invoice / Receipt ────────────────────────────────────
  score('invoice', [
    'invoice', 'bill to', 'ship to', 'due date', 'payment terms',
    'subtotal', 'total due', 'amount due', 'purchase order',
    'qty', 'unit price', 'invoice number', 'invoice date',
    'tax invoice', 'proforma', 'billing address',
  ], 3)

  score('receipt', [
    'receipt', 'transaction', 'payment received', 'change due',
    'cashier', 'thank you for your purchase', 'order #', 'store',
    'pos', 'cash register', 'payment method',
  ], 3)

  // ── Contract ─────────────────────────────────────────────
  score('contract', [
    'agreement', 'contract', 'hereby', 'parties', 'obligations',
    'terms and conditions', 'effective date', 'termination',
    'governing law', 'jurisdiction', 'whereas', 'shall', 'indemnify',
    'confidentiality', 'non-disclosure', 'intellectual property',
  ], 3)

  // ── Report / Article ─────────────────────────────────────
  score('report', [
    'executive summary', 'table of contents', 'abstract',
    'methodology', 'findings', 'conclusion', 'recommendation',
    'results', 'analysis', 'overview', 'introduction',
    'background', 'scope', 'objectives', 'key findings',
    'data analysis', 'market analysis', 'financial analysis',
    'performance', 'quarterly', 'annual report', 'research',
    'survey', 'assessment', 'evaluation', 'review',
    'industry', 'sector', 'market', 'trend', 'growth',
    'technology', 'innovation', 'impact', 'challenges',
  ], 2)

  score('article', [
    'according to', 'researchers', 'study shows', 'published',
    'journal', 'conference', 'paper', 'citation', 'references',
    'figure', 'table', 'appendix', 'hypothesis', 'experiment',
  ], 2)

  // ── Notice ───────────────────────────────────────────────
  score('notice', [
    'notice', 'notification', 'hereby notified', 'please be advised',
    'attention', 'important notice', 'public notice', 'official notice',
    'schedule', 'agenda', 'meeting', 'announcement', 'circular',
    'memorandum', 'memo', 'bulletin', 'advisory',
  ], 3)

  // ── Letter ───────────────────────────────────────────────
  score('letter', [
    'dear', 'sincerely', 'regards', 'to whom it may concern',
    'yours faithfully', 'i am writing', 'please find attached',
    'yours truly', 'best regards', 'kind regards', 'respectfully',
    'cover letter', 'application letter', 'reference letter',
  ], 3)

  // ── Structural signals ───────────────────────────────────
  // Long paragraphs → report/article
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 100)
  if (paragraphs.length >= 3) s['report'] += 3

  // Numbered sections → report
  if (/^\s*\d+\.\s+[A-Z]/m.test(text)) s['report'] += 2
  if (/^\s*[IVX]+\.\s+[A-Z]/m.test(text)) s['report'] += 2

  // Merge article into report
  s['report'] += s['article']

  let best = 'general', bestScore = 0
  for (const [type, val] of Object.entries(s)) {
    if (type === 'article') continue // merged into report
    if (val > bestScore) { bestScore = val; best = type }
  }

  return bestScore >= 3 ? best : 'general'
}
