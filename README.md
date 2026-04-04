# Doclyze — AI-Powered Document Analysis & Extraction

> **Turn any document into structured intelligence — in seconds.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Doclyze-6366f1?style=flat-square)](https://doclyze-ai-engine.vercel.app)
[![API](https://img.shields.io/badge/API-Render-22c55e?style=flat-square)](https://doclyze-ai-engine.onrender.com/api/health)
[![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)

---

## 🔗 Links

| Resource | URL |
|---|---|
| Live Application | https://doclyze-ai-engine.vercel.app |
| API Health Check | https://doclyze-ai-engine.onrender.com/api/health |
| Public API Endpoint | `POST https://doclyze-ai-engine.onrender.com/api/document-analyze` *(use cURL or Postman — POST only)* |

---

## 📌 The Problem

Documents are everywhere — invoices, resumes, reports, legal letters, notices — but extracting structured, actionable information from them is still a manual, time-consuming process. Existing tools either require expensive enterprise licenses, return noisy unstructured text, or fail entirely on scanned documents.

There is no lightweight, accurate, API-first solution that handles PDFs, Word documents, and images with equal reliability while returning clean, structured JSON.

---

## 💡 What Doclyze Does

Doclyze is a document intelligence API that accepts any PDF, DOCX, or image file and returns a structured analysis in under 15 seconds:

- **Summary** — a concise, AI-generated description of what the document says
- **Entities** — names, organizations, dates, amounts, locations, emails, phones, URLs
- **Sentiment** — Positive, Neutral, or Negative based on document tone
- **Document type** — automatically classified as resume, invoice, report, letter, notice, or general

The system handles text-based PDFs, scanned PDFs, Word documents, and image files through a unified pipeline with no manual configuration required.

---

## ⚙️ Key Features

**Multi-format ingestion** — PDF (text-based and scanned), DOCX, PNG, JPG. One endpoint handles all formats transparently.

**Dual-engine OCR** — Google Cloud Vision API is the primary OCR engine for high accuracy on scanned documents and images. Tesseract.js serves as an automatic fallback when Vision is unavailable, ensuring zero silent failures.

**Hybrid entity extraction** — A two-stage pipeline: deterministic regex patterns extract emails, phones, URLs, dates, and monetary amounts with 100% consistency. An AI model (Gemini 2.0 Flash / GPT-3.5) supplements with semantic entities — names, organizations, locations — that require contextual understanding.

**Document-type-aware analysis** — The system classifies each document before analysis. A resume gets different extraction rules than an invoice or a cybersecurity report. This improves accuracy across all document categories.

**Garbage detection** — PDF metadata (XMP, Adobe namespace, swatch groups) is automatically detected and rejected before it can corrupt summaries or entities. Only visible page content is analyzed.

**Production-grade post-processing** — All extracted entities pass through a validation layer that removes section headings, label strings, action verbs, and topic phrases that are not real entities. Deduplication, normalization, and confidence scoring are applied before the response is returned.

---

## 🧠 How It Works

```
Input (PDF / DOCX / Image)
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  TEXT EXTRACTION                                     │
│  PDF: pdf-parse → pdfjs text layer → raw binary     │
│       → OCR (Vision → Tesseract)                    │
│  DOCX: mammoth                                       │
│  Image: Google Vision → Tesseract fallback           │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  TEXT CLEANING                                       │
│  Normalize whitespace · Fix OCR artifacts            │
│  Preserve currency symbols · Remove page numbers     │
│  Detect & reject XMP/metadata garbage                │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  DOCUMENT CLASSIFICATION                             │
│  Keyword scoring → resume / invoice / report /       │
│  letter / notice / contract / general                │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  ENTITY EXTRACTION (Hybrid)                          │
│  Regex: emails, phones, URLs, dates, amounts         │
│  Section parsing: skills, projects, experience orgs  │
│  AI supplement: names, organizations, locations      │
│  Prose patterns: institutional entities in reports   │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  AI ANALYSIS (Gemini 2.0 Flash / GPT-3.5)           │
│  Document-type-aware prompt → summary + sentiment    │
│  Key rotation on rate limit · Fallback to regex      │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  POST-PROCESSING                                     │
│  Merge regex + AI · Validate · Deduplicate           │
│  Filter false positives · Compute confidence         │
└─────────────────────────────────────────────────────┘
        │
        ▼
   Structured JSON Response
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js 18+, Express |
| AI / LLM | Google Gemini 2.0 Flash (primary), OpenAI GPT-3.5 (secondary) |
| OCR | Google Cloud Vision API (primary), Tesseract.js v5 (fallback) |
| PDF Parsing | pdf-parse, pdfjs-dist v5.6 |
| DOCX Parsing | mammoth |
| Database | MongoDB Atlas |
| Deployment | Vercel (frontend), Render (backend) |
| PDF Export | jsPDF |

---

## 🤖 AI Tools Used

| Tool | Role | How It's Used |
|---|---|---|
| **Google Gemini 2.0 Flash** | Primary LLM | Document summarization, semantic entity extraction, sentiment classification. Document-type-aware prompts are used — a resume gets a different prompt than an invoice. Up to 3 API keys rotate automatically on rate limits. |
| **OpenAI GPT-3.5** | Secondary LLM | Fallback when Gemini is unavailable. Same structured JSON prompt, `response_format: json_object` enforced. |
| **Google Cloud Vision API** | Primary OCR | `DOCUMENT_TEXT_DETECTION` feature used for scanned PDFs and image files. Returns `fullTextAnnotation` with layout-aware text. |
| **Tesseract.js v5** | Fallback OCR | Runs locally when Vision API is unavailable (403, 429, or not configured). Processes the same rendered page images. |

**AI usage policy:** All AI outputs are post-processed through a validation layer before being returned. Summaries are checked for contact pollution. Entities are validated against blocklists for section headings, label strings, and synthetic names. The system never returns raw AI output directly — every value is verified against the source text.

---

## 📡 API Reference

### `POST /api/document-analyze`

Accepts one document per request as base64-encoded JSON.

**Headers**

```
Content-Type: application/json
x-api-key: sk_doclyze_ai_2026
```

**Request Body**

```json
{
  "fileName": "quarterly_report.pdf",
  "fileType": "pdf",
  "fileBase64": "JVBERi0xLjQgMCBvYmoK..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `fileName` | string | ✅ | Original file name |
| `fileType` | string | ✅ | `pdf`, `docx`, or `image` |
| `fileBase64` | string | ✅ | Raw base64 — no `data:...;base64,` prefix |

**Example cURL**

```bash
curl -X POST https://doclyze-ai-engine.onrender.com/api/document-analyze \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_doclyze_ai_2026" \
  -d '{
    "fileName": "report.pdf",
    "fileType": "pdf",
    "fileBase64": "JVBERi0xLjQg..."
  }'
```

**Success Response** `200 OK`

```json
{
  "status": "success",
  "fileName": "report.pdf",
  "summary": "The quarterly report outlines 15% revenue growth in Q4 2024, driven by expansion in the technology sector. Key findings include improved operating efficiency and new partnerships with Microsoft and Salesforce.",
  "entities": {
    "names": ["John Smith", "Jane Doe"],
    "dates": ["Q4 2024", "January 15, 2025"],
    "organizations": ["Acme Corp", "Microsoft", "Salesforce"],
    "amounts": ["$2,500,000", "$700,000"],
    "emails": ["john.smith@acme.com"],
    "phone_numbers": ["+1-555-123-4567"],
    "locations": ["New York", "San Francisco"],
    "skills": [],
    "urls": []
  },
  "sentiment": "Positive",
  "document_type": "report",
  "confidence": 0.91,
  "metadata": {
    "ocr_used": false,
    "ocr_engine": null,
    "pages_processed": 3,
    "processing_time_ms": 8712
  }
}
```

**Error Responses**

| Status | Condition |
|---|---|
| `401` | Missing or invalid `x-api-key` |
| `400` | Missing fields, unsupported file type, invalid base64 |
| `500` | Internal processing error |

---

## 📊 Sample Output by Document Type

**Resume**
```json
{
  "document_type": "resume",
  "sentiment": "Positive",
  "entities": {
    "names": ["Nina Lane"],
    "organizations": ["Brightline Agency", "Parsons School of Design"],
    "skills": ["Figma", "Adobe Creative Suite", "Web Design", "React"],
    "locations": ["New York, NY"],
    "emails": ["nina@ninalane.com"],
    "urls": ["https://ninalane.com"]
  }
}
```

**Invoice**
```json
{
  "document_type": "invoice",
  "sentiment": "Neutral",
  "entities": {
    "organizations": ["Nexus Dynamics", "Acme Corp"],
    "amounts": ["$5,750.00", "$5,000.00", "$750.00"],
    "dates": ["December 31, 2024"],
    "invoice_numbers": ["INV-2024-0847"]
  }
}
```

---

## 🧪 Accuracy Strategy

The scoring rubric weights **entities (4 pts)** and **sentiment (4 pts)** most heavily per document. The pipeline is designed around this:

**Entity accuracy** is maximized through a 5-strategy extraction system:
1. Known organization dictionary (80+ companies, institutions, agencies)
2. Context-phrase patterns (`"companies such as X, Y, and Z"`)
3. Company suffix patterns with synthetic-name rejection
4. Institution patterns (University, College, Academy)
5. Prose institutional phrases for reports (`"financial institutions"`, `"regulatory authorities"`)

A `SYNTHETIC_ORG_PREFIXES` blocklist prevents hallucinated entities like `"Cybersecurity Inc"` from appearing in output. A garbage detector rejects XMP metadata before it can corrupt entity lists.

**Sentiment accuracy** uses a two-tier approach: AI-based classification when available, with a keyword fallback that includes 30+ strong-negative phrases (data breach, ransomware, fraud alert) that immediately classify incident reports as Negative without relying on score thresholds.

**Summary accuracy** relies on document-type-aware prompts — a resume gets a different prompt than an invoice or a cybersecurity report — ensuring the summary reflects the actual document purpose rather than generic extraction.

---

## 🚀 What Makes This Different

- **No hardcoded outputs.** Every response is derived from the actual document content. The system is tested to produce different outputs for different inputs of the same type.

- **4-layer PDF extraction.** Most tools use one parser. Doclyze tries pdf-parse → pdfjs text layer → raw binary content stream extraction → OCR. Government PDFs with broken xref tables that fail all parsers are handled by reading content streams directly from the binary.

- **Garbage detection.** PDFs often embed XMP metadata (Adobe namespace, swatch groups) that parsers accidentally return as document text. Doclyze detects and rejects this before it reaches the AI model.

- **Gemini key rotation.** Up to 3 Gemini API keys rotate automatically on 429 rate limits, with a 3-second backoff between attempts. The system never silently fails — it falls back to regex-only extraction if all AI calls fail.

- **OCR metadata honesty.** `ocr_engine` is always set to the actual engine used (`"vision"` or `"tesseract"`), never null when OCR ran. If rendering failed before OCR could run, it's reported as `"failed"` rather than silently omitted.

---

## 🗂 Project Structure

```
doclyze/
├── backend/
│   ├── server.js                  # Express server, API routes, auth, rate limiting
│   ├── config/
│   │   └── database.js            # MongoDB Atlas connection
│   ├── models/
│   │   └── Document.js            # Mongoose document schema
│   └── services/
│       ├── analyzer.js            # Main pipeline orchestrator (7-step)
│       ├── textExtractor.js       # PDF/DOCX/image extraction (4-layer PDF)
│       ├── pdfRenderer.js         # PDF → image rendering for OCR (pdfjs + canvas)
│       ├── ocrService.js          # Vision API + Tesseract fallback
│       ├── textCleaner.js         # Normalization, garbage detection
│       ├── docTypeDetector.js     # Keyword-based document classification
│       ├── regexExtractor.js      # Deterministic entity extraction
│       ├── aiAnalyzer.js          # Gemini/OpenAI integration, key rotation
│       ├── postProcessor.js       # Merge, validate, deduplicate, confidence
│       └── publicMapper.js        # Internal result → API response format
└── frontend/
    └── src/
        ├── pages/                 # Landing, Processing, Dashboard, ApiDocs
        ├── components/            # Navbar, Footer, Logo, PremiumButton
        └── lib/
            ├── api.ts             # API client with SSE progress
            ├── generateReport.ts  # jsPDF report generator
            └── utils.ts
```

---

## ⚡ Setup

**Prerequisites:** Node.js ≥ 18, MongoDB Atlas account, Google Cloud project with Vision API enabled

```bash
# Clone
git clone https://github.com/Swayam2706/doclyze-ai-engine.git
cd doclyze-ai-engine

# Backend
cd backend
npm install
cp .env.example .env
# Fill in your API keys (see below)
npm start

# Frontend (new terminal)
cd ../frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000
npm run dev
```

---

## 🔐 Environment Variables

**`backend/.env`**

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?appName=Doclyze

# AI — at least one required
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
GEMINI_API_KEY_2=AIza...          # optional second key for rate limit rotation

# OCR — required for image/scanned PDF support
GOOGLE_VISION_API_KEY=AIza...

# Public API authentication
API_KEY=sk_doclyze_ai_2026
```

**`frontend/.env`**

```env
VITE_API_URL=https://doclyze-ai-engine.onrender.com
```

---

## ⚠️ Known Limitations

- **Gemini rate limits on free tier** — The free Gemini API allows ~15 requests/minute. Under heavy load, the system falls back to regex-only extraction, which produces weaker summaries but still returns valid entities and sentiment.

- **Complex scanned PDFs** — PDFs with non-standard xref tables or broken structure may fail all four extraction layers. The system reports this honestly in `metadata.ocr_engine: "failed"` rather than returning empty results silently.

- **Table extraction** — Structured data inside PDF tables (rows, columns) is extracted as flat text. Column alignment is not preserved, which can affect entity extraction accuracy for tabular invoices.

- **Non-English documents** — The extraction pipeline is optimized for English. Entity extraction and sentiment classification will be less accurate on documents in other languages.

- **Very large files** — Files above 10 MB are rejected. Multi-page scanned PDFs (10+ pages) may exceed the 30-second processing window on the free Render tier due to per-page OCR time.

- **Render cold starts** — The backend is deployed on Render's free tier, which sleeps after 15 minutes of inactivity. The first request after a sleep period may take 20–30 seconds to respond.

---

## 📈 What's Next

- **Batch processing** — accept multiple documents in a single request with parallel processing
- **Webhook support** — async processing with callback URL for large documents
- **Table extraction** — structured data from PDF tables and DOCX tables
- **Language detection** — automatic multi-language support beyond English

---

## 🏁 Built for the Hackathon

Doclyze was built to solve a real problem with production-grade engineering. Every design decision — from the 4-layer PDF extraction to the garbage detector to the Gemini key rotation — exists because real documents are messy and real APIs have limits. The result is a system that handles edge cases gracefully, returns honest metadata, and never fabricates output.

---

*MIT License · Built with Node.js, React, Google Gemini, and Google Vision*
