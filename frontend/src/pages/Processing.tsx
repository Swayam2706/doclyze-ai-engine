import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Logo } from '@/components/Logo'

const LABELS = ['Extracting text','OCR Processing','Identifying entities','Analyzing sentiment','Generating summary']
const MSGS = [
  'Extracting readable text from your document',
  'Running OCR — detecting structure and layout',
  'Identifying key entities like names, dates, and organizations',
  'Analyzing the overall tone and sentiment',
  'Generating a concise AI summary of the document',
]
const STEP_RANGES = [[0,20],[20,40],[40,60],[60,80],[80,100]]

const AI_MESSAGES = [
  'Extracting structure...',
  'Understanding context...',
  'Parsing document layout...',
  'Identifying key patterns...',
  'Generating insights...',
  'Analyzing relationships...',
  'Processing semantic content...',
  'Building knowledge graph...',
]

function getFileType(file: File): string {
  if (file.type === 'application/pdf') return 'PDF'
  if (file.type.includes('wordprocessingml')) return 'DOCX'
  if (file.type.startsWith('image/')) return 'IMAGE'
  return file.name.split('.').pop()?.toUpperCase() || 'FILE'
}

function getFileBadgeStyle(type: string) {
  if (type === 'PDF') return { color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' }
  if (type === 'DOCX') return { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' }
  return { color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' }
}

export default function Processing() {
  const loc = useLocation()
  const nav = useNavigate()
  const file = loc.state?.file as File | undefined
  const [progress, setProgress] = useState(0)
  const [apiDone, setApiDone] = useState(false)
  const [apiStep, setApiStep] = useState(-1)
  const [showCancel, setShowCancel] = useState(false)
  const apiResultRef = useRef<{ok:boolean,data?:any,error?:string}|null>(null)
  const cancelledRef = useRef(false)
  const [tick, setTick] = useState(0)
  const [aiMsgIdx, setAiMsgIdx] = useState(0)
  const [preview, setPreview] = useState<string|null>(null)
  const [pdfPreview, setPdfPreview] = useState<string|null>(null)
  const uploadTime = useRef(new Date().toLocaleTimeString())

  useEffect(() => { if (!file) nav('/') }, [file, nav])

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (file.type.startsWith('image/')) setPreview(url)
    else if (file.type === 'application/pdf') setPdfPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!file) return
    const id = setInterval(() => { setTick(t => t + 1); setAiMsgIdx(i => (i + 1) % AI_MESSAGES.length) }, 600)
    return () => clearInterval(id)
  }, [file])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    const startDelay = setTimeout(() => {
      if (cancelled) return
      const id = setInterval(() => {
        if (cancelled) return
        setProgress(prev => {
          if (apiDone) {
            if (prev >= 100) { clearInterval(id); return 100 }
            return Math.min(100, prev + 3)
          }
          const stepFloor = apiStep >= 0 ? Math.min(90, (apiStep / 5) * 100) : 0
          const target = Math.max(stepFloor, prev)
          if (target >= 90) return 90
          const speed = target < 30 ? 1.8 : target < 60 ? 1.2 : target < 80 ? 0.6 : 0.3
          return Math.min(90, target + speed)
        })
      }, 80)
      cancelRef.current = () => { clearInterval(id) }
    }, 400)
    const cancelRef = { current: () => {} }
    return () => { cancelled = true; clearTimeout(startDelay); cancelRef.current() }
  }, [file, apiDone, apiStep])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    cancelledRef.current = false
    api.analyzeDocument(file, (evt) => {
      if (evt.step >= 0 && evt.step < 5) setApiStep(evt.step)
    }).then(result => {
      if (cancelled) return
      apiResultRef.current = { ok: true, data: result }
      setApiDone(true)
    }).catch(() => {
      if (cancelled) return
      apiResultRef.current = { ok: false, error: 'Failed to process document.' }
      setApiDone(true)
    })
    return () => { cancelled = true; cancelledRef.current = true }
  }, [file])

  useEffect(() => {
    if (progress < 100 || !apiResultRef.current) return
    const timer = setTimeout(() => {
      const r = apiResultRef.current
      if (r?.ok) nav('/dashboard', { state: { result: r.data, file } })
      else nav('/dashboard', { state: { error: r?.error || 'Processing failed.' } })
    }, 600)
    return () => clearTimeout(timer)
  }, [progress, nav])

  const activeStepIdx = useMemo(() => {
    for (let i = STEP_RANGES.length - 1; i >= 0; i--) {
      if (progress >= STEP_RANGES[i][0]) return i
    }
    return 0
  }, [progress])

  function getStatus(i: number): 'done'|'active'|'pending' {
    if (progress >= 100) return 'done'
    if (progress >= STEP_RANGES[i][1]) return 'done'
    if (progress >= STEP_RANGES[i][0]) return 'active'
    return 'pending'
  }

  function getSub(i: number): string {
    const n = (tick % 40) + 1
    if (i === 0) return `Reading page ${Math.min(n, 8)} of document...`
    if (i === 1) return `Analyzing section ${Math.min(n, 6)} of ${Math.max(6, n + 2)}...`
    if (i === 2) return `Scanning paragraph ${n} of ${n + 28}...`
    if (i === 3) return `Evaluating tone across ${n + 4} segments...`
    return 'Composing final insights...'
  }

  const handleCancel = () => {
    cancelledRef.current = true
    nav('/')
  }

  if (!file) return null
  const fileName = file.name || 'document'
  const fileExt = fileName.split('.').pop()?.toUpperCase() || 'FILE'
  const fileType = getFileType(file)
  const badgeStyle = getFileBadgeStyle(fileType)
  const showScanLine = progress < 100
  const statusText = progress >= 100 ? 'Analysis complete' : progress >= 80 ? 'Generating summary...' : progress >= 60 ? 'Analyzing sentiment...' : progress >= 40 ? 'Identifying entities...' : progress >= 20 ? 'Running OCR...' : 'Extracting text...'
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#07070f' }}>
      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
      {/* Soft radial glow behind center card */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />
      {/* Floating particles */}
      {[{x:'8%',y:'20%',d:3},{x:'88%',y:'15%',d:2},{x:'15%',y:'75%',d:2.5},{x:'82%',y:'70%',d:3},{x:'50%',y:'88%',d:2},{x:'92%',y:'45%',d:2.5}].map((p,i) => (
        <motion.div key={i} className="absolute rounded-full pointer-events-none"
          style={{ width: p.d, height: p.d, left: p.x, top: p.y, background: '#818cf8', opacity: 0.15 }}
          animate={{ y: [0, -12, 0], opacity: [0.08, 0.22, 0.08] }}
          transition={{ duration: 5 + i * 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
        />
      ))}

      {/* ── TOP NAVBAR ── */}
      <nav className="relative z-50 flex items-center justify-between px-6 h-14 shrink-0" style={{ background: 'rgba(10,10,20,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
        {/* Left: Logo */}
        <Logo size="sm" linkTo="/" />

        {/* Center: dynamic status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <motion.span className="h-[6px] w-[6px] rounded-full bg-[#22c55e]"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {statusText}
          </span>
        </div>

        {/* Right: progress % + cancel */}
        <div className="flex items-center gap-4">
          <span className="text-[13px] font-bold tabular-nums" style={{ color: '#6366f1' }}>
            {Math.floor(progress)}%
          </span>
          {!showCancel ? (
            <button onClick={() => setShowCancel(true)}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Cancel analysis?</span>
              <button onClick={handleCancel} className="text-[11px] px-2.5 py-1 rounded bg-destructive/80 text-white">Yes</button>
              <button onClick={() => setShowCancel(false)} className="text-[11px] px-2.5 py-1 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>No</button>
            </div>
          )}
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-[260px_1fr_360px] gap-6 items-start">

          {/* ── LEFT: File Context Panel ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="hidden lg:block">
            <div className="rounded-2xl p-5 space-y-4 transition-all duration-300" style={{ background: 'rgba(20,20,35,0.7)', border: '1px solid rgba(100,100,180,0.15)', backdropFilter: 'blur(16px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset' }}>
              {/* File icon + name */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: badgeStyle.bg, border: `1px solid ${badgeStyle.border}` }}>
                  <FileText className="h-5 w-5" style={{ color: badgeStyle.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{fileName}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider"
                    style={{ color: badgeStyle.color, background: badgeStyle.bg, border: `1px solid ${badgeStyle.border}` }}>
                    {fileType}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

              {/* Metadata */}
              <div className="space-y-2.5">
                {[
                  { label: 'Size', value: `${(file.size / 1024).toFixed(1)} KB` },
                  { label: 'Uploaded', value: uploadTime.current },
                  { label: 'Format', value: fileExt },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                    <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

              {/* Status badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                <motion.span className="h-[6px] w-[6px] rounded-full bg-[#6366f1] shrink-0"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                <span className="text-[11px] font-medium" style={{ color: '#6366f1' }}>
                  {progress >= 100 ? 'Complete' : 'AI Processing'}
                </span>
              </div>
            </div>
          </motion.div>
          {/* ── CENTER: Processing Card (unchanged logic, enhanced visuals) ── */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.85) 0%, rgba(30,25,55,0.7) 100%)', border: '1px solid rgba(100,100,180,0.15)', boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>

              {/* Header */}
              <div className="flex items-start gap-5 mb-10">
                <div className="relative shrink-0 w-[72px] h-[72px]">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(99,102,241,0.12)" strokeWidth="4" />
                    <motion.circle cx="36" cy="36" r="30" fill="none" stroke="url(#rg)" strokeWidth="4" strokeLinecap="round" strokeDasharray="188" animate={{ strokeDashoffset: [188, 47, 188] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a78bfa" /></linearGradient></defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" fill="#a78bfa" /></svg>
                      </motion.div>
                    </div>
                  </div>
                </div>
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-[6px] w-[6px] rounded-full bg-[#22c55e] animate-pulse" />
                    <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: '#6366f1' }}>AI Processing</span>
                  </div>
                  <h2 className="text-[22px] font-bold text-white leading-tight">Processing your document</h2>
                  <p className="text-[14px] mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>Extracting text, identifying entities, and generating<br />insights using AI.</p>
                </div>
              </div>

              {/* Progress bar with shimmer */}
              <div className="mb-6">
                <div className="flex items-end justify-between mb-3">
                  <span className="text-[14px] font-bold text-white">Overall Analysis</span>
                  <span className="text-[32px] font-bold tabular-nums leading-none" style={{ color: '#6366f1' }}>{Math.floor(progress)}%</span>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div className="h-full rounded-full relative overflow-hidden"
                    style={{ background: 'linear-gradient(90deg, #6366f1 0%, #a78bfa 60%, #c084fc 100%)' }}
                    animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: 'easeOut' }}>
                    {/* Shimmer */}
                    <motion.div className="absolute inset-0 opacity-60"
                      style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)' }}
                      animate={{ x: ['-100%', '200%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
                  </motion.div>
                  {/* Glow */}
                  <motion.div className="absolute top-0 bottom-0 w-8 rounded-full pointer-events-none"
                    style={{ background: 'rgba(139,92,246,0.6)', filter: 'blur(6px)', right: `${100 - progress}%` }}
                    animate={{ opacity: progress > 0 && progress < 100 ? [0.4, 0.8, 0.4] : 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }} />
                </div>
              </div>

              {/* Message bar */}
              <AnimatePresence mode="wait">
                <motion.div key={activeStepIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg mb-8"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <circle cx="8" cy="8" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    <text x="8" y="11.5" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="600">i</text>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <AnimatePresence mode="wait">
                      <motion.span key={aiMsgIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}
                        className="block text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {AI_MESSAGES[aiMsgIdx]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Steps */}
              <div className="space-y-1">
                {LABELS.map((label, i) => {
                  const st = getStatus(i)
                  return (
                    <motion.div key={i}
                      className="flex items-center gap-3 py-3 rounded-lg px-2 relative transition-all duration-300"
                      style={{ background: st === 'active' ? 'rgba(99,102,241,0.07)' : 'transparent', border: st === 'active' ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent', boxShadow: st === 'active' ? '0 0 0 1px rgba(99,102,241,0.08), 0 4px 16px rgba(99,102,241,0.08)' : 'none' }}
                      animate={st === 'active' ? { boxShadow: ['0 0 0 0 rgba(99,102,241,0)', '0 0 0 1px rgba(99,102,241,0.15)', '0 0 0 0 rgba(99,102,241,0)'] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}>
                      {st === 'active' && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: '#6366f1' }} />}
                      <div className="shrink-0 w-8 flex justify-center">
                        {st === 'done' && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.5" fill="rgba(34,197,94,0.08)" /><path d="M8 12.5L10.5 15L16 9.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </motion.div>
                        )}
                        {st === 'active' && (
                          <div className="relative">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" fill="rgba(99,102,241,0.08)" /></svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" fill="#a78bfa" /></svg>
                              </motion.div>
                            </div>
                          </div>
                        )}
                        {st === 'pending' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.15)" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-semibold" style={{ color: st === 'pending' ? 'rgba(255,255,255,0.35)' : '#fff' }}>{label}</span>
                        {st === 'active' && <p className="text-[12px] mt-0.5" style={{ color: 'rgba(139,92,246,0.7)' }}>{getSub(i)}</p>}
                      </div>
                      <div className="shrink-0">
                        {st === 'done' && <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}><span className="h-[5px] w-[5px] rounded-full bg-[#22c55e]" /> DONE</span>}
                        {st === 'active' && <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded" style={{ color: '#6366f1', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}><span className="h-[5px] w-[5px] rounded-full bg-[#6366f1] animate-pulse" /> ACTIVE</span>}
                        {st === 'pending' && <span className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>PENDING</span>}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
          {/* ── RIGHT: Document Preview ── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="hidden lg:block">
            <div className="rounded-2xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.7) 0%, rgba(25,22,45,0.5) 100%)', border: '1px solid rgba(100,100,180,0.12)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', backdropFilter: 'blur(16px)' }}>
              {/* Top bar */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <div className="h-[6px] w-[6px] rounded-full bg-[#6366f1] animate-pulse" />
                  <span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {showScanLine ? 'Analyzing content' : 'Analysis complete'}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)' }}>{fileExt}</span>
              </div>

              {/* Document body */}
              <div className="relative p-5" style={{ minHeight: '460px' }}>
                <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: 'rgba(10,10,20,0.12)' }} />

                {/* Scanning line — enhanced glow */}
                {showScanLine && (
                  <motion.div className="absolute left-0 right-0 z-20 pointer-events-none"
                    animate={{ top: ['0%', '100%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}>
                    <div style={{ height: '50px', marginTop: '-50px', background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.08))' }} />
                    <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent 0%, #6366f1 20%, #a78bfa 50%, #6366f1 80%, transparent 100%)', boxShadow: '0 0 8px rgba(99,102,241,0.8), 0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(99,102,241,0.15)', filter: 'blur(0.3px)' }} />
                    <div style={{ height: '70px', background: 'linear-gradient(to bottom, rgba(139,92,246,0.1), transparent)' }} />
                  </motion.div>
                )}
                {/* Floating "AI reading" label */}
                {showScanLine && (
                  <motion.div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full pointer-events-none"
                    style={{ background: 'rgba(10,10,20,0.75)', border: '1px solid rgba(99,102,241,0.18)', backdropFilter: 'blur(8px)' }}
                    animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                    <motion.span className="h-[5px] w-[5px] rounded-full bg-[#6366f1]"
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                    <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.5)' }}>AI reading document...</span>
                  </motion.div>
                )}

                {/* "Analyzing..." overlay label */}
                {showScanLine && (
                  <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(10,10,20,0.7)', border: '1px solid rgba(99,102,241,0.2)', backdropFilter: 'blur(8px)' }}>
                    <motion.span className="h-[5px] w-[5px] rounded-full bg-[#6366f1]"
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                    <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Analyzing...</span>
                  </div>
                )}

                {/* Preview content */}
                {preview ? (
                  <img src={preview} alt="Document preview" className="w-full h-auto rounded-lg object-contain max-h-[420px]" style={{ filter: 'brightness(0.85)' }} />
                ) : pdfPreview ? (
                  <iframe src={pdfPreview} title="PDF Preview" className="w-full rounded-lg border-0" style={{ height: '420px', filter: 'brightness(0.85)' }} />
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="h-3 rounded" style={{ width: '45%', background: 'rgba(255,255,255,0.08)' }} />
                      <div className="h-2 rounded" style={{ width: '30%', background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                    {[1,2,3,4,5].map(b => (
                      <div key={b} className="space-y-1.5">
                        {[100,95,88,70].map((w,j) => (
                          <div key={j} className="h-[6px] rounded" style={{ width: `${w-b*3}%`, background: 'rgba(255,255,255,0.05)' }} />
                        ))}
                        <div className="h-3" />
                      </div>
                    ))}
                    <div className="space-y-1">
                      {[1,2,3].map(r => (
                        <div key={r} className="flex gap-4">
                          <div className="h-[6px] rounded flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
                          <div className="h-[6px] rounded w-16" style={{ background: 'rgba(255,255,255,0.06)' }} />
                          <div className="h-[6px] rounded w-20" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        </div>
                      ))}
                    </div>
                    {[1,2,3].map(b => (
                      <div key={`x${b}`} className="space-y-1.5">
                        {[100,92,80].map((w,j) => (
                          <div key={j} className="h-[6px] rounded" style={{ width: `${w-b*5}%`, background: 'rgba(255,255,255,0.05)' }} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] truncate max-w-[180px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{fileName}</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}