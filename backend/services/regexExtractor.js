﻿﻿﻿﻿﻿﻿/**
 * Deterministic Entity Extraction — regex & rules.
 * Authoritative for: emails, phones, URLs, dates, money, invoice numbers.
 * Type-specific: persons, skills, projects, organizations, locations.
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
    /\b\d{10}\b/g,
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
  const out = new Set()
  // Full URLs
  const full = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]),;]+/gi) || []
  full.forEach(u => out.add(u))
  // Bare domains with path: github.com/user, linkedin.com/in/user, ninalane.com
  const barePats = [
    /\b(?:github|linkedin|behance|dribbble|portfolio|twitter|instagram)\.com\/[^\s,;|]+/gi,
    /\b[a-z0-9][a-z0-9\-]*\.[a-z]{2,}(?:\/[^\s,;|]*)?\b/gi,
  ]
  for (const p of barePats) {
    for (const m of text.matchAll(p)) {
      const u = m[0].trim().replace(/[.,;:)]+$/, '')
      // Reject if it looks like a sentence fragment
      if (u.includes(' ')) continue
      if (/^(e\.g|i\.e|etc|vs|mr|ms|dr|prof)\./i.test(u)) continue
      if (!out.has(u) && !out.has('https://' + u)) {
        out.add('https://' + u)
      }
    }
  }
  // Remove URLs that are just email domains
  const emails = extractEmails(text)
  const emailDomains = new Set(emails.map(e => e.split('@')[1]))
  return [...out].filter(u => {
    const domain = u.replace(/^https?:\/\//, '').split('/')[0]
    return !emailDomains.has(domain)
  }).slice(0, 15)
}

function extractDates(text) {
  const out = new Set()
  const pats = [
    // Full date ranges: "June 2020 – Present", "March 2017 – May 2020"
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*[–\-—]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|[Pp]resent|[Cc]urrent|[Nn]ow)\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[–\-—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|[Pp]resent|[Cc]urrent)\b/gi,
    // Year ranges: "2020 – Present", "2018 – 2022"
    /\b\d{4}\s*[–\-—]\s*(?:\d{4}|[Pp]resent|[Cc]urrent)\b/g,
    // Numeric dates
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    // Full month + day + year
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    // Month + year
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/gi,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    // Standalone years (last resort)
    /\b(?:20|19)\d{2}\b/g,
  ]
  for (const p of pats) {
    for (const m of text.matchAll(p)) out.add(m[0].trim())
  }
  // Deduplicate: remove standalone years already covered by richer ranges
  const all = [...out]
  const rich = all.filter(d => d.length > 6) // anything longer than "2024"
  const richYears = new Set(rich.flatMap(d => d.match(/\b\d{4}\b/g) || []))
  return all.filter(d => {
    if (d.length <= 4 && richYears.has(d)) return false // standalone year already in a range
    return true
  }).slice(0, 25)
}

function extractMoney(text) {
  const pats = [
    /[$\u20B9\u20AC\u00A3\u00A5\u20A9]\s?[\d,]+(?:\.\d{1,2})?/g,
    /(?:USD|INR|EUR|GBP|JPY|AUD|CAD)\s?[\d,]+(?:\.\d{1,2})?/gi,
    /(?:Rs\.?|INR)\s?[\d,]+(?:\.\d{1,2})?/gi,
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

/**
 * Extract candidate name from resume.
 * Scans first 20 non-empty lines for a 2-3 word capitalized phrase
 * that doesn't look like a heading, job title, or contact info.
 */
function extractPersonName(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const scanLines = lines.slice(0, 20)

  // Section/heading words that are NOT names
  const headingWords = new Set([
    'resume','cv','curriculum','vitae','profile','portfolio','contact',
    'experience','education','skills','projects','certifications','summary',
    'objective','about','references','achievements','awards','languages',
    'interests','hobbies','declaration','qualifications','overview',
  ])

  // Job title indicator words — if a line contains these, it's a title not a name
  const titleWords = /\b(engineer|developer|designer|manager|analyst|consultant|director|officer|specialist|coordinator|architect|lead|senior|junior|intern|associate|executive|president|founder|ceo|cto|cfo|vp|head|principal)\b/i

  for (let i = 0; i < scanLines.length; i++) {
    const t = scanLines[i]
    if (!t || t.length < 3 || t.length > 60) continue
    if (/\d/.test(t)) continue
    if (/@/.test(t)) continue
    if (/https?:\/\/|\.com|\.org|\.net|\.io/i.test(t)) continue
    if (/[|•·,;:]/. test(t)) continue  // contact separator lines
    const words = t.split(/\s+/)
    if (words.length < 2 || words.length > 4) continue
    // All words must start with capital
    if (!words.every(w => /^[A-Z]/.test(w))) continue
    // No heading words
    if (words.some(w => headingWords.has(w.toLowerCase()))) continue
    // Not a job title line
    if (titleWords.test(t)) continue
    if (isSectionHeading(t)) continue
    return t
  }

  // Fallback: use contact block
  const { contactBlock } = extractContactBlock(rawText)
  for (const line of contactBlock) {
    const t = line.trim()
    if (/\d/.test(t) || /@/.test(t)) continue
    if (/https?:\/\/|\.com|\.org|\.net|\.io/i.test(t)) continue
    const words = t.split(/\s+/)
    if (words.length < 2 || words.length > 5) continue
    if (!words.every(w => /^[A-Z]/.test(w))) continue
    if (isSectionHeading(t)) continue
    return t
  }
  return null
}

// ─── Resume: skills ─────────────────────────────────────────

// Broad skill dictionary for context-based detection in prose
const SKILL_DICTIONARY = new Set([
  // Languages
  'Python','JavaScript','TypeScript','Java','C++','C#','C','Go','Rust','Swift',
  'Kotlin','PHP','Ruby','Scala','R','MATLAB','Perl','Shell','Bash','SQL','HTML','CSS',
  // Frameworks/Libraries
  'React','Angular','Vue','Node.js','Express','Django','Flask','FastAPI','Spring',
  'Laravel','Rails','Next.js','Nuxt','Svelte','TensorFlow','PyTorch','Keras',
  'Scikit-learn','Pandas','NumPy','OpenCV','Hugging Face',
  // Tools/Platforms
  'Git','GitHub','GitLab','Docker','Kubernetes','AWS','Azure','GCP','Firebase',
  'MongoDB','PostgreSQL','MySQL','Redis','Elasticsearch','Kafka','RabbitMQ',
  'Terraform','Ansible','Jenkins','CircleCI','Jira','Confluence','Figma',
  'Photoshop','Illustrator','InDesign','Sketch','After Effects','Premiere Pro',
  'Adobe Creative Suite','Adobe XD','Canva','Blender','AutoCAD',
  // Concepts
  'Machine Learning','Deep Learning','Data Science','Computer Vision',
  'Natural Language Processing','Artificial Intelligence','DevOps','Agile','Scrum',
  'REST API','GraphQL','Microservices','CI/CD','Cloud Computing','Blockchain',
  'Cybersecurity','Data Analysis','Web Design','UI/UX','Product Design',
  'SEO','Digital Marketing','Social Media','Content Strategy','Copywriting',
  'Project Management','Leadership','Communication',
])

function extractSkillsFromSections(text) {
  const lines = text.split('\n')
  const skills = new Set()
  let inSkillSection = false

  const skillHeaders = [
    'technical skills','skills','core competencies','key skills',
    'technologies','tools','frameworks','software','expertise',
    'proficiencies','competencies','capabilities',
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase().replace(/:$/, '')

    if (skillHeaders.some(h => lower === h || lower.startsWith(h + ':') || lower.startsWith(h + ' '))) {
      inSkillSection = true
      const afterColon = line.split(':').slice(1).join(':').trim()
      if (afterColon) splitSkillLine(afterColon).forEach(s => skills.add(s))
      continue
    }

    if (inSkillSection) {
      if (isSectionHeading(line) && !skillHeaders.some(h => lower.includes(h))) {
        inSkillSection = false; continue
      }
      if (line === '') continue
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0 && colonIdx < 35) {
        const label = line.substring(0, colonIdx).trim().toLowerCase()
        const validLabels = [
          'languages','core','frontend','backend','databases','tools','frameworks',
          'devops','cloud','testing','other','programming','web','mobile','design',
          'software','platforms','libraries','skills','technologies',
        ]
        if (validLabels.some(v => label.includes(v))) {
          splitSkillLine(line.substring(colonIdx + 1)).forEach(s => skills.add(s))
          continue
        }
      }
      splitSkillLine(line).forEach(s => skills.add(s))
    }
  }

  // Also scan full text for known skill dictionary matches
  for (const skill of SKILL_DICTIONARY) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp('\\b' + escaped + '\\b', 'i')
    if (regex.test(text)) skills.add(skill)
  }

  return [...skills]
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 50)
    .filter(s => !isSectionHeading(s))
    .slice(0, 35)
}

function splitSkillLine(line) {
  return line
    .split(/[,|;\u2022\u00B7\u25AA\u25BA\u25CF\u25CB\u25E6\/]/)
    .map(s => s.replace(/^\s*[-\u2013\u2014\u2015]\s*/, '').trim())
    .filter(s => s.length > 1 && s.length < 50)
    .filter(s => !isSectionHeading(s))
}

// ─── Resume: experience section parsing ─────────────────────

/**
 * Parse experience section to extract organizations and locations.
 * Handles patterns like:
 *   "Brightline Agency | New York, NY"
 *   "Google — Mountain View, CA"
 *   "Acme Corp, San Francisco"
 */
function extractFromExperienceSection(text) {
  const lines = text.split('\n')
  const orgs = new Set()
  const locs = new Set()
  let inExpSection = false

  const expHeaders = [
    'experience','work experience','professional experience','employment',
    'employment history','work history','career','positions',
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase().replace(/:$/, '')

    if (expHeaders.some(h => lower === h || lower.startsWith(h + ':') || lower.startsWith(h + ' '))) {
      inExpSection = true; continue
    }

    if (inExpSection) {
      if (isSectionHeading(line) && !expHeaders.some(h => lower.includes(h))) {
        inExpSection = false; continue
      }
      if (!line) continue

      // Pattern: "Org | Location" or "Org — Location" or "Org, City, State"
      const pipeSplit = line.match(/^([^|–—,]+?)\s*[|–—]\s*(.+)$/)
      if (pipeSplit) {
        const left = pipeSplit[1].trim()
        const right = pipeSplit[2].trim()
        if (left.length > 2 && left.length < 80 && /^[A-Z]/.test(left) && !isSectionHeading(left)) {
          orgs.add(left)
        }
        // Right side may be "City, State" or just a location
        if (right.length > 2 && right.length < 60) {
          locs.add(right.replace(/[,\s]+$/, '').trim())
        }
        continue
      }

      // Pattern: company name on its own line (capitalized, short, no action verbs)
      if (
        /^[A-Z]/.test(line) &&
        line.length > 3 && line.length < 60 &&
        line.split(/\s+/).length <= 6 &&
        !isSectionHeading(line) &&
        !/^(Developed|Built|Created|Designed|Managed|Led|Worked|Collaborated|Achieved|Responsible|Assisted)\b/i.test(line)
      ) {
        // Check if next line looks like a date range (role timeline)
        const nextLine = lines[i + 1]?.trim() || ''
        if (/\d{4}/.test(nextLine) || /present|current/i.test(nextLine)) {
          orgs.add(line)
        }
      }
    }
  }

  return { orgs: [...orgs], locs: [...locs] }
}

// ─── Resume: education section parsing ──────────────────────

/**
 * Parse education section to extract institutions and locations.
 * Handles patterns like:
 *   "Parsons School of Design | New York, NY"
 *   "University of California, Berkeley"
 */
function extractFromEducationSection(text) {
  const lines = text.split('\n')
  const orgs = new Set()
  const locs = new Set()
  let inEduSection = false

  const eduHeaders = [
    'education','academic background','academic qualifications',
    'educational background','academics','qualifications',
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase().replace(/:$/, '')

    if (eduHeaders.some(h => lower === h || lower.startsWith(h + ':') || lower.startsWith(h + ' '))) {
      inEduSection = true; continue
    }

    if (inEduSection) {
      if (isSectionHeading(line) && !eduHeaders.some(h => lower.includes(h))) {
        inEduSection = false; continue
      }
      if (!line) continue

      // Pattern: "Institution | Location"
      const pipeSplit = line.match(/^([^|–—]+?)\s*[|–—]\s*(.+)$/)
      if (pipeSplit) {
        const inst = pipeSplit[1].trim()
        const loc = pipeSplit[2].trim()
        if (inst.length > 4 && /^[A-Z]/.test(inst) && !isSectionHeading(inst)) {
          orgs.add(inst)
        }
        if (loc.length > 2) locs.add(loc.replace(/[,\s]+$/, '').trim())
        continue
      }

      // Institution name patterns
      const instPats = [
        /(?:University|Institute|College|School|Academy)\s+(?:of\s+)?[A-Z][\w\s,]+/gi,
        /[A-Z][\w\s]+ (?:University|Institute|College|School|Academy|Polytechnic)/gi,
      ]
      for (const p of instPats) {
        for (const m of line.matchAll(p)) {
          const inst = m[0].trim().replace(/\d{4,}$/, '').replace(/,\s*$/, '').trim()
          if (inst.length > 5 && inst.length < 100) orgs.add(inst)
        }
      }
    }
  }

  return { orgs: [...orgs], locs: [...locs] }
}

// ─── Resume: projects / portfolio ───────────────────────────

function extractProjectsFromSection(text) {
  const lines = text.split('\n')
  let inSection = false
  const projects = []

  const sectionHeaders = [
    'projects','personal projects','academic projects','portfolio',
    'selected work','work samples','case studies','featured work',
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase().replace(/:$/, '')

    if (sectionHeaders.some(h => lower === h || lower.startsWith(h + ':') || lower.startsWith(h + ' '))) {
      inSection = true; continue
    }

    if (inSection) {
      if (isSectionHeading(line) && !sectionHeaders.some(h => lower.includes(h))) {
        inSection = false; continue
      }
      if (!line) continue
      if (/^[\u2022\u00B7\u25AA\u25BA\u25CF\u25CB\u25E6]/.test(line)) continue
      if (/^(Developed|Built|Created|Designed|Implemented|Used|Integrated|Managed|Led|Worked|Collaborated|Contributed)\b/i.test(line)) continue

      // "Title — Description" or "Title for Client"
      const dashMatch = line.match(/^(.+?)\s*[–—\-|]\s*.+/)
      if (dashMatch) {
        const title = cleanProjectTitle(dashMatch[1])
        if (title) { projects.push(title); continue }
      }

      // "Title for X" pattern
      const forMatch = line.match(/^(.+?)\s+for\s+.+/i)
      if (forMatch) {
        const title = cleanProjectTitle(forMatch[1])
        if (title) { projects.push(title); continue }
      }

      // Short capitalized standalone title
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

// ─── Resume: organizations (education institutions) ──────────

function extractOrganizations(text) {
  const out = new Set()
  const pats = [
    /(?:University|Institute|College|School|Academy|Polytechnic)\s+(?:of\s+)?[A-Z][\w\s,]+/gi,
    /[A-Z][\w\s]+ (?:University|Institute|College|School|Academy|Polytechnic)/gi,
  ]
  for (const p of pats) {
    for (const m of text.matchAll(p)) {
      let org = m[0].trim()
        .replace(/^\d+\s*/, '')
        .replace(/\d{4,}$/, '')
        .replace(/,\s*$/, '')
        .trim()
      if (org.length > 5 && org.length < 100 && !isSectionHeading(org)) out.add(org)
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
    const expData = extractFromExperienceSection(cleanedText)
    const eduData = extractFromEducationSection(cleanedText)
    const eduOrgs = extractOrganizations(cleanedText)

    // Merge all org sources
    const allOrgs = [...new Set([
      ...expData.orgs,
      ...eduData.orgs,
      ...eduOrgs,
    ])]

    // Merge all location sources
    const allLocs = [...new Set([
      ...expData.locs,
      ...eduData.locs,
      ...extractLocations(rawText),
    ])]

    return {
      ...common,
      persons: personName ? [personName] : [],
      organizations: allOrgs.filter(o => o.length > 2 && o.length < 100 && !isSectionHeading(o)).slice(0, 12),
      skills: extractSkillsFromSections(cleanedText),
      projects: extractProjectsFromSection(cleanedText),
      invoice_numbers: [],
      locations: allLocs.filter(l => l.length > 2).slice(0, 10),
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

  // report, article, letter, notice, contract, general
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

// ─── Invoice org extraction ──────────────────────────────────

function extractInvoiceOrganizations(text) {
  const out = new Set()
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

// ─── General org extraction ──────────────────────────────────

const KNOWN_ORGS = [
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
  'Reserve Bank','Central Bank','Securities Commission','Financial Authority',
]

// Words that are topic/domain words — should NEVER be the start of a synthetic org name
const SYNTHETIC_ORG_PREFIXES = new Set([
  'cybersecurity','artificial','intelligence','machine','learning','data','science',
  'technology','digital','cloud','blockchain','analytics','automation','innovation',
  'financial','economic','regulatory','compliance','security','privacy','network',
  'information','software','hardware','internet','mobile','social','media',
  'healthcare','pharmaceutical','environmental','educational','government',
  'national','international','global','federal','state','local','public','private',
])

function extractGeneralOrganizations(text) {
  const out = new Set()

  // Strategy 1: Known org scan — only returns orgs that ACTUALLY appear in text
  for (const org of KNOWN_ORGS) {
    const escaped = org.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    const regex = new RegExp('\\b' + escaped + '\\b', 'i')
    if (regex.test(text)) {
      const match = text.match(regex)
      out.add(match ? match[0] : org)
    }
  }

  // Strategy 2: Context-phrase extraction
  const contextPatterns = [
    /(?:companies|firms|organizations|corporations|brands|players|giants|vendors|providers|platforms|institutions|banks|agencies|authorities|departments)\s+(?:such as|including|like|namely|as|:)\s+([A-Z][A-Za-z0-9\s&,.']+?)(?:\.|,\s+(?:which|are|have|were)|$)/gi,
    /(?:including|such as|like|namely)\s+([A-Z][A-Za-z0-9\s&,.']+?)(?:\s+(?:which|are|have|were|to|in|for|with|by)|[.;]|$)/gi,
    /(?:affected|impacted|involved|targeted|breached|compromised)\s+(?:include|includes|are|were|:)\s+([A-Z][A-Za-z0-9\s&,.']+?)(?:\.|,\s+(?:and|which)|$)/gi,
  ]
  for (const p of contextPatterns) {
    for (const m of text.matchAll(p)) {
      const raw = (m[1] || m[0]).trim()
      const parts = raw.split(/,\s*(?:and\s+)?|\s+and\s+/)
      for (const part of parts) {
        const cleaned = part.trim().replace(/[.,;:]+$/, '').trim()
        if (cleaned.length > 1 && cleaned.length < 60 && /^[A-Z]/.test(cleaned)) out.add(cleaned)
      }
    }
  }

  // Strategy 2b: Inline comma list — only if at least one item is a KNOWN org
  const listPattern = /\b([A-Z][A-Za-z0-9]+)(?:,\s*([A-Z][A-Za-z0-9]+))+(?:,?\s+and\s+([A-Z][A-Za-z0-9]+))?/g
  for (const m of text.matchAll(listPattern)) {
    const items = m[0].split(/,\s*(?:and\s+)?|\s+and\s+/).map(s => s.trim()).filter(Boolean)
    const hasKnown = items.some(item => KNOWN_ORGS.some(k => k.toLowerCase() === item.toLowerCase()))
    if (hasKnown) {
      for (const item of items) {
        const clean = item.replace(/[.,;:]+$/, '').trim()
        if (clean.length > 1 && /^[A-Z]/.test(clean)) out.add(clean)
      }
    }
  }

  // Strategy 3: Company suffix patterns — STRICT: reject synthetic topic+suffix combos
  const suffixPats = [
    /([A-Z][A-Za-z\s&]+?) (?:Inc|Corp|LLC|Ltd|Co|Limited|Group|Holdings|Technologies|Solutions|Services|Systems|Pvt|Private)\.?/g,
    /([A-Z][A-Za-z\s]+?) (?:Authority|Department|Ministry|Commission|Agency|Bureau|Office|Bank|Fund|Exchange)/g,
  ]
  for (const p of suffixPats) {
    for (const m of text.matchAll(p)) {
      const fullMatch = m[0].trim()
      const prefixWords = (m[1] || '').trim().toLowerCase().split(/\s+/)
      if (prefixWords.some(w => SYNTHETIC_ORG_PREFIXES.has(w))) continue
      const org = fullMatch.replace(/^\d+\s*/, '').replace(/\d{4,}$/, '').trim()
      if (org.length > 4 && org.length < 100 && !isSectionHeading(org)) out.add(org)
    }
  }

  // Strategy 4: Institution patterns
  const instPats = [
    /(?:University|Institute|College|School|Academy|Polytechnic)\s+(?:of\s+)?[A-Z][\w\s,]+/gi,
    /[A-Z][\w\s]+ (?:University|Institute|College|School|Academy|Polytechnic)/gi,
  ]
  for (const p of instPats) {
    for (const m of text.matchAll(p)) {
      const org = m[0].trim().replace(/^\d+\s*/, '').replace(/\d{4,}$/, '').trim()
      if (org.length > 4 && org.length < 100 && !isSectionHeading(org)) out.add(org)
    }
  }


  // Strategy 5: Prose institutional category extraction
  // Uses a SEPARATE set (proseOrgs) that bypasses the SYNTHETIC_ORG_PREFIXES filter
  // because these phrases are explicitly validated against source text.
  const proseOrgs = new Set()
  const institutionalPhrases = [
    // Financial sector
    /\b(financial\s+institutions?)\b/gi,
    /\b(financial\s+service\s+providers?)\b/gi,
    /\b(banking\s+platforms?)\b/gi,
    /\b(banking\s+systems?)\b/gi,
    /\b(digital\s+banking\s+systems?)\b/gi,
    /\b(payment\s+service\s+providers?)\b/gi,
    /\b(payment\s+platforms?)\b/gi,
    /\b(payment\s+systems?)\b/gi,
    /\b(investment\s+(?:banks?|firms?))\b/gi,
    /\b(central\s+banks?)\b/gi,
    /\b(insurance\s+(?:companies|providers?))\b/gi,
    // Regulatory / government
    /\b(regulatory\s+authorit(?:y|ies))\b/gi,
    /\b(government\s+agenc(?:y|ies))\b/gi,
    /\b(law\s+enforcement\s+agenc(?:y|ies))\b/gi,
    /\b(federal\s+agenc(?:y|ies))\b/gi,
    /\b(national\s+authorit(?:y|ies))\b/gi,
    // Technology / security
    /\b(cybersecurity\s+(?:firms?|companies|researchers?|analysts?|teams?))\b/gi,
    /\b(cloud\s+(?:providers?|platforms?|services?|infrastructure))\b/gi,
    /\b(digital\s+(?:banks?|platforms?|payment\s+systems?|services?))\b/gi,
    /\b(technology\s+(?:companies|firms?|providers?|platforms?))\b/gi,
    /\b(software\s+(?:companies|firms?|providers?|vendors?))\b/gi,
    // Healthcare / education / research
    /\b(healthcare\s+(?:providers?|institutions?|organizations?))\b/gi,
    /\b(educational\s+institutions?)\b/gi,
    /\b(research\s+institutions?)\b/gi,
    // Generic institutional
    /\b(service\s+providers?)\b/gi,
    /\b(third.party\s+(?:vendors?|providers?|services?))\b/gi,
  ]
  for (const p of institutionalPhrases) {
    for (const m of text.matchAll(p)) {
      const phrase = m[0].trim()
      const normalized = phrase.charAt(0).toUpperCase() + phrase.slice(1).toLowerCase()
      proseOrgs.add(normalized)
    }
  }
  // Log for debugging
  if (proseOrgs.size > 0) {
    console.log('  [Strategy5] prose institutional orgs:', [...proseOrgs].join(', '))
  }
  // Merge: proper-noun orgs (filtered) + prose institutional orgs (pre-validated)
  const filteredOut = [...out]
    .filter(o => !isSectionHeading(o))
    .filter(o => o.length > 2 && o.length < 80)
    .filter(o => !/^\d/.test(o))
    .filter(o => {
      // Reject if first word is a synthetic/topic prefix (prevents "Cybersecurity Inc")
      const firstWord = o.split(/\s+/)[0].toLowerCase()
      return !SYNTHETIC_ORG_PREFIXES.has(firstWord)
    })
    .filter(o => {
      // Verbatim check for proper-noun orgs only
      const words = o.split(/\s+/)
      const isProperNoun = /^[A-Z][a-z]/.test(o) && words.length <= 3
      if (!isProperNoun) return true
      const escaped = o.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
      return new RegExp('\\b' + escaped + '\\b', 'i').test(text)
    })

  // proseOrgs bypass the prefix filter — they are already text-validated by Strategy 5
  const allOrgs = [...new Set([...filteredOut, ...proseOrgs])]
  console.log('  [extractGeneralOrgs] proper-noun:', filteredOut.length, '| prose:', proseOrgs.size, '| total:', allOrgs.length)
  return allOrgs.slice(0, 15)
}
// ─── General person extraction ───────────────────────────────

const PERSON_TOPIC_WORDS = new Set([
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
  // Topic words
  'Technology','Industry','Analysis','Innovation','Report','Market',
  'Artificial','Intelligence','Machine','Learning','Data','Science',
  'Business','Financial','Economic','Strategic','Corporate','Enterprise',
  'Research','Development','Management','Operations','Performance',
  'Overview','Summary','Review','Assessment','Evaluation','Study',
  'Sector','Segment','Landscape','Ecosystem','Framework','Platform',
  'Digital','Transformation','Adoption','Integration','Implementation',
  'Growth','Trends','Insights','Outlook','Forecast','Projection',
  'Quarter','Annual','Revenue','Profit','Loss','Investment','Capital',
  // Location words
  'North','South','East','West','Central','Upper','Lower',
  'United','States','Kingdom','European','Union','America','Asia',
  'Pacific','Middle','Southeast','Africa','Atlantic','Indian','Ocean',
  // Incident/report words
  'Cybersecurity','Incident','Breach','Attack','Fraud','Security',
  'Vulnerability','Compliance','Regulatory','Investigation','Enforcement',
])

function extractGeneralPersons(text) {
  const out = new Set()
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) || []
  for (const m of matches) {
    const words = m.split(/\s+/)
    if (words.some(w => PERSON_TOPIC_WORDS.has(w))) continue
    if (m.length > 40) continue
    if (isSectionHeading(m)) continue
    if (words.some(w => /[0-9]/.test(w))) continue
    if (words.some(w => w === w.toUpperCase() && w.length > 2)) continue
    out.add(m)
  }
  return [...out].slice(0, 8)
}

// ─── Tech keywords (skills for reports) ─────────────────────

// Only return these as "skills" for reports if they are clearly technical tools/languages
// NOT generic topic words like "Cybersecurity", "Analytics", "Automation"
const REPORT_SKILL_TERMS = [
  'Python','JavaScript','TypeScript','Java','React','Node.js','TensorFlow','PyTorch',
  'Kubernetes','Docker','AWS','Azure','GCP','SQL','MongoDB','PostgreSQL',
  'Machine Learning','Deep Learning','Neural Network','Natural Language Processing',
  'Computer Vision','Large Language Model','GPT-4','LLM','Transformer',
  'Blockchain','IoT','5G','Quantum Computing','Data Science','Big Data',
  'DevOps','Microservices','API','CI/CD','Cloud Computing',
]

function extractTechKeywords(text) {
  const found = new Set()
  for (const term of REPORT_SKILL_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    const regex = new RegExp('\\b' + escaped + '\\b', 'i')
    if (regex.test(text)) found.add(term)
  }
  return [...found].slice(0, 15)
}
// ─── Location extraction ─────────────────────────────────────

function extractLocations(text) {
  const out = new Set()
  const locationPats = [
    /\b(?:United States|United Kingdom|European Union|North America|South America|Asia Pacific|Middle East|Southeast Asia)\b/gi,
    /\b(?:New York|San Francisco|Los Angeles|London|Tokyo|Beijing|Shanghai|Singapore|Dubai|Paris|Berlin|Sydney|Mumbai|Seoul|Bangalore|Hyderabad|Chennai|Pune|Delhi|Kolkata|Boston|Seattle|Chicago|Austin|Toronto|Vancouver|Brooklyn|Manhattan)\b/gi,
    /\b(?:California|Texas|Florida|Washington|Massachusetts|Illinois|New York|Georgia|Ohio|Michigan|Pennsylvania|Arizona|Colorado|Nevada|New Jersey)\b/gi,
    /\b(?:China|India|Japan|Germany|France|Canada|Australia|Brazil|South Korea|Taiwan|United States|United Kingdom|Russia|Italy|Spain|Netherlands|Sweden|Switzerland|Singapore|UAE)\b/gi,
    // "City, State/Country" patterns
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s+(?:[A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
  ]
  for (const p of locationPats) {
    for (const m of text.matchAll(p)) {
      const loc = m[0].trim()
      // Filter out false positives from "City, State" pattern
      if (loc.includes(',')) {
        const parts = loc.split(',').map(p => p.trim())
        // Both parts should look like place names
        if (parts.every(p => p.length > 1 && p.length < 30)) out.add(loc)
      } else {
        out.add(loc)
      }
    }
  }
  return [...out].slice(0, 10)
}
