/**
 * Deterministic Entity Extraction — regex & rules.
 * Authoritative for: emails, phones, URLs, dates, money, invoice numbers.
 * Type-specific logic for: persons, skills, projects, organizations.
 * All rules are GENERIC — no sample-specific values.
 */

import { isSectionHeading, extractContactBlock } from './textCleaner.js'

// ─── Universal extractors ───────────────────────────────────

function extractEmails(text) {
  const m = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g) || []
  return [...new Set(m.map(e => e.toLowerCase()))]
}

function extractPhones(text) {
  const out = new Set()
  const pats = [
    /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g,
  ]
  for (const p of pats) {
    for (const m of text.matchAll(p)) {
      const digits = m[0].replace(/\D/g, '')
      if (digits.length >= 10 && digits.length <= 15) out.add(m[0].trim())
    }
  }
  return [...out]
}

function extractURLs(text) {
  const full = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]),;]+/gi) || []
  const bare = text.match(/(?:[a-z0-9\-]+\.)+[a-z]{2,}\/[\w\-./]+/gi) || []
  const normalized = bare.filter(u => !u.startsWith('http')).map(u => 'https://' + u)
  return [...new Set([...full, ...normalized])].slice(0, 15)
}

function extractDates(text) {
  const out = new Set()
  const pats = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/gi,
    /\b\d{4}\s*[–\-—]\s*(?:\d{4}|[Pp]resent|[Cc]urrent)\b/g,
    /\b(?:20|19)\d{2}\b/g,
  ]
  for (const p of pats) {
    for (const m of text.matchAll(p)) out.add(m[0].trim())
  }
  return [...out].slice(0, 25)
}

function extractMoney(text) {
  const pats = [
    // ASCII dollar + unicode currency symbols (?���?)
    /[$\u20B9\u20AC\u00A3\u00A5\u20A9]\s?[\d,]+(?:\.\d{1,2})?/g,
    // Currency codes
    /(?:USD|INR|EUR|GBP|JPY|AUD|CAD)\s?[\d,]+(?:\.\d{1,2})?/gi,
    // Plain amounts with currency word context
    /(?:Rs\.?|INR)\s?[\d,]+(?:\.\d{1,2})?/gi,
    // Amounts like "5,750.00" that appear near Total/Amount labels
    /(?:Total|Amount|Due|Subtotal|Tax|Price|Cost|Fee|Charge|Balance)[:\s]+[$\u20B9\u20AC\u00A3\u00A5]?\s?[\d,]+(?:\.\d{1,2})?/gi,
  ]
  const out = new Set()
  for (const p of pats) {
    for (const m of text.matchAll(p)) {
      const val = m[0].trim()
      if (/\d/.test(val)) out.add(val)
    }
  }
  return [...out].slice(0, 15)
}

function extractInvoiceNumbers(text) {
  const pats = [
    /\b(?:INV|INVOICE|Invoice)[#\-:\s]*[\w\-]+/gi,
    /\b(?:PO|P\.O\.)[#\-:\s]*[\w\-]+/gi,
    /\b(?:Order|Ref|Reference)\s*(?:#|No\.?|Number)?\s*:?\s*[\w\-]+/gi,
    /\b(?:Receipt)\s*(?:#|No\.?|Number)?\s*:?\s*[\w\-]+/gi,
  ]
  const out = new Set()
  for (const p of pats) {
    for (const m of text.matchAll(p)) out.add(m[0].trim())
  }
  return [...out].slice(0, 5)
}

// ─── Resume: person name ────────────────────────────────────

function extractPersonName(rawText) {
  const { contactBlock } = extractContactBlock(rawText)
  // The person name is the first contact-block line that is a name
  for (const line of contactBlock) {
    const t = line.trim()
    if (/\d/.test(t)) continue
    if (/@/.test(t)) continue
    if (/https?:\/\/|\.com|\.org|\.net|\.io/i.test(t)) continue
    if (t.split(/\s+/).length > 5 || t.split(/\s+/).length < 2) continue
    if (isSectionHeading(t)) continue
    return t
  }
  return null
}

// ─── Resume: skills from labeled sections ───────────────────

function extractSkillsFromSections(text) {
  const lines = text.split('\n')
  const skills = new Set()
  let inSkillSection = false

  const skillHeaders = [
    'technical skills', 'skills', 'core competencies', 'key skills',
    'technologies', 'tools', 'frameworks',
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase().replace(/:$/, '')

    // Detect skill section start
    if (skillHeaders.some(h => lower === h || lower.startsWith(h + ' '))) {
      inSkillSection = true
      const afterColon = line.split(':').slice(1).join(':').trim()
      if (afterColon) splitSkillLine(afterColon).forEach(s => skills.add(s))
      continue
    }

    if (inSkillSection) {
      // Stop at next non-skill section heading
      if (isSectionHeading(line)) { inSkillSection = false; continue }
      if (line === '') continue

      // Detect labeled sub-lines like "Languages: Java, C++"
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0 && colonIdx < 30) {
        const label = line.substring(0, colonIdx).trim().toLowerCase()
        const validLabels = [
          'languages', 'core', 'frontend', 'backend', 'databases',
          'tools', 'frameworks', 'devops', 'cloud', 'testing',
          'other', 'programming', 'web', 'mobile',
        ]
        if (validLabels.some(v => label.includes(v))) {
          splitSkillLine(line.substring(colonIdx + 1)).forEach(s => skills.add(s))
          continue
        }
      }

      // Otherwise treat entire line as comma-separated skills
      splitSkillLine(line).forEach(s => skills.add(s))
    }
  }

  return [...skills].filter(s => s.length > 1 && s.length < 50)
}

function splitSkillLine(line) {
  return line
    .split(/[,|;\u2022\u00B7\u25AA\u25BA\u25CF\u25CB\u25E6]/)
    .map(s => s.replace(/^\s*[-\u2013\u2014\u2015]\s*/, '').trim())
    .filter(s => s.length > 1 && s.length < 50)
    .filter(s => !isSectionHeading(s))
}

// ─── Resume: projects from Projects section ─────────────────

function extractProjectsFromSection(text) {
  const lines = text.split('\n')
  let inProjectSection = false
  const projects = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase().replace(/:$/, '')

    // Detect project section start
    if (['projects', 'personal projects', 'academic projects'].includes(lower)) {
      inProjectSection = true
      continue
    }

    if (inProjectSection) {
      // Stop at next major section
      if (isSectionHeading(line) && !lower.includes('project')) {
        inProjectSection = false
        continue
      }
      if (line === '') continue

      // Skip bullet-point description lines
      if (/^[\u2022\u00B7\u25AA\u25BA\u25CF\u25CB\u25E6]/.test(line)) continue
      // Skip lines starting with action verbs (descriptions, not titles)
      if (/^(Developed|Built|Created|Designed|Implemented|Used|Integrated|Managed|Led|Added|Utilized|Enabled|Deployed|Configured|Achieved|Reduced|Improved|Increased|Worked|Collaborated|Contributed)\b/i.test(line)) continue

      // Try to extract title from "Title – Description" pattern
      const dashMatch = line.match(/^(.+?)\s*[–—\-|]\s*.+/)
      if (dashMatch) {
        const title = cleanProjectTitle(dashMatch[1])
        if (title) { projects.push(title); continue }
      }

      // Short capitalized line = potential standalone title
      if (line.length > 3 && line.length < 80 && /^[A-Z]/.test(line) && line.split(/\s+/).length <= 7) {
        const title = cleanProjectTitle(line)
        if (title) projects.push(title)
      }
    }
  }

  return [...new Set(projects)].slice(0, 10)
}

function cleanProjectTitle(raw) {
  let t = raw.trim()
  t = t.replace(/\s*Project\s*Link\s*$/i, '')
  t = t.replace(/\s*https?:\/\/\S+/g, '')
  t = t.replace(/[\s\-\u2013\u2014|]+$/, '')
  t = t.trim()
  if (t.length < 3 || t.length > 80) return null
  if (isSectionHeading(t)) return null
  if (t.split(/\s+/).length === 1 && t.length < 8) return null
  return t
}
function extractOrganizations(text) {
  const out = new Set()
  const pats = [
    /(?:University|Institute|College|School|Academy)\s+(?:of\s+)?[A-Z][\w\s,]+/gi,
    /[A-Z][\w\s]+ (?:University|Institute|College|School|Academy)/gi,
  ]
  for (const p of pats) {
    for (const m of text.matchAll(p)) {
      let org = m[0].trim()
      // Clean: remove leading digits/noise
      org = org.replace(/^\d+\s*/, '')
      // Remove trailing year or city merged without space (e.g. "Pune2023")
      org = org.replace(/\d{4,}$/, '').trim()
      // Remove trailing comma + city fragment
      org = org.replace(/,\s*$/, '').trim()
      if (org.length > 5 && org.length < 100 && !isSectionHeading(org)) {
        out.add(org)
      }
    }
  }
  return [...out].slice(0, 10)
}

// ─── Main export ────────────────────────────────────────────

export function extractDeterministicEntities(rawText, cleanedText, docType) {
  const common = {
    emails: extractEmails(rawText),
    phone_numbers: extractPhones(rawText),
    urls: extractURLs(rawText),
    dates: extractDates(cleanedText),
    monetary_amounts: extractMoney(rawText),
  }

  if (docType === 'resume') {
    const personName = extractPersonName(rawText)
    return {
      ...common,
      persons: personName ? [personName] : [],
      organizations: extractOrganizations(cleanedText),
      skills: extractSkillsFromSections(cleanedText),
      projects: extractProjectsFromSection(cleanedText),
      invoice_numbers: [],
      locations: [],
    }
  }

  if (docType === 'invoice' || docType === 'receipt') {
    return {
      ...common,
      persons: extractGeneralPersons(rawText),
      organizations: extractInvoiceOrganizations(rawText),
      skills: [],
      projects: [],
      invoice_numbers: extractInvoiceNumbers(rawText),
      locations: extractLocations(rawText),
    }
  }

  // contract, report, letter, general — use AI + regex for persons/orgs
  return {
    ...common,
    persons: extractGeneralPersons(rawText),
    organizations: extractGeneralOrganizations(rawText),
    skills: extractTechKeywords(rawText),
    projects: [],
    invoice_numbers: [],
    locations: extractLocations(rawText),
  }
}

/**
 * Extract organizations from invoices/receipts.
 * Looks for vendor/client names near billing labels.
 */
function extractInvoiceOrganizations(text) {
  const out = new Set()

  // Labeled patterns: "Bill To: Acme Corp", "From: Nexus Ltd"
  const labelPats = [
    /(?:Bill\s+To|Billed\s+To|Client|Customer|Sold\s+To)[:\s]+([A-Z][A-Za-z0-9\s&.,'-]{2,50})/gi,
    /(?:From|Vendor|Supplier|Issued\s+By|Company)[:\s]+([A-Z][A-Za-z0-9\s&.,'-]{2,50})/gi,
    /(?:Ship\s+To|Deliver\s+To)[:\s]+([A-Z][A-Za-z0-9\s&.,'-]{2,50})/gi,
  ]
  for (const p of labelPats) {
    for (const m of text.matchAll(p)) {
      const val = (m[1] || '').trim().replace(/[,.\s]+$/, '')
      if (val.length > 2 && val.length < 80 && /^[A-Z]/.test(val)) out.add(val)
    }
  }

  // Company suffix patterns
  const suffixPats = [
    /[A-Z][A-Za-z\s&]+ (?:Inc|Corp|LLC|Ltd|Co|Limited|Group|Holdings|Technologies|Solutions|Services|Systems|Pvt|Private)\.?/g,
    /[A-Z][A-Za-z\s]+ (?:Authority|Department|Ministry|Commission|Agency|Bureau|Office)/g,
  ]
  for (const p of suffixPats) {
    for (const m of text.matchAll(p)) {
      const org = m[0].trim().replace(/^\d+\s*/, '').replace(/\d{4,}$/, '').trim()
      if (org.length > 4 && org.length < 80 && !isSectionHeading(org)) out.add(org)
    }
  }

  return [...out].filter(o => o.length > 2 && o.length < 80 && !/^\d/.test(o)).slice(0, 8)
}

/**
 * Extract person names from general documents.
 * Looks for 2-3 capitalized word sequences.
 */
function extractGeneralOrganizations(text) {
  const out = new Set()

  // Strategy 1: Known organization name scan
  const knownOrgs = [
    'Google','Microsoft','Apple','Amazon','Meta','Facebook','Netflix','Tesla',
    'NVIDIA','Intel','AMD','Qualcomm','IBM','Oracle','Salesforce','Adobe',
    'SAP','Cisco','Dell','HP','Lenovo','Samsung','Sony','LG',
    'OpenAI','Anthropic','DeepMind','Hugging Face','Stability AI','Cohere','Mistral',
    'AWS','Azure','GCP','Cloudflare','Snowflake','Databricks',
    'Goldman Sachs','JPMorgan','Morgan Stanley','BlackRock','Visa','Mastercard',
    'PayPal','Stripe','Square','McKinsey','Deloitte','Accenture','PwC','KPMG','EY',
    'Gartner','Forrester','IDC','Toyota','BMW','Mercedes','Ford','GM','Volkswagen',
    'SpaceX','Boeing','Airbus','Lockheed','AT&T','Verizon','T-Mobile','Comcast',
    'Disney','Twitter','LinkedIn','Uber','Lyft','Airbnb','Walmart','Target',
    'Pfizer','Moderna','AstraZeneca','TSMC','Broadcom','Micron',
    'United Nations','World Bank','IMF','WHO','NATO','European Union','Federal Reserve',
  ]
  for (const org of knownOrgs) {
    const escaped = org.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp('\\b' + escaped + '\\b', 'i')
    if (regex.test(text)) {
      const match = text.match(regex)
      out.add(match ? match[0] : org)
    }
  }

  // Strategy 2: Context-phrase extraction — handles "X, Y, and Z" lists
  const contextPatterns = [
    /(?:companies|firms|organizations|corporations|brands|players|giants|vendors|providers|platforms)\s+(?:such as|including|like|namely|as|:)\s+([A-Z][A-Za-z0-9\s&,.']+?)(?:\.|,\s+(?:which|are|have|were)|$)/gi,
    /(?:including|such as|like|namely)\s+([A-Z][A-Za-z0-9\s&,.']+?)(?:\s+(?:which|are|have|were|to|in|for|with|by)|[.;]|$)/gi,
  ]
  for (const p of contextPatterns) {
    for (const m of text.matchAll(p)) {
      const raw = (m[1] || m[0]).trim()
      // Split on comma and " and " to catch all items in a list
      const parts = raw.split(/,\s*(?:and\s+)?|\s+and\s+/)
      for (const part of parts) {
        const cleaned = part.trim().replace(/[.,;:]+$/, '').trim()
        if (cleaned.length > 1 && cleaned.length < 60 && /^[A-Z]/.test(cleaned)) {
          out.add(cleaned)
        }
      }
    }
  }

  // Strategy 2b: Inline list pattern — "Google, Microsoft, and NVIDIA"
  // Catches comma-separated org lists anywhere in text
  const listPattern = /\b([A-Z][A-Za-z0-9]+)(?:,\s*([A-Z][A-Za-z0-9]+))+(?:,?\s+and\s+([A-Z][A-Za-z0-9]+))?/g
  for (const m of text.matchAll(listPattern)) {
    // Only process if all items are known orgs or short single words (likely org names)
    const fullMatch = m[0]
    const items = fullMatch.split(/,\s*(?:and\s+)?|\s+and\s+/).map(s => s.trim()).filter(Boolean)
    // Check if at least one item is a known org — if so, add all
    const hasKnownOrg = items.some(item => knownOrgs.some(k => k.toLowerCase() === item.toLowerCase()))
    if (hasKnownOrg) {
      for (const item of items) {
        const clean = item.replace(/[.,;:]+$/, '').trim()
        if (clean.length > 1 && /^[A-Z]/.test(clean)) out.add(clean)
      }
    }
  }

  // Strategy 3: Company suffix patterns
  const suffixPats = [
    /[A-Z][A-Za-z\s&]+ (?:Inc|Corp|LLC|Ltd|Co|Limited|Group|Holdings|Technologies|Solutions|Services|Systems|Pvt|Private)\.?/g,
    /[A-Z][A-Za-z\s]+ (?:Authority|Department|Ministry|Commission|Agency|Bureau|Office)/g,
  ]
  for (const p of suffixPats) {
    for (const m of text.matchAll(p)) {
      const org = m[0].trim().replace(/^\d+\s*/, '').replace(/\d{4,}$/, '').trim()
      if (org.length > 4 && org.length < 100 && !isSectionHeading(org)) out.add(org)
    }
  }

  // Strategy 4: Institution patterns
  const instPats = [
    /(?:University|Institute|College|School|Academy)\s+(?:of\s+)?[A-Z][\w\s,]+/gi,
    /[A-Z][\w\s]+ (?:University|Institute|College|School|Academy)/gi,
  ]
  for (const p of instPats) {
    for (const m of text.matchAll(p)) {
      const org = m[0].trim().replace(/^\d+\s*/, '').replace(/\d{4,}$/, '').trim()
      if (org.length > 4 && org.length < 100 && !isSectionHeading(org)) out.add(org)
    }
  }

  return [...out]
    .filter(o => !isSectionHeading(o))
    .filter(o => o.length > 2 && o.length < 80)
    .filter(o => !/^\d/.test(o))
    .slice(0, 15)
}

function extractGeneralPersons(text) {
  const out = new Set()

  // Words that indicate a phrase is a topic/title, NOT a person name
  const topicWords = new Set([
    // Common stopwords
    'The','This','That','These','Those','With','From','Into','Over','Under',
    'About','After','Before','During','Through','Between','Among','Within',
    'Without','According','Based','Using','Including','Such','Each','Both',
    'Many','Most','Some','More','Less','Very','Also','Only','Just','Even',
    'Still','Already','Always','Never','Often','Usually','Generally',
    'Specifically','Particularly','Especially','However','Therefore',
    'Furthermore','Moreover','Additionally','Consequently','Nevertheless',
    'New','Old','Big','Small','Large','High','Low','Long','Short',
    'First','Second','Third','Last','Next','Previous','Current',
    'Global','Local','National','International','Digital','Virtual',
    'Annual','Monthly','Weekly','Daily','Recent','Future','Past',
    // Topic/industry words that appear in titles but not person names
    'Technology','Industry','Analysis','Innovation','Report','Market',
    'Artificial','Intelligence','Machine','Learning','Data','Science',
    'Business','Financial','Economic','Strategic','Corporate','Enterprise',
    'Research','Development','Management','Operations','Performance',
    'Overview','Summary','Review','Assessment','Evaluation','Study',
    'Sector','Segment','Landscape','Ecosystem','Framework','Platform',
    'Digital','Transformation','Adoption','Integration','Implementation',
    'Growth','Trends','Insights','Outlook','Forecast','Projection',
    'Quarter','Annual','Revenue','Profit','Loss','Investment','Capital',
  ])

  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) || []
  for (const m of matches) {
    const words = m.split(/\s+/)
    // Reject if any word is a topic/stopword
    if (words.some(w => topicWords.has(w))) continue
    if (m.length > 40) continue
    if (isSectionHeading(m)) continue
    // Must look like a real name: each word starts with capital, rest lowercase
    // Reject if any word is all-caps (acronym) or contains numbers
    if (words.some(w => /[0-9]/.test(w))) continue
    if (words.some(w => w === w.toUpperCase() && w.length > 2)) continue
    out.add(m)
  }
  return [...out].slice(0, 8)
}

function extractTechKeywords(text) {
  const techTerms = [
    'Artificial Intelligence','Machine Learning','Deep Learning','Neural Network',
    'Natural Language Processing','Computer Vision','Reinforcement Learning',
    'Large Language Model','Generative AI','ChatGPT','GPT-4','LLM','Transformer',
    'Python','JavaScript','TypeScript','React','Node.js','TensorFlow','PyTorch',
    'Kubernetes','Docker','AWS','Azure','GCP','Cloud Computing','Edge Computing',
    'Blockchain','IoT','5G','Quantum Computing','Data Science','Big Data',
    'Analytics','Automation','Cybersecurity','DevOps','Microservices','API',
    'SaaS','PaaS','IaaS','Digital Transformation',
  ]
  const found = new Set()
  for (const term of techTerms) {
    const regex = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
    if (regex.test(text)) found.add(term)
  }
  return [...found].slice(0, 15)
}

function extractLocations(text) {
  const out = new Set()
  const locationPats = [
    /\b(?:United States|United Kingdom|European Union|North America|South America|Asia Pacific|Middle East|Southeast Asia)\b/gi,
    /\b(?:New York|San Francisco|Los Angeles|London|Tokyo|Beijing|Shanghai|Singapore|Dubai|Paris|Berlin|Sydney|Mumbai|Seoul)\b/gi,
    /\b(?:California|Texas|Florida|Washington|Massachusetts|Illinois)\b/gi,
    /\b(?:China|India|Japan|Germany|France|Canada|Australia|Brazil|South Korea|Taiwan)\b/gi,
  ]
  for (const p of locationPats) {
    for (const m of text.matchAll(p)) out.add(m[0].trim())
  }
  return [...out].slice(0, 8)
}
