import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FileText, Sparkles, TrendingUp, Copy, Check, Clock, File,
  MapPin, Calendar, DollarSign, User, Building, Code, FolderOpen,
  Mail, Phone, Link2, ChevronDown, Eye, Plus, Download, Search,
  ExternalLink, AlertTriangle, RefreshCw, Activity, Cpu, Gauge,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Footer } from '@/components/Footer'
import { PremiumButton } from '@/components/PremiumButton'
import { AnalysisResult } from '@/lib/api'
import { formatFileSize } from '@/lib/utils'
import { generatePDFReport } from '@/lib/generateReport'

const ENTITY_GROUPS = [
  { key: 'persons',          label: 'Names',         icon: User,      color: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.2)' },
  { key: 'organizations',    label: 'Organizations', icon: Building,  color: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)' },
  { key: 'skills',           label: 'Skills',        icon: Code,      color: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.18)' },
  { key: 'projects',         label: 'Projects',      icon: FolderOpen,color: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)' },
  { key: 'locations',        label: 'Locations',     icon: MapPin,    color: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)' },
  { key: 'dates',            label: 'Dates',         icon: Calendar,  color: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)' },
  { key: 'monetary_amounts', label: 'Amounts',       icon: DollarSign,color: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.18)' },
  { key: 'urls',             label: 'URLs',          icon: Link2,     color: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)' },
] as const

// ── Shared card style ──────────────────────────────────────────
const CARD = {
  primary: {
    background: 'rgba(16,14,30,0.85)',
    border: '1px solid rgba(99,102,241,0.16)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.3)',
  },
  secondary: {
    background: 'rgba(12,11,22,0.7)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
  },
}

// ── Processing Insights card ──────────────────────────────────
function ProcessingInsights({ result }: { result: AnalysisResult }) {
  const rows = [
    result.fileSize > 0 && {
      icon: File,
      label: 'File Size',
      value: (result.fileSize / 1024).toFixed(1) + ' KB',
    },
    result.metadata?.processing_time_ms > 0 && {
      icon: Clock,
      label: 'Processing Time',
      value: (result.metadata.processing_time_ms / 1000).toFixed(1) + ' s',
    },
    {
      icon: Cpu,
      label: 'OCR Engine',
      value: result.metadata?.ocr_used
        ? (result.metadata.ocr_engine === 'vision' ? 'Vision OCR' : result.metadata.ocr_engine || 'OCR')
        : 'Not Used',
      muted: !result.metadata?.ocr_used,
    },
    result.confidence > 0 && {
      icon: Gauge,
      label: 'Confidence',
      value: Math.round(result.confidence * 100) + '%',
      accent: result.confidence >= 0.7 ? '#6366f1' : result.confidence >= 0.4 ? '#fbbf24' : '#f87171',
    },
  ].filter(Boolean) as Array<{
    icon: React.ElementType
    label: string
    value: string
    muted?: boolean
    accent?: string
  }>

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.35 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(12,11,22,0.7)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Activity className="h-3.5 w-3.5" style={{ color: 'rgba(99,102,241,0.7)' }} />
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Processing Insights
        </span>
      </div>

      {/* Rows */}
      <div className="px-4 py-3 space-y-3">
        {rows.map(({ icon: Icon, label, value, muted, accent }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
            <span
              className="text-[12px] font-semibold tabular-nums shrink-0"
              style={{ color: accent ?? (muted ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.75)') }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const loc = useLocation()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedJson, setCopiedJson] = useState(false)
  const [showText, setShowText] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  useEffect(() => {
    if (loc.state?.result) {
      setResult(loc.state.result)
      try { sessionStorage.setItem('doclyze_last_result', JSON.stringify(loc.state.result)) } catch {}
    }
    if (loc.state?.error) setError(loc.state.error)
    if (!loc.state?.result && !loc.state?.error) {
      try {
        const saved = sessionStorage.getItem('doclyze_last_result')
        if (saved) setResult(JSON.parse(saved))
      } catch {}
    }
  }, [loc.state])

  useEffect(() => {
    const file = loc.state?.file as File | undefined
    if (file) {
      setUploadedFile(file)
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [loc.state])

  const resetAll = () => {
    setResult(null); setError(null); setPreview(null); setUploadedFile(null)
    try { sessionStorage.removeItem('doclyze_last_result') } catch {}
  }

  const copyJson = () => {
    if (!result) return
    const { extractedText, ...clean } = result
    navigator.clipboard.writeText(JSON.stringify(clean, null, 2))
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  const downloadReport = () => {
    if (!result) return
    generatePDFReport(result, result.fileName || uploadedFile?.name || 'report')
  }

  const fileExt = result?.fileName?.split('.').pop()?.toLowerCase()
  const fileIconColor = fileExt === 'pdf' ? { bg: 'rgba(239,68,68,0.1)', color: '#f87171' }
    : fileExt === 'docx' ? { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' }
    : { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa' }

  const confidence = result ? result.confidence * 100 : 0
  const isLowConfidence = confidence < 40
  const isFailed = result && !result.success

  const sentimentColor = result?.sentiment.label === 'positive' ? { text: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' }
    : result?.sentiment.label === 'negative' ? { text: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' }
    : { text: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' }

  const hasEntities = result && Object.values(result.entities).some(a => Array.isArray(a) && a.length > 0)

  if (!result && !error) { nav('/', { replace: true }); return null }
  return (
    <div className="min-h-screen" style={{ background: '#07070f' }}>
      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50"
        style={{
          height: '64px',
          background: 'rgba(10,10,20,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Logo size="md" linkTo="/" />
          <div className="flex items-center gap-2.5">
            <PremiumButton
              size="sm"
              onClick={() => { resetAll(); nav('/') }}
            >
              <Plus className="h-3.5 w-3.5" /> Analyze Another
            </PremiumButton>
            <PremiumButton
              size="sm"
              onClick={downloadReport}
            >
              <Download className="h-3.5 w-3.5" /> Download Report
            </PremiumButton>
          </div>
        </div>
      </nav>

      {/* ── Page ── */}
      <div className="relative z-10 pt-16 pb-16 px-4 sm:px-6">
        <div className="max-w-[1280px] mx-auto">

          {/* ── Error state ── */}
          {error && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-xl p-5 flex items-start gap-4"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">Processing Error</p>
                <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{error}</p>
                <button onClick={() => { resetAll(); nav('/') }}
                  className="mt-3 flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: 'rgba(99,102,241,0.8)' }}>
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              </div>
            </motion.div>
          )}

          {result && (
            <div className="flex gap-6 items-start">

              {/* ═══ LEFT: Report content ═══ */}
              <div className="flex-1 min-w-0 space-y-4">

                {/* ── Status strip ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 flex-wrap"
                  style={CARD.primary}>
                  {/* File icon */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: fileIconColor.bg }}>
                    <FileText className="w-5 h-5" style={{ color: fileIconColor.color }} />
                  </div>
                  {/* Name + type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-[15px] font-bold text-white truncate">{result.fileName}</h1>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider shrink-0"
                        style={{ color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        {result.document_type}
                      </span>
                      {isFailed && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider"
                          style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          Failed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                      <span className="flex items-center gap-1"><File className="h-3 w-3" />{formatFileSize(result.fileSize)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(result.metadata.processing_time_ms / 1000).toFixed(1)}s</span>
                      {result.metadata?.ocr_used && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ color: '#a78bfa', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                          {result.metadata.ocr_engine === 'vision' ? '✦ Vision OCR' : 'OCR'}
                        </span>
                      )}
                      {result.metadata?.pages_processed > 1 && (
                        <span>{result.metadata.pages_processed} pages</span>
                      )}
                    </div>
                  </div>
                  {/* Confidence */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Confidence</div>
                    <div className="text-[22px] font-bold leading-none"
                      style={{ color: isLowConfidence ? '#f87171' : confidence < 70 ? '#fbbf24' : '#6366f1' }}>
                      {confidence.toFixed(0)}%
                    </div>
                    {isLowConfidence && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(248,113,113,0.7)' }}>Low confidence</div>
                    )}
                  </div>
                </motion.div>

                {/* ── Low confidence / failed warning ── */}
                {(isFailed || isLowConfidence) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
                    className="rounded-xl px-5 py-4 flex items-start gap-3"
                    style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'rgba(251,191,36,0.7)' }} />
                    <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {isFailed
                        ? 'Text extraction was limited for this document. OCR was attempted but the extracted content may be insufficient for reliable analysis.'
                        : 'Extraction confidence is low. Results may be incomplete — consider re-uploading a higher quality version of this document.'}
                    </p>
                  </motion.div>
                )}
                {/* ── PRIMARY: Summary ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="rounded-xl p-6" style={CARD.primary}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-[15px] font-bold text-white">AI Generated Summary</h2>
                  </div>
                  {result.summary && result.summary.length > 20 && !isFailed ? (
                    <p className="text-[14px] leading-[1.75]" style={{ color: 'rgba(255,255,255,0.72)' }}>{result.summary}</p>
                  ) : (
                    <div className="py-4 flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'rgba(251,191,36,0.5)' }} />
                      <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Summary could not be generated. The document may be a scanned image with insufficient text quality.
                      </p>
                    </div>
                  )}
                </motion.div>

                {/* ── PRIMARY: Entities ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                  className="rounded-xl p-6" style={CARD.primary}>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-[15px] font-bold text-white">Extracted Entities</h2>
                    {hasEntities && (
                      <span className="ml-auto text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Click any tag to copy
                      </span>
                    )}
                  </div>

                  {hasEntities ? (
                    <div className="space-y-5">
                      {ENTITY_GROUPS.map(({ key, label, icon: Icon, color, border }) => {
                        const items = (result.entities as Record<string, string[]>)[key]
                        if (!items || items.length === 0) return null
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <Icon className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                              <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>({items.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map((item, i) => (
                                <motion.span key={i}
                                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.14 + i * 0.025 }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer select-none"
                                  style={{ color: 'rgba(255,255,255,0.8)', background: color, border: `1px solid ${border}` }}
                                  onClick={() => navigator.clipboard.writeText(item)}>
                                  {item}
                                </motion.span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {/* Emails + Phones */}
                      {(result.entities.emails?.length > 0 || result.entities.phone_numbers?.length > 0) && (
                        <div className="flex flex-wrap gap-8 pt-1">
                          {result.entities.emails?.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2.5">
                                <Mail className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                                <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Emails</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {result.entities.emails.map((e, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer"
                                    style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                                    onClick={() => navigator.clipboard.writeText(e)}>{e}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {result.entities.phone_numbers?.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2.5">
                                <Phone className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                                <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Phone</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {result.entities.phone_numbers.map((p, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer"
                                    style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                                    onClick={() => navigator.clipboard.writeText(p)}>{p}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-5 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <FileText className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>No entities extracted</p>
                        <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
                          {result.metadata?.ocr_used ? 'OCR was used — image quality may have limited extraction.' : 'The document may not contain structured entities.'}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* ── SECONDARY: Sentiment (compact) ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                  className="rounded-xl px-5 py-4 flex items-center gap-4" style={CARD.secondary}>
                  <div className="flex items-center gap-2 flex-1">
                    <TrendingUp className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Sentiment</span>
                  </div>
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold"
                    style={{ color: sentimentColor.text, background: sentimentColor.bg, border: `1px solid ${sentimentColor.border}` }}>
                    <span className="h-[5px] w-[5px] rounded-full" style={{ background: sentimentColor.text }} />
                    {result.sentiment.label.charAt(0).toUpperCase() + result.sentiment.label.slice(1)}
                  </span>
                </motion.div>

                {/* ── SECONDARY: Extracted Text (accordion) ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="rounded-xl overflow-hidden" style={CARD.secondary}>
                  <button onClick={() => setShowText(!showText)}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.015] transition-colors">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Extracted Text</span>
                    </div>
                    <motion.div animate={{ rotate: showText ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
                    </motion.div>
                  </button>
                  {showText && (
                    <div className="px-5 pb-4">
                      <pre className="rounded-lg p-4 overflow-auto text-[12px] font-mono whitespace-pre-wrap max-h-[280px] leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.25)' }}>
                        {result.extractedText || 'No text available'}
                      </pre>
                    </div>
                  )}
                </motion.div>

                {/* ── SECONDARY: Raw JSON (accordion) ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
                  className="rounded-xl overflow-hidden" style={CARD.secondary}>
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <button onClick={() => setShowJson(!showJson)} className="flex items-center gap-2">
                      <Code className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Raw JSON</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded ml-1" style={{ color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>Dev</span>
                      <motion.div animate={{ rotate: showJson ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-1">
                        <ChevronDown className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
                      </motion.div>
                    </button>
                    <button onClick={copyJson}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {copiedJson ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                    </button>
                  </div>
                  {showJson && (
                    <div className="px-5 pb-4">
                      <pre className="rounded-lg p-4 overflow-auto text-[11px] font-mono max-h-[380px] leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.25)' }}>
                        {JSON.stringify((() => { const { extractedText, ...c } = result; return c })(), null, 2)}
                      </pre>
                    </div>
                  )}
                </motion.div>

              </div>{/* end left column */}
              {/* ═══ RIGHT: Sidebar (sticky) ═══ */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                className="w-[280px] xl:w-[320px] shrink-0 hidden lg:block">
                <div className="sticky top-[72px] space-y-4">

                  {/* ── Document Preview ── */}
                  <div className="rounded-xl overflow-hidden" style={CARD.secondary}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Document Preview</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }}><Search className="h-3 w-3" /></button>
                        <button className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }}><ExternalLink className="h-3 w-3" /></button>
                      </div>
                    </div>
                    {/* Preview body */}
                    <div className="p-3" style={{ minHeight: '420px' }}>
                      {preview && uploadedFile?.type.startsWith('image/') ? (
                        <img src={preview} alt="Preview" className="w-full rounded-lg object-contain" style={{ maxHeight: '560px' }} />
                      ) : preview && uploadedFile?.type === 'application/pdf' ? (
                        <iframe src={preview} title="PDF" className="w-full rounded-lg border-0" style={{ height: '560px' }} />
                      ) : uploadedFile?.type?.includes('wordprocessingml') ? (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                            <FileText className="h-7 w-7 text-blue-400 shrink-0" />
                            <div>
                              <p className="text-[13px] font-medium text-white">{uploadedFile.name}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Word Document · {(uploadedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>DOCX preview not available in browser</p>
                        </div>
                      ) : !preview && result ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                          <Eye className="h-7 w-7" style={{ color: 'rgba(255,255,255,0.1)' }} />
                          <p className="text-[12px] text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            Analysis restored from session.<br />Re-upload to see preview.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 p-1">
                          {[1,2,3,4,5].map(b => (
                            <div key={b} className="space-y-1.5">
                              {b === 1 && <div className="h-3 rounded" style={{ width: '38%', background: 'rgba(139,92,246,0.1)' }} />}
                              {[100,88,75,55].map((w,j) => (
                                <div key={j} className="h-[4px] rounded" style={{ width: `${w - b * 5}%`, background: 'rgba(255,255,255,0.05)' }} />
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Metadata footer */}
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-[10px] truncate max-w-[160px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{result.fileName}</span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>{formatFileSize(result.fileSize)}</span>
                    </div>
                  </div>

                  {/* ── Processing Insights ── */}
                  <ProcessingInsights result={result} />

                </div>
              </motion.div>

            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}