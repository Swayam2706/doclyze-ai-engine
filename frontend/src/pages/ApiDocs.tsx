import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Code, FileText, Zap, Shield, AlertTriangle, BookOpen, TestTube, Terminal } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

// -- Premium code block ----------------------------------------
function CodeBlock({ code, id, copied, onCopy, lang }: {
  code: string; id: string; copied: string | null
  onCopy: (c: string, id: string) => void; lang?: string
}) {
  const isCopied = copied === id
  return (
    <div className="relative group rounded-xl overflow-hidden"
      style={{ background: '#0d0d16', border: '1px solid rgba(99,102,241,0.15)', boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(239,68,68,0.5)' }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(251,191,36,0.5)' }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(34,197,94,0.5)' }} />
          </div>
          {lang && <span className="text-[10px] font-semibold tracking-wider uppercase ml-2" style={{ color: 'rgba(255,255,255,0.25)' }}>{lang}</span>}
        </div>
        <button onClick={() => onCopy(code, id)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150"
          style={{
            color: isCopied ? '#22c55e' : 'rgba(255,255,255,0.4)',
            background: isCopied ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isCopied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
          }}>
          {isCopied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      {/* Code */}
      <pre className="p-4 overflow-x-auto text-[12.5px] leading-[1.7] font-mono"
        style={{ color: 'rgba(255,255,255,0.75)' }}>{code}</pre>
    </div>
  )
}

// -- Tabbed code examples --------------------------------------
function TabbedCode({ tabs, copied, onCopy }: {
  tabs: { label: string; lang: string; id: string; code: string }[]
  copied: string | null
  onCopy: (c: string, id: string) => void
}) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        {tabs.map((tab, i) => (
          <button key={tab.id} onClick={() => setActive(i)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150"
            style={{
              color: active === i ? '#818cf8' : 'rgba(255,255,255,0.35)',
              background: active === i ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: `1px solid ${active === i ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
            }}>
            <Terminal className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={active} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          <CodeBlock code={tabs[active].code} id={tabs[active].id} copied={copied} onCopy={onCopy} lang={tabs[active].lang} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// -- Section card ----------------------------------------------
function SectionCard({ children, prominent = false }: { children: React.ReactNode; prominent?: boolean }) {
  return (
    <div className="rounded-xl p-6 space-y-5 transition-all duration-200"
      style={{
        background: prominent ? 'rgba(16,14,30,0.9)' : 'rgba(12,11,22,0.7)',
        border: prominent ? '1px solid rgba(99,102,241,0.18)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: prominent ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.2)',
      }}>
      {children}
    </div>
  )
}

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'auth', label: 'Authentication' },
  { id: 'endpoint', label: 'Endpoint' },
  { id: 'request', label: 'Request Format' },
  { id: 'response', label: 'Success Response' },
  { id: 'errors', label: 'Error Responses' },
  { id: 'testing', label: 'How to Test' },
  { id: 'examples', label: 'Code Examples' },
]
export default function ApiDocs() {
  const [copied, setCopied] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('overview')

  // Use deployed URL if available, otherwise show placeholder
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
  const API_DISPLAY = API_BASE.includes('localhost') ? 'https://your-deployed-api.com' : API_BASE

  const copy = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) setActiveSection(e.target.id) } },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    for (const item of NAV) { const el = document.getElementById(item.id); if (el) observer.observe(el) }
    return () => observer.disconnect()
  }, [])

  // -- Code strings ------------------------------------------
  const curlExample = `curl -X POST ${API_DISPLAY}/api/document-analyze \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: sk_doclyze_ai_2026" \\
  -d '{
    "fileName": "report.pdf",
    "fileType": "pdf",
    "fileBase64": "JVBERi0xLjQg..."
  }'`

  const requestBody = `{
  "fileName": "quarterly-report.pdf",
  "fileType": "pdf",
  "fileBase64": "JVBERi0xLjQgMCBvYmoKPDwvVHlwZS..."
}`

  const successResponse = `{
  "status": "success",
  "fileName": "quarterly-report.pdf",
  "summary": "The quarterly report outlines revenue growth of 15% in Q4 2024, driven by expansion in the technology sector. Key findings include increased operating efficiency and new partnerships with major industry players.",
  "entities": {
    "names": ["John Smith", "Jane Doe"],
    "dates": ["January 15, 2025", "Q4 2024"],
    "organizations": ["Acme Corp", "Global Industries"],
    "amounts": ["$12,450.00", "$3,200"],
    "emails": [],
    "phone_numbers": [],
    "locations": ["New York", "San Francisco"],
    "skills": [],
    "urls": []
  },
  "sentiment": "Positive",
  "fileSize": 33648,
  "document_type": "report",
  "confidence": 0.91,
  "metadata": {
    "ocr_used": false,
    "ocr_engine": null,
    "pages_processed": 2,
    "processing_time_ms": 8712
  }
}`

  const errorUnauth = `{ "status": "error", "fileName": "report.pdf", "message": "Unauthorized: invalid or missing API key" }`
  const errorBadReq = `{ "status": "error", "fileName": "unknown", "message": "Missing required fields: fileName, fileType, fileBase64" }`
  const errorServer = `{ "status": "error", "fileName": "corrupted.pdf", "message": "Internal processing error" }`

  const jsExample = `const fs = require('fs');
const axios = require('axios');

const fileBuffer = fs.readFileSync('document.pdf');
const fileBase64 = fileBuffer.toString('base64');

const response = await axios.post(
  '${API_DISPLAY}/api/document-analyze',
  { fileName: 'document.pdf', fileType: 'pdf', fileBase64 },
  { headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk_doclyze_ai_2026' } }
);

console.log(response.data.summary);
console.log(response.data.entities);
console.log(response.data.sentiment);`

  const pythonExample = `import base64, requests

with open("document.pdf", "rb") as f:
    file_base64 = base64.b64encode(f.read()).decode()

response = requests.post(
    "${API_DISPLAY}/api/document-analyze",
    json={"fileName": "document.pdf", "fileType": "pdf", "fileBase64": file_base64},
    headers={"Content-Type": "application/json", "x-api-key": "sk_doclyze_ai_2026"},
)

data = response.json()
print(data["summary"])
print(data["entities"])
print(data["sentiment"])`

  const base64Linux = `# Linux / macOS
base64 -i document.pdf -o document_b64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("document.pdf")) | Out-File document_b64.txt`

  const codeExampleTabs = [
    { label: 'cURL', lang: 'bash', id: 'curl', code: curlExample },
    { label: 'JavaScript', lang: 'javascript', id: 'js', code: jsExample },
    { label: 'Python', lang: 'python', id: 'py', code: pythonExample },
  ]
  return (
    <div className="min-h-screen" style={{ background: '#07070f' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
      <Navbar />
      <div className="relative z-10 pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12">

            {/* -- Sidebar -- */}
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-3">
              <div className="sticky top-24 space-y-0.5">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-4 px-3" style={{ color: 'rgba(255,255,255,0.25)' }}>API Reference</p>
                {NAV.map(item => {
                  const isActive = activeSection === item.id
                  return (
                    <a key={item.id} href={`#${item.id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 relative"
                      style={{
                        color: isActive ? '#818cf8' : 'rgba(255,255,255,0.38)',
                        background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                      }}>
                      {isActive && (
                        <motion.div layoutId="sidebarActive"
                          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                          style={{ background: '#6366f1' }} />
                      )}
                      <span className="ml-1">{item.label}</span>
                    </a>
                  )
                })}
              </div>
            </motion.div>

            {/* -- Content -- */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-9 space-y-8">

              {/* Overview */}
              <section id="overview">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)' }}>
                    <FileText className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold text-white">API Documentation</h1>
                </div>
                <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  The Doclyze Document Analysis API extracts structured intelligence from uploaded documents, including a concise summary, named entities, and sentiment classification.
                </p>
                <SectionCard>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h3 className="text-[13px] font-semibold text-white">Quick Facts</h3>
                  </div>
                  <ul className="space-y-2">
                    {[
                      'Accepts one document per request.',
                      'Supported: PDF, DOCX, and image files (PNG, JPG, JPEG).',
                      'All requests must include the x-api-key header.',
                      'Request body must be JSON with base64-encoded file content.',
                    ].map((fact, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#6366f1' }} />
                        {fact}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </section>

              {/* Authentication */}
              <section id="auth">
                <SectionCard prominent>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-[16px] font-bold text-white">Authentication</h2>
                  </div>
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Every request must include a valid API key. Missing or invalid keys return <code className="text-red-400 text-[12px] bg-red-400/10 px-1 rounded">401 Unauthorized</code>.
                  </p>
                  <CodeBlock code={`x-api-key: sk_doclyze_ai_2026`} id="auth-key" copied={copied} onCopy={copy} lang="header" />
                </SectionCard>
              </section>

              {/* Endpoint */}
              <section id="endpoint">
                <SectionCard prominent>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-[16px] font-bold text-white">Endpoint</h2>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase shrink-0" style={{ color: '#818cf8', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>POST</span>
                    <code className="text-[14px] font-mono font-semibold text-white">/api/document-analyze</code>
                    <button onClick={() => copy('/api/document-analyze', 'ep')} className="ml-auto p-1.5 rounded-lg transition-colors" style={{ color: copied === 'ep' ? '#22c55e' : 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)' }}>
                      {copied === 'ep' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Full URL: <code className="text-[#818cf8]">{API_DISPLAY}/api/document-analyze</code>
                  </p>
                </SectionCard>
              </section>

              {/* Request Format */}
              <section id="request">
                <SectionCard>
                  <div className="flex items-center gap-2">
                    <Code className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-[16px] font-bold text-white">Request Format</h2>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Content-Type</p>
                    <CodeBlock code="application/json" id="ct" copied={copied} onCopy={copy} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Body Fields</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Field', 'Type', 'Required', 'Description'].map(h => (
                              <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['fileName', 'string', 'Yes', 'Original file name'],
                            ['fileType', 'string', 'Yes', '"pdf", "docx", or "image"'],
                            ['fileBase64', 'string', 'Yes', 'Base64-encoded file content'],
                          ].map(([f, t, r, d]) => (
                            <tr key={f} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: '#818cf8' }}>{f}</td>
                              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{t}</td>
                              <td className="px-4 py-3 text-[11px] font-semibold" style={{ color: '#22c55e' }}>{r}</td>
                              <td className="px-4 py-3 text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{d}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-lg px-4 py-3 space-y-1.5" style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.1)' }}>
                    <p className="text-[11px] font-semibold" style={{ color: 'rgba(251,191,36,0.7)' }}>Important Notes</p>
                    {[
                      'Only one file per request.',
                      'For images, use "image" as fileType — not the file extension.',
                      'fileBase64 must be raw base64 without the data:...;base64, prefix.',
                      'Maximum file size: 10 MB.',
                    ].map((n, i) => (
                      <p key={i} className="text-[12px]" style={{ color: 'rgba(255,255,255,0.38)' }}>· {n}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Example Body</p>
                    <CodeBlock code={requestBody} id="req" copied={copied} onCopy={copy} lang="json" />
                  </div>
                </SectionCard>
              </section>

              {/* Success Response */}
              <section id="response">
                <SectionCard>
                  <h2 className="text-[16px] font-bold text-white">Success Response</h2>
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    HTTP 200 · <code className="text-[#818cf8]">application/json</code>
                  </p>

                  {/* Required fields */}
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'rgba(99,102,241,0.7)' }}>Required Fields</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Field', 'Type', 'Description'].map(h => (
                              <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['status', 'string', '"success" on success, "error" on failure'],
                            ['fileName', 'string', 'Original file name from request'],
                            ['summary', 'string', 'AI-generated concise document summary'],
                            ['entities.names', 'string[]', 'Extracted person names'],
                            ['entities.dates', 'string[]', 'Extracted dates and date ranges'],
                            ['entities.organizations', 'string[]', 'Extracted organization names'],
                            ['entities.amounts', 'string[]', 'Extracted monetary amounts'],
                            ['sentiment', 'string', '"Positive", "Neutral", or "Negative"'],
                          ].map(([f, t, d]) => (
                            <tr key={f} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: '#818cf8' }}>{f}</td>
                              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{t}</td>
                              <td className="px-4 py-3 text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{d}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Optional / extended fields */}
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Additional Fields (always present)</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <table className="w-full text-[13px]">
                        <tbody>
                          {[
                            ['entities.emails', 'string[]', 'Extracted email addresses'],
                            ['entities.phone_numbers', 'string[]', 'Extracted phone numbers'],
                            ['entities.locations', 'string[]', 'Extracted locations'],
                            ['entities.skills', 'string[]', 'Extracted skills (resumes)'],
                            ['entities.urls', 'string[]', 'Extracted URLs'],
                            ['document_type', 'string', 'Detected type: resume, invoice, report, letter, notice, general'],
                            ['confidence', 'number', 'Extraction confidence score (0–1)'],
                            ['fileSize', 'number', 'File size in bytes'],
                            ['metadata.ocr_used', 'boolean', 'Whether OCR was used'],
                            ['metadata.ocr_engine', 'string | null', '"vision" (Google Vision) or "tesseract", null if not used'],
                            ['metadata.pages_processed', 'number', 'Number of pages processed'],
                            ['metadata.processing_time_ms', 'number', 'Total processing time in milliseconds'],
                          ].map(([f, t, d]) => (
                            <tr key={f} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'rgba(129,140,248,0.7)' }}>{f}</td>
                              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{t}</td>
                              <td className="px-4 py-3 text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{d}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <CodeBlock code={successResponse} id="res" copied={copied} onCopy={copy} lang="json" />
                </SectionCard>
              </section>

              {/* Errors */}
              <section id="errors">
                <SectionCard>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
                    <h2 className="text-[16px] font-bold text-white">Error Responses</h2>
                  </div>
                  <div className="space-y-4">
                    {[
                      { code: '401', label: 'Unauthorized', example: errorUnauth },
                      { code: '400', label: 'Bad Request', example: errorBadReq },
                      { code: '500', label: 'Server Error', example: errorServer },
                    ].map(({ code, label, example }) => (
                      <div key={code}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>{code}</span>
                          <span className="text-[13px] font-semibold text-white">{label}</span>
                        </div>
                        <CodeBlock code={example} id={`e${code}`} copied={copied} onCopy={copy} lang="json" />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg px-4 py-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Error Conditions</p>
                    {[
                      ['Missing/invalid x-api-key', '401'],
                      ['Missing required body fields', '400'],
                      ['Unsupported fileType', '400'],
                      ['Invalid base64 content', '400'],
                      ['OCR/extraction/model failure', '500'],
                    ].map(([cond, status]) => (
                      <div key={cond} className="flex items-center justify-between">
                        <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.38)' }}>· {cond}</span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: '#f87171' }}>{status}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </section>

              {/* How to Test */}
              <section id="testing">
                <SectionCard>
                  <div className="flex items-center gap-2">
                    <TestTube className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-[16px] font-bold text-white">How to Test</h2>
                  </div>
                  <div className="space-y-5">
                    {[
                      { step: '1', title: 'Convert file to base64', desc: 'Read a supported file and encode its binary content.', code: base64Linux, lang: 'bash' },
                      { step: '2', title: 'Build the JSON body', desc: 'Create a JSON object with fileName, fileType, and fileBase64.', code: requestBody, lang: 'json' },
                      { step: '3', title: 'Send with API key', desc: 'POST to /api/document-analyze with the x-api-key header.', code: curlExample, lang: 'bash' },
                    ].map(({ step, title, desc, code, lang }) => (
                      <div key={step} className="flex gap-4">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)', color: '#818cf8' }}>{step}</div>
                        <div className="flex-1 space-y-2">
                          <p className="text-[13px] font-semibold text-white">{title}</p>
                          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{desc}</p>
                          <CodeBlock code={code} id={`test${step}`} copied={copied} onCopy={copy} lang={lang} />
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </section>

              {/* Code Examples � tabbed */}
              <section id="examples">
                <SectionCard>
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-[16px] font-bold text-white">Code Examples</h2>
                  </div>
                  <TabbedCode tabs={codeExampleTabs} copied={copied} onCopy={copy} />
                </SectionCard>
              </section>

            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}