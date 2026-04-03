import express from 'express'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import { connectDB } from './config/database.js'
import { analyzeDocument } from './services/analyzer.js'
import { mapToPublicResponse, mapToPublicError } from './services/publicMapper.js'
import Document from './models/Document.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// ── In-memory rate limiter ──────────────────────────────────
const rateLimitMap = new Map()
function rateLimit(windowMs = 60000, max = 60) {
  return (req, res, next) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const entry = rateLimitMap.get(key) || { count: 0, start: now }
    if (now - entry.start > windowMs) { entry.count = 1; entry.start = now }
    else entry.count++
    rateLimitMap.set(key, entry)
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
    }
    next()
  }
}

// ── CORS: allow all origins for public API ──────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization', 'x-job-id'],
}))
app.options('*', cors())

app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))

// ── Multer for multipart uploads ────────────────────────────
const storage = multer.memoryStorage()
const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
]
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIMES.includes(file.mimetype)),
})

// ── Multer for public endpoint (permissive — validate manually) ──
const uploadPublic = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

connectDB()

// ─── Health ─────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Doclyze API is running', timestamp: new Date().toISOString() })
})

// ─────────────────────────────────────────────────────────────
// PUBLIC HACKATHON ENDPOINT — POST /api/document-analyze
//
// Accepts BOTH:
//   1. application/json  → { fileName, fileType, fileBase64 }
//   2. multipart/form-data → file field (+ optional fileName, fileType)
// ─────────────────────────────────────────────────────────────

app.post('/api/document-analyze', rateLimit(60000, 60), uploadPublic.single('file'), async (req, res) => {
  const t0 = Date.now()
  let fileName = 'unknown'

  try {
    // ── API key validation ──────────────────────────────────
    const apiKey = req.headers['x-api-key']
    const expectedKey = process.env.API_KEY
    if (expectedKey) {
      if (!apiKey || apiKey !== expectedKey) {
        return res.status(401).json(mapToPublicError('unknown', 'Unauthorized: invalid or missing API key'))
      }
    }

    let buffer, mimetype

    // ── Route A: multipart/form-data file upload ────────────
    if (req.file) {
      buffer = req.file.buffer
      mimetype = req.file.mimetype
      fileName = req.file.originalname || req.body?.fileName || 'uploaded_file'

      // Normalize mimetype from file extension if browser sends octet-stream
      if (mimetype === 'application/octet-stream') {
        mimetype = mimetypeFromName(fileName)
      }
    }
    // ── Route B: JSON body with base64 ─────────────────────
    else {
      const body = req.body || {}
      fileName = body.fileName || 'unknown'
      const fileType = body.fileType || ''
      const fileBase64 = body.fileBase64 || ''

      if (!fileBase64) {
        return res.status(400).json(mapToPublicError(fileName,
          'Missing required fields: provide either a multipart file upload or JSON body with fileName, fileType, fileBase64'))
      }

      try {
        buffer = Buffer.from(fileBase64, 'base64')
      } catch {
        return res.status(400).json(mapToPublicError(fileName, 'Invalid base64 encoding'))
      }

      if (buffer.length < 10) {
        return res.status(400).json(mapToPublicError(fileName, 'File content is empty or too small'))
      }

      mimetype = resolveMimetype(fileType, fileName)
    }

    // ── Validate resolved mimetype ──────────────────────────
    if (!mimetype || !ALLOWED_MIMES.includes(mimetype)) {
      return res.status(400).json(mapToPublicError(fileName,
        `Unsupported file type. Supported: PDF, DOCX, PNG, JPG. Got: ${mimetype || 'unknown'}`))
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json(mapToPublicError(fileName, 'File too large. Maximum size is 10 MB.'))
    }

    console.log(`\n━━━ PUBLIC API: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB, mime=${mimetype}) ━━━`)

    const file = { buffer, mimetype, originalname: fileName, size: buffer.length }
    const internalResult = await analyzeDocument(file)

    const publicResponse = mapToPublicResponse(internalResult, fileName, buffer.length)

    // Save to DB best-effort
    try {
      await new Document({ fileName, fileSize: buffer.length, mimeType: mimetype,
        status: internalResult.success ? 'completed' : 'failed', result: internalResult }).save()
    } catch {}

    console.log(`  ✅ Public API done in ${Date.now() - t0}ms`)
    res.json(publicResponse)

  } catch (error) {
    console.error('Public API error:', error)
    res.status(500).json(mapToPublicError(fileName, 'Internal processing error'))
  }
})

// ─────────────────────────────────────────────────────────────
// INTERNAL APP ENDPOINT — POST /api/analyze (multipart)
// ─────────────────────────────────────────────────────────────

const progressStreams = new Map()

app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
  res.write('data: {"step":-1,"msg":"Connected"}\n\n')
  progressStreams.set(jobId, res)
  req.on('close', () => progressStreams.delete(jobId))
})

app.post('/api/analyze', rateLimit(60000, 60), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' })

    const jobId = req.headers['x-job-id'] || ''
    console.log(`\n━━━ INTERNAL API: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) ━━━`)

    const onProgress = (step, msg) => {
      const sseRes = progressStreams.get(jobId)
      if (sseRes) { try { sseRes.write(`data: ${JSON.stringify({ step, msg })}\n\n`) } catch {} }
    }

    const result = await analyzeDocument(req.file, onProgress)
    result.fileName = req.file.originalname
    result.fileSize = req.file.size

    const sseRes = progressStreams.get(jobId)
    if (sseRes) {
      try { sseRes.write(`data: ${JSON.stringify({ step: 5, msg: 'Complete' })}\n\n`); sseRes.end() } catch {}
      progressStreams.delete(jobId)
    }

    try {
      await new Document({ fileName: req.file.originalname, fileSize: req.file.size,
        mimeType: req.file.mimetype, status: result.success ? 'completed' : 'failed', result }).save()
    } catch {}

    res.json(result)
  } catch (error) {
    console.error('Internal API error:', error)
    res.status(500).json({ success: false, error: 'Failed to analyze document', message: error.message })
  }
})

// ─── Document history ───────────────────────────────────────
app.get('/api/documents', async (_req, res) => {
  try {
    const docs = await Document.find().sort({ uploadDate: -1 }).limit(10).select('-result.extractedText')
    res.json(docs)
  } catch { res.status(500).json({ error: 'Failed to fetch documents' }) }
})

app.get('/api/documents/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    res.json(doc)
  } catch { res.status(500).json({ error: 'Failed to fetch document' }) }
})

// ─── Error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong', message: err.message })
})

app.listen(PORT, () => {
  console.log(`🚀 Doclyze API running on http://localhost:${PORT}`)
  console.log(`   Public endpoint:   POST /api/document-analyze (JSON+base64 OR multipart)`)
  console.log(`   Internal endpoint: POST /api/analyze (multipart)`)
  console.log(`   API Key: ${process.env.API_KEY ? '✓ configured' : '✗ not set (open access)'}`)
})

// ─── Helpers ────────────────────────────────────────────────

/**
 * Resolve MIME type from fileType string or fileName extension.
 * Handles both "pdf"/"docx"/"image" shorthand AND full MIME types.
 */
function resolveMimetype(fileType, fileName) {
  const ft = (fileType || '').toLowerCase().trim()

  // Full MIME types passed directly
  if (ft === 'application/pdf') return 'application/pdf'
  if (ft === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (ft.startsWith('image/')) return ft

  // Shorthand types
  if (ft === 'pdf') return 'application/pdf'
  if (ft === 'docx' || ft === 'doc') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (ft === 'image' || ft === 'img') return mimetypeFromName(fileName)

  // Fallback: infer from file extension
  return mimetypeFromName(fileName)
}

function mimetypeFromName(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'docx' || ext === 'doc') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return ''
}
