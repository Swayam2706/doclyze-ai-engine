# Doclyze — AI-Powered Document Analysis & Extraction

An AI document intelligence platform that extracts summaries, entities, and sentiment from PDFs, DOCX files, and images. Built for the Track 2 hackathon: "AI-Powered Document Analysis & Extraction".

## Features

- Multi-format support: PDF, DOCX, and image files (PNG/JPG via OCR)
- AI-powered summarization using OpenAI or Google Gemini
- Entity extraction: names, dates, organizations, monetary amounts
- Sentiment analysis: Positive / Neutral / Negative
- Hybrid pipeline: regex + rule-based extraction + AI + post-processing validation
- Document type detection: resume, invoice, receipt, contract, report, letter, general
- Hackathon-compliant public API (`POST /api/document-analyze`)
- Rich internal API for the application UI (`POST /api/analyze`)

## Tech Stack

- Frontend: React 18, Vite, Tailwind CSS, Framer Motion, jsPDF
- Backend: Node.js, Express
- Database: MongoDB Atlas
- OCR: Google Cloud Vision API (primary) + Tesseract.js (fallback)
- Text extraction: pdf-parse + pdfjs-dist (PDF), mammoth (DOCX)
- AI: OpenAI GPT-3.5 / Google Gemini 2.0 Flash

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Environment Variables

Backend `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/doclyze
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_VISION_API_KEY=your_google_vision_api_key_here
API_KEY=your_secret_api_key_here
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:5000
```

## API

### Public Hackathon Endpoint

```
POST /api/document-analyze
Content-Type: application/json
x-api-key: YOUR_API_KEY
```

Request:
```json
{
  "fileName": "report.pdf",
  "fileType": "pdf",
  "fileBase64": "JVBERi0xLjQg..."
}
```

Supported `fileType` values: `pdf`, `docx`, `image`

Response:
```json
{
  "status": "success",
  "fileName": "report.pdf",
  "summary": "AI-generated summary of the document.",
  "entities": {
    "names": [],
    "dates": [],
    "organizations": [],
    "amounts": []
  },
  "sentiment": "Neutral",
  "confidence": 0.91,
  "document_type": "report"
}
```

### Internal UI Endpoint

```
POST /api/analyze
Content-Type: multipart/form-data
```

Returns a richer response with additional fields: confidence, metadata, extractedText, skills, projects, emails, phone_numbers, urls.

## Extraction Strategy

1. Text extraction: pdf-parse / mammoth / Tesseract.js OCR
2. Text cleaning: normalize whitespace, fix broken words, remove separators
3. Document classification: keyword-based scoring
4. Deterministic extraction: regex for emails, phones, URLs, dates, amounts
5. AI analysis: summary generation, sentiment, semantic entity supplement
6. Post-processing: merge regex + AI results, validate, deduplicate, filter
7. Confidence scoring: programmatic based on extraction quality

All outputs are dynamically generated from uploaded file content. No hardcoded responses.

## Project Structure

```
doclyze/
├── backend/
│   ├── server.js                  # Express server, routes
│   ├── config/database.js         # MongoDB connection
│   ├── models/Document.js         # Mongoose schema
│   └── services/
│       ├── analyzer.js            # Main pipeline orchestrator
│       ├── textExtractor.js       # PDF/DOCX/OCR extraction
│       ├── textCleaner.js         # Text normalization
│       ├── docTypeDetector.js     # Document classification
│       ├── regexExtractor.js      # Deterministic entity extraction
│       ├── aiAnalyzer.js          # AI summary/sentiment/entities
│       ├── postProcessor.js       # Merge, validate, confidence
│       └── publicMapper.js        # Internal → hackathon response mapping
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Landing, Dashboard, Processing, ApiDocs
│   │   ├── components/            # Navbar, Footer, Button, DocumentTransformVisual
│   │   └── lib/                   # API client, utilities
│   └── public/
└── README.md
```

## License

MIT
