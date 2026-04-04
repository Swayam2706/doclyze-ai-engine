import axios from 'axios'

/**
 * AI Analysis — used ONLY for summary, sentiment, and semantic entity supplement.
 * Never returns raw output directly; always normalized.
 */

function buildPrompt(docType) {
  const hints = {
    resume: `RESUME / CV.
Summary (2 sentences max):
- Describe the candidate's background, key skills, and experience level.
- Do NOT include name, email, phone, URL, or section headings.
Sentiment: positive (resumes are inherently positive).
Entities: persons (candidate name), organizations (employers, universities), locations, skills (technical only), projects (titles only).`,

    invoice: `INVOICE / BILL.
Summary (1-2 sentences): issuer name, recipient, purpose/service, total amount, and date if present.
Sentiment: neutral.
Entities: persons (contact names), organizations (vendor and client), dates, monetary_amounts (all amounts including tax/subtotal/total), locations (addresses).`,

    receipt: `RECEIPT / PAYMENT CONFIRMATION.
Summary (1-2 sentences): store/vendor, what was purchased, total paid, date.
Sentiment: neutral.
Entities: organizations (store/vendor), dates, monetary_amounts, locations.`,

    contract: `CONTRACT / AGREEMENT.
Summary (2 sentences): parties involved, purpose of agreement, key obligations or terms.
Sentiment: neutral (unless clearly punitive/dispute-related → negative).
Entities: persons (signatories, parties), organizations, dates (effective date, expiry), locations, monetary_amounts (if any).`,

    report: `REPORT / ANALYSIS / ARTICLE.
Summary (2-3 sentences): main topic, key findings or arguments, and conclusion or recommendation.
Sentiment: determine from tone — optimistic/positive findings → positive; warnings/problems/decline → negative; factual/balanced → neutral.
Entities: persons (authors, mentioned individuals), organizations (companies, institutions mentioned), locations, dates, skills/technologies mentioned.`,

    notice: `NOTICE / ANNOUNCEMENT / MEMO.
Summary (1-2 sentences): what is being announced, who it affects, and any key dates or actions required.
Sentiment: neutral unless warning/penalty-heavy → negative.
Entities: organizations (issuing body), persons (officials), dates, locations.`,

    letter: `LETTER / CORRESPONDENCE.
Summary (1-2 sentences): sender's purpose, main request or message, and any action required.
Sentiment: determine from tone — complaint/rejection → negative; appreciation/approval → positive; formal/neutral → neutral.
Entities: persons (sender, recipient), organizations, dates, locations.`,

    general: `GENERAL DOCUMENT.
Summary (2-3 sentences): main topic, key information, and purpose of the document.
Sentiment: determine from overall tone of the text.
Entities: persons, organizations, locations, dates, monetary_amounts — extract all that are clearly present.`,
  }

  return `You are a precise document analysis AI optimized for accuracy.
This document type is: ${docType.toUpperCase()}.

${hints[docType] || hints.general}

Return ONLY valid JSON with this exact structure:
{
  "summary": "concise factual summary",
  "entities": {
    "persons": [],
    "organizations": [],
    "locations": [],
    "skills": [],
    "projects": [],
    "monetary_amounts": []
  },
  "sentiment": "positive | neutral | negative"
}

CRITICAL RULES:
1. Summary: factual, concise, based on actual content. No contact info. No section headings.
2. Entities: real values only. No section headings, no labels, no generic phrases.
3. Organizations: company names, institution names, government bodies — real names only.
4. Skills: technical skills, tools, languages, frameworks only.
5. Projects: actual project names/titles only.
6. Sentiment: must reflect the actual tone of the document content.
7. If a category has no entities, return empty array — do NOT invent values.`
}

async function callOpenAI(prompt, text) {
  const key = process.env.OPENAI_API_KEY
  if (!key || key.includes('your_')) return null
  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Analyze:\n\n${text}` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      timeout: 30000,
    })
    return JSON.parse(res.data.choices[0].message.content)
  } catch (e) {
    console.error('  OpenAI error:', e.response?.data?.error?.message || e.message)
    return null
  }
}

async function callGemini(prompt, text) {
  // Support up to 3 Gemini keys — rotates on 429
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(k => k && !k.includes('your_') && k.length > 10)

  if (keys.length === 0) return null

  for (const key of keys) {
    // Try each key up to 2 times with a short backoff on 429
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            contents: [{ parts: [{ text: `${prompt}\n\nDocument:\n${text}\n\nReturn ONLY JSON.` }] }],
            generationConfig: { temperature: 0.1, topK: 20, topP: 0.8 },
          },
          { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
        )
        let c = res.data.candidates[0].content.parts[0].text
        c = c.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(c)
        console.log('  Gemini: success')
        return parsed
      } catch (e) {
        const status = e.response?.status
        const msg = e.response?.data?.error?.message || e.message
        if (status === 429) {
          if (attempt === 1) {
            // Wait 8 seconds then retry same key once
            console.log(`  Gemini 429 — waiting 3s before retry (attempt ${attempt}/2)...`)
            await new Promise(r => setTimeout(r, 3000))
            continue
          }
          // Second attempt also 429 — move to next key
          console.log(`  Gemini key exhausted — rotating to next key...`)
          break
        }
        console.error('  Gemini error:', msg)
        return null
      }
    }
  }

  console.log('  Gemini: all keys rate limited — falling back to regex-only')
  return null
}

export async function runAIAnalysis(preparedText, docType) {
  const prompt = buildPrompt(docType)

  let raw = await callOpenAI(prompt, preparedText)
  if (!raw) raw = await callGemini(prompt, preparedText)
  if (!raw) return null

  const ent = raw.entities || {}
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    entities: {
      persons: safeArr(ent.persons),
      organizations: safeArr(ent.organizations),
      locations: safeArr(ent.locations),
      skills: safeArr(ent.skills),
      projects: safeArr(ent.projects),
      monetary_amounts: safeArr(ent.monetary_amounts),
    },
    sentiment: ['positive', 'neutral', 'negative'].includes(raw.sentiment) ? raw.sentiment : 'neutral',
  }
}

function safeArr(v) { return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] }
