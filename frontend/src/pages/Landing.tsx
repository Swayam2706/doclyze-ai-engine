import React, { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Upload, Sparkles, Zap, Shield } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { DocumentTransformVisual } from '@/components/DocumentTransformVisual'

// ── Workflow step card ────────────────────────────────────────
function WorkflowCard({ index, step, title, description, blobColor, blobColor2, icon, visual }: {
  index: number
  step: string
  title: string
  description: string
  blobColor: string
  blobColor2: string
  icon: React.ReactNode
  visual: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay: index * 0.12 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex-1"
      style={{
        zIndex: 1,
        borderRadius: '14px',
        overflow: 'hidden',
        minHeight: '320px',
        /* Reference: outer card shadow — adapted dark */
        boxShadow: hovered
          ? '0 20px 60px rgba(0,0,0,0.7), 0 -20px 60px rgba(99,102,241,0.12)'
          : '0 20px 60px rgba(0,0,0,0.55), 0 -20px 60px rgba(99,102,241,0.07)',
        transition: 'box-shadow 0.3s, transform 0.3s',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── .blob — bounces corner-to-corner behind the glass ── */}
      <motion.div
        style={{
          position: 'absolute',
          zIndex: 1,
          top: '50%',
          left: '50%',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: blobColor,
          opacity: hovered ? 0.9 : 0.75,
          filter: 'blur(28px)',
          transition: 'opacity 0.3s',
        }}
        animate={{
          /* Exact reference keyframes: 0→right→corner→down→start */
          x: ['-100%', '0%', '0%', '-100%', '-100%'],
          y: ['-100%', '-100%', '0%', '0%', '-100%'],
        }}
        transition={{
          duration: 5 + index * 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Second blob for depth */}
      <motion.div
        style={{
          position: 'absolute',
          zIndex: 1,
          top: '50%',
          left: '50%',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: blobColor2,
          opacity: hovered ? 0.6 : 0.4,
          filter: 'blur(20px)',
          transition: 'opacity 0.3s',
        }}
        animate={{
          x: ['0%', '-100%', '-100%', '0%', '0%'],
          y: ['0%', '0%', '-100%', '-100%', '0%'],
        }}
        transition={{
          duration: 7 + index * 0.6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1.5,
        }}
      />

      {/* ── .bg — inner glass surface, inset 5px from edges ── */}
      <div
        style={{
          position: 'absolute',
          top: 5,
          left: 5,
          right: 5,
          bottom: 5,
          zIndex: 2,
          borderRadius: '10px',
          overflow: 'hidden',
          /* Reference: rgba(255,255,255,.95) → dark version */
          background: 'rgba(13, 11, 26, 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          outline: `1px solid ${hovered ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.14)'}`,
          transition: 'outline-color 0.3s',
        }}
      />

      {/* ── Content sits above .bg (z-index: 3) ── */}
      <div style={{ position: 'relative', zIndex: 3, padding: '28px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Step number + icon row */}
        <div className="flex items-start justify-between mb-5">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ color: 'rgba(139,92,246,0.7)' }}>
            Step {step}
          </span>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.18)',
            }}>
            {icon}
          </div>
        </div>

        {/* Visual area */}
        <div className="flex-1 flex items-center justify-center mb-5 min-h-[80px]">
          {visual}
        </div>

        {/* Divider */}
        <div className="mb-4" style={{ height: '1px', background: 'hsla(240,9%,17%,1)' }} />

        {/* Text */}
        <div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Step visuals ──────────────────────────────────────────────
function UploadVisual() {
  return (
    <div className="relative flex items-center justify-center w-full">
      {/* Pulsing dotted border dropzone */}
      <motion.div
        className="w-24 h-24 rounded-2xl flex items-center justify-center"
        style={{
          border: '1.5px dashed rgba(99,102,241,0.35)',
          background: 'rgba(99,102,241,0.04)',
        }}
        animate={{ borderColor: ['rgba(99,102,241,0.25)', 'rgba(139,92,246,0.55)', 'rgba(99,102,241,0.25)'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 15V3M12 3L8 7M12 3L16 7" stroke="rgba(139,92,246,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 15V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V15" stroke="rgba(99,102,241,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </motion.div>
      </motion.div>
      {/* Format badges */}
      <div className="absolute -right-2 top-0 flex flex-col gap-1">
        {['PDF', 'DOCX'].map((f, i) => (
          <motion.span key={f} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: 'rgba(139,92,246,0.8)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
            {f}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

function ProcessVisual() {
  return (
    <div className="w-full space-y-2 px-2">
      {[
        { label: 'Extracting text', w: '85%', delay: 0 },
        { label: 'Identifying entities', w: '65%', delay: 0.3 },
        { label: 'Analyzing sentiment', w: '75%', delay: 0.6 },
      ].map(({ label, w, delay }) => (
        <div key={label}>
          <div className="flex justify-between mb-1">
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #6366f1, #a78bfa)' }}
              initial={{ width: 0 }}
              animate={{ width: [0, w, w, 0] }}
              transition={{ duration: 3, delay, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function InsightsVisual() {
  return (
    <div className="w-full space-y-2 px-2">
      {[
        { label: 'Summary', color: 'rgba(99,102,241,0.7)', delay: 0 },
        { label: 'Entities', color: 'rgba(139,92,246,0.7)', delay: 0.2 },
        { label: 'Sentiment', color: 'rgba(167,139,250,0.7)', delay: 0.4 },
      ].map(({ label, color, delay }) => (
        <motion.div key={label}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay, duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
          className="flex items-center gap-2"
        >
          <span className="h-[5px] w-[5px] rounded-full shrink-0" style={{ background: color }} />
          <div className="flex-1 h-[3px] rounded-full" style={{ background: color, opacity: 0.4 }} />
          <span className="text-[9px] font-semibold" style={{ color }}>{label}</span>
        </motion.div>
      ))}
    </div>
  )
}

const ACCEPTED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/jpg',
]

// ── Premium CTA Button ────────────────────────────────────────
function CTAButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="relative inline-flex items-center gap-3 px-10 py-4 rounded-full font-semibold text-white overflow-hidden"
      style={{
        backgroundImage: 'linear-gradient(135deg, #5e3aee 0%, #7c3aed 50%, #6366f1 100%)',
        boxShadow: hovered
          ? 'inset 0 -2px 20px -4px rgba(255,255,255,0.2), 0 8px 32px rgba(99,102,241,0.5), 0 2px 8px rgba(0,0,0,0.3)'
          : 'inset 0 -2px 20px -4px rgba(255,255,255,0.12), 0 4px 20px rgba(99,102,241,0.25)',
        transform: pressed ? 'scale(0.97)' : hovered ? 'scale(1.03) translateY(-2px)' : 'scale(1)',
        transition: 'box-shadow 0.2s, transform 0.15s',
        fontSize: '16px',
      }}
    >
      {/* Shimmer sweep */}
      {hovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)' }}
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
      {/* Animated upload icon */}
      <motion.div
        animate={hovered ? { y: [-1, -4, -1] } : { y: 0 }}
        transition={{ duration: 0.6, repeat: hovered ? Infinity : 0 }}
      >
        <Upload className="h-5 w-5" />
      </motion.div>
      Upload a Document
    </button>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setError(`Unsupported format: "${file.name.split('.').pop()?.toUpperCase()}". Use PDF, DOCX, PNG, or JPG.`)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`)
      return
    }
    setError(null)
    navigate('/processing', { state: { file } })
  }, [navigate])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div className="min-h-screen" style={{ background: '#07070f' }}>
      <Navbar />

      {/* ── GLOBAL ANIMATED BACKGROUND — grid + dots only ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {/* Grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }} />
        {/* Floating dots */}
        {[
          { x: '12%', y: '22%', d: 3, delay: 0 },
          { x: '85%', y: '18%', d: 2.5, delay: 1.2 },
          { x: '42%', y: '70%', d: 3, delay: 2.4 },
          { x: '72%', y: '55%', d: 2, delay: 0.8 },
          { x: '22%', y: '62%', d: 2.5, delay: 3.1 },
          { x: '91%', y: '42%', d: 2, delay: 1.8 },
          { x: '8%',  y: '78%', d: 3, delay: 2.9 },
          { x: '55%', y: '88%', d: 2, delay: 0.4 },
          { x: '65%', y: '30%', d: 2.5, delay: 3.6 },
        ].map((p, i) => (
          <motion.div key={i}
            className="absolute rounded-full"
            style={{ width: p.d, height: p.d, left: p.x, top: p.y, background: '#fff', opacity: 0.15 }}
            animate={{ y: [0, -14, 0], opacity: [0.08, 0.22, 0.08] }}
            transition={{ duration: 6 + i * 0.9, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          />
        ))}
      </div>

      {/* ── Hero ── */}
      <section className="relative min-h-screen pt-24 pb-16 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Premium glass container wrapping all hero content */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(139,92,246,0.1)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 32px 80px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {/* Top highlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px rounded-full pointer-events-none"
              style={{ width: '50%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />

            {/* Soft center glow behind content */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 100%)' }} />

          <div className="relative z-10 p-6 sm:p-10 grid gap-12 lg:grid-cols-2 lg:gap-10 items-center min-h-[calc(100vh-12rem)]">

            {/* Left: headline + upload card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col justify-center"
            >
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  AI Document Intelligence
                </span>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Turn Documents Into{' '}
                <span className="text-primary">Intelligence</span>
              </h1>

              <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl">
                Extract summaries, entities, and insights from PDFs, DOCX, and images in seconds.
              </p>

              {/* ── Upload Card ── */}
              <motion.div
                id="upload-section"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-10"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  onChange={onInputChange}
                  className="hidden"
                />

                {/* Drop zone — clean minimal card with animated border */}
                <div className="relative" style={{ borderRadius: '16px' }}>

                  {/* Animated SVG border */}
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ zIndex: 2, width: '100%', height: '100%', overflow: 'visible' }}
                    width="100%" height="100%"
                  >
                    <defs>
                      <filter id="uploadLineGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                      <linearGradient id="uploadLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(99,102,241,0)" />
                        <stop offset="40%" stopColor="#818cf8" />
                        <stop offset="60%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="rgba(139,92,246,0)" />
                      </linearGradient>
                    </defs>
                    {/* Static border */}
                    <rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)"
                      rx="15.5" ry="15.5" fill="none"
                      stroke={dragging ? 'rgba(99,102,241,0.45)' : 'rgba(99,102,241,0.18)'}
                      strokeWidth={dragging ? '1.5' : '1'}
                      style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                    />
                    {/* Moving line segment */}
                    <rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)"
                      rx="15.5" ry="15.5" fill="none"
                      stroke="url(#uploadLineGrad)"
                      strokeWidth={dragging ? '2.5' : '1.5'}
                      strokeLinecap="round"
                      filter="url(#uploadLineGlow)"
                      pathLength="100"
                      style={{
                        strokeDasharray: '18 82',
                        animation: 'uploadBorderLine 6s linear infinite',
                        transition: 'stroke-width 0.3s',
                      }}
                    />
                  </svg>

                  {/* Card surface */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    className="relative select-none"
                    style={{
                      borderRadius: '16px',
                      background: dragging ? 'rgba(22,18,40,0.97)' : 'rgba(14,12,26,0.9)',
                      cursor: 'pointer',
                      transform: dragging ? 'scale(1.01)' : 'scale(1)',
                      transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
                      boxShadow: dragging
                        ? '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.3)'
                        : '0 4px 24px rgba(0,0,0,0.3)',
                      zIndex: 1,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = '0 10px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.22)'
                      el.style.background = 'rgba(18,15,34,0.95)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.transform = 'translateY(0)'
                      el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)'
                      el.style.background = 'rgba(14,12,26,0.9)'
                    }}
                  >
                    <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
                      {/* Icon */}
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center mb-5"
                        style={{
                          background: dragging ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                          border: `1px solid ${dragging ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.16)'}`,
                          transition: 'background 0.2s, border-color 0.2s',
                        }}
                      >
                        <Upload className="h-6 w-6 text-primary" />
                      </div>

                      {/* Text */}
                      <p className="text-[15px] font-semibold text-white mb-1.5">
                        {dragging ? 'Release to upload' : 'Drop your document here or click to browse files'}
                      </p>
                      <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        PDF, DOCX, PNG, JPG — up to 10 MB
                      </p>

                      {/* Format tags */}
                      <div className="flex items-center gap-2 mt-5">
                        {['PDF', 'DOCX', 'PNG', 'JPG'].map(fmt => (
                          <span key={fmt} className="text-[10px] font-semibold px-2.5 py-1 rounded-md"
                            style={{
                              color: 'rgba(255,255,255,0.35)',
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              letterSpacing: '0.05em',
                            }}>
                            {fmt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-sm text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Your document is processed securely and never stored permanently.
                </p>
              </motion.div>
            </motion.div>

            {/* Right: document transform visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <DocumentTransformVisual />
            </motion.div>
          </div>{/* close grid */}
          </motion.div>{/* close glass container */}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 relative" style={{ zIndex: 1 }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">Powerful Features</h2>
            <p className="mt-4 text-lg text-muted-foreground">Everything you need to extract intelligence from documents</p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: Sparkles, title: 'AI Summarization', description: 'Get concise summaries of lengthy documents instantly' },
              { icon: Zap, title: 'Entity Extraction', description: 'Automatically identify names, dates, amounts, and more' },
              { icon: Shield, title: 'Sentiment Analysis', description: 'Understand the tone and sentiment of your documents' },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="dz-card dz-card-accent p-8 group"
              >
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.18)',
                    boxShadow: '0 0 16px rgba(99,102,241,0.08) inset',
                  }}>
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <div className="dz-divider mb-3" />
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: '1.6' }}>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-28 relative overflow-hidden" style={{ zIndex: 1 }}>

        {/* No per-section background — global layer handles it */}

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase mb-5"
              style={{ color: 'rgba(139,92,246,0.9)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              Workflow
            </span>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">How It Works</h2>
            <p className="mt-4 text-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Three steps from document to intelligence
            </p>
          </motion.div>

          {/* Cards + pipeline */}
          <div className="relative flex flex-col lg:flex-row items-stretch gap-0">

            {/* Pipeline connector removed from absolute — now inline between cards */}

            {/* ── Step 1: Upload ── */}
            <WorkflowCard
              index={0}
              step="01"
              title="Upload"
              description="Drop your PDF, DOCX, or image directly on the page. Any format, any size up to 10 MB."
              blobColor="rgba(99,102,241,0.35)"
              blobColor2="rgba(139,92,246,0.2)"
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V3M12 3L8 7M12 3L16 7" stroke="rgba(139,92,246,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 15V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V15" stroke="rgba(99,102,241,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
              visual={<UploadVisual />}
            />

            {/* Connector 1→2 */}
            <div className="hidden lg:flex items-center w-16 shrink-0" style={{ zIndex: 1 }}>
              <div className="relative w-full h-[2px] overflow-hidden" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <motion.div
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(99,102,241,0.9), transparent)', width: '60%' }}
                  animate={{ left: ['-60%', '160%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                />
              </div>
            </div>

            {/* ── Step 2: Process ── */}
            <WorkflowCard
              index={1}
              step="02"
              title="Process"
              description="AI extracts text via OCR, identifies entities, classifies document type, and analyzes sentiment."
              blobColor="rgba(139,92,246,0.4)"
              blobColor2="rgba(99,102,241,0.25)"
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="rgba(139,92,246,0.9)" strokeWidth="1.8"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="rgba(99,102,241,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
              visual={<ProcessVisual />}
            />

            {/* Connector 2→3 */}
            <div className="hidden lg:flex items-center w-16 shrink-0" style={{ zIndex: 1 }}>
              <div className="relative w-full h-[2px] overflow-hidden" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <motion.div
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(99,102,241,0.9), transparent)', width: '60%' }}
                  animate={{ left: ['-60%', '160%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1, delay: 0.5 }}
                />
              </div>
            </div>

            {/* ── Step 3: Insights ── */}
            <WorkflowCard
              index={2}
              step="03"
              title="Insights"
              description="Get structured summaries, extracted entities, sentiment scores, and confidence metrics instantly."
              blobColor="rgba(99,102,241,0.3)"
              blobColor2="rgba(167,139,250,0.2)"
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9 11l3 3L22 4" stroke="rgba(139,92,246,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="rgba(99,102,241,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
              visual={<InsightsVisual />}
            />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-28 overflow-hidden" style={{ zIndex: 1 }}>

        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            {/* Glass panel — flat dark, not purple */}
            <div className="relative rounded-2xl text-center"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 60px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(10px)',
              }}>

              {/* Top highlight line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px rounded-full"
                style={{ width: '60%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

              <div className="px-8 py-16 sm:px-14">

                {/* Pipeline indicator — thin, sharp, minimal */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center justify-center gap-3 mb-10"
                >
                  {['Upload', 'Process', 'Insights'].map((label, i) => (
                    <React.Fragment key={label}>
                      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase"
                        style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</span>
                      {i < 2 && (
                        <div className="relative w-6 h-px overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <motion.div className="absolute inset-y-0 w-3"
                            style={{ background: 'rgba(139,92,246,0.6)' }}
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: 'linear' }}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </motion.div>

                {/* Heading — white + accent only on "Analyze" */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight tracking-tight"
                >
                  Ready to{' '}
                  <span style={{
                    background: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    Analyze?
                  </span>
                </motion.h2>

                {/* Subtext — plain muted gray */}
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.28 }}
                  className="max-w-md mx-auto mb-10 text-[16px] leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.38)' }}
                >
                  Upload any document and get AI-powered summaries, entities, and sentiment in seconds.
                </motion.p>

                {/* CTA — the only accent element */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.36 }}
                  className="flex flex-col items-center gap-4"
                >
                  <CTAButton onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    PDF, DOCX, Images &nbsp;·&nbsp; Max 10 MB &nbsp;·&nbsp; No account required
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

      </section>

      <Footer />
    </div>
  )
}
