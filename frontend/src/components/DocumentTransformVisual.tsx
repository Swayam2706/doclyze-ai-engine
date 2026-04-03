import { useEffect, useState, useRef } from "react"

// Animation phases:
// 0 → scanning document (0–2.2s)
// 1 → data flow + JSON typewriter (2.2–5.0s)
// 2 → extraction complete pause (5.0–6.0s)
// 3 → summary generation (6.0–11.0s)
// 4 → insight/result state (11.0–13.5s)
// reset → loop (13.5s → 0)
// Total cycle: ~14s

type Phase = 'scanning' | 'extracting' | 'complete' | 'summarizing' | 'insight'

const SUMMARY_LINES = [
  'Nexus Dynamics issued invoice INV-2024-0847',
  'to Acme Corp for consulting and development',
  'services totaling $5,750.00 due Q4 2024.',
]

const jsonOutput = [
  '{',
  '  "document_type": "invoice",',
  '  "entities": {',
  '    "vendor": "Nexus Dynamics",',
  '    "client": "Acme Corp",',
  '    "invoice_no": "INV-2024-0847"',
  '  },',
  '  "line_items": [',
  '    { "desc": "Consulting", "qty": 40, "rate": 125 },',
  '    { "desc": "Development", "qty": 8, "rate": 95 }',
  '  ],',
  '  "amount": "$5,750.00",',
  '  "confidence": 0.98',
  '}'
]

export function DocumentTransformVisual() {
  const [scanProgress, setScanProgress] = useState(0)
  const [phase, setPhase] = useState<Phase>('scanning')
  const [showDataFlow, setShowDataFlow] = useState(false)
  const [jsonLines, setJsonLines] = useState(0)
  const [highlightedSections, setHighlightedSections] = useState<string[]>([])
  const [summaryLines, setSummaryLines] = useState(0)
  const [summaryChars, setSummaryChars] = useState(0)
  const outerRef = useRef<HTMLDivElement>(null)
  const [cardSize, setCardSize] = useState({ w: 640, h: 380 })

  const getJsonSyntax = (line: string) => {
    return line
      .replace(/"([^"]+)":/g, '<span class="text-primary">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span class="text-muted-foreground">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="text-success">$1</span>')
      .replace(/[{}[\]]/g, (m) => `<span class="text-muted-foreground/60">${m}</span>`)
  }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const intervals: ReturnType<typeof setInterval>[] = []

    const startAnimation = () => {
      // ── Reset ──────────────────────────────────────────────
      setScanProgress(0)
      setPhase('scanning')
      setShowDataFlow(false)
      setJsonLines(0)
      setHighlightedSections([])
      setSummaryLines(0)
      setSummaryChars(0)

      // ── Phase 0: Scanning (0–2.2s) ─────────────────────────
      const scanInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) { clearInterval(scanInterval); return 100 }
          if (prev > 15) setHighlightedSections(h => h.includes('vendor') ? h : [...h, 'vendor'])
          if (prev > 40) setHighlightedSections(h => h.includes('items') ? h : [...h, 'items'])
          if (prev > 75) setHighlightedSections(h => h.includes('total') ? h : [...h, 'total'])
          return prev + 2
        })
      }, 40)
      intervals.push(scanInterval)

      // ── Phase 1: Data flow + JSON typewriter (2.2–5.0s) ────
      timers.push(setTimeout(() => {
        setPhase('extracting')
        setShowDataFlow(true)
      }, 2200))

      timers.push(setTimeout(() => {
        let lineIndex = 0
        const typeInterval = setInterval(() => {
          if (lineIndex >= jsonOutput.length) { clearInterval(typeInterval); return }
          setJsonLines(lineIndex + 1)
          lineIndex++
        }, 150)
        intervals.push(typeInterval)
      }, 2600))

      // ── Phase 2: Extraction complete pause (5.0–6.2s) ──────
      timers.push(setTimeout(() => {
        setPhase('complete')
        setShowDataFlow(false)
      }, 5000))

      // ── Phase 3: Summary generation (6.2–11.5s) ────────────
      timers.push(setTimeout(() => {
        setPhase('summarizing')
        setSummaryLines(0)
        setSummaryChars(0)

        // Reveal summary lines one by one with typewriter per line
        let currentLine = 0
        let currentChar = 0

        const summaryInterval = setInterval(() => {
          if (currentLine >= SUMMARY_LINES.length) {
            clearInterval(summaryInterval)
            return
          }
          const lineLen = SUMMARY_LINES[currentLine].length
          currentChar++
          setSummaryChars(currentChar)

          if (currentChar >= lineLen) {
            currentLine++
            setSummaryLines(currentLine)
            currentChar = 0
            setSummaryChars(0)
          }
        }, 35)
        intervals.push(summaryInterval)
      }, 6200))

      // ── Phase 4: Insight/result state (11.5–13.5s) ─────────
      timers.push(setTimeout(() => {
        setPhase('insight')
        setSummaryLines(SUMMARY_LINES.length)
        setSummaryChars(0)
      }, 11500))
    }

    startAnimation()
    const cycleInterval = setInterval(startAnimation, 14000)
    intervals.push(cycleInterval)

    return () => {
      timers.forEach(clearTimeout)
      intervals.forEach(clearInterval)
    }
  }, [])

  // Track actual card dimensions for the SVG border path
  useEffect(() => {
    if (!outerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setCardSize({ w: e.contentRect.width, h: e.contentRect.height })
      }
    })
    ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [])
  const isScanning = phase === 'scanning'
  const isSummarizing = phase === 'summarizing' || phase === 'insight'
  const isComplete = phase === 'insight'

  // Status bar text
  const statusText = isScanning
    ? 'Scanning document...'
    : phase === 'extracting'
    ? 'Extracting data...'
    : phase === 'complete'
    ? 'Extraction complete'
    : phase === 'summarizing'
    ? 'Generating summary...'
    : 'Analysis complete'

  // Right panel label
  const rightLabel = isSummarizing ? 'summary.txt' : 'output.json'
  const rightDot = isComplete ? 'bg-success' : isSummarizing ? 'bg-primary animate-pulse' : jsonLines >= jsonOutput.length ? 'bg-success' : 'bg-muted-foreground/50'
  const rightLabelText = isComplete
    ? 'Summary ready'
    : isSummarizing
    ? 'Generating summary...'
    : jsonLines >= jsonOutput.length
    ? 'Extraction complete'
    : 'Processing...'

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* ── OUTER: radial gradient border wrapper ── */}
      <div
        ref={outerRef}
        className="relative rounded-[14px] p-[1px] animate-float-slow"
        style={{
          background: 'radial-gradient(circle 280px at 0% 0%, rgba(139,92,246,0.9), rgba(12,13,13,1))',
        }}
      >
        {/* ── SVG BORDER LINE: moving segment traces the card border ── */}
        <svg
          className="absolute pointer-events-none"
          style={{ zIndex: 30, top: 0, left: 0, overflow: 'visible' }}
          width={cardSize.w}
          height={cardSize.h}
        >
          <defs>
            <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Moving line segment — dasharray trick: short visible dash, long invisible gap */}
          <rect
            x="0.5" y="0.5"
            width={cardSize.w - 1}
            height={cardSize.h - 1}
            rx="13" ry="13"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#lineGlow)"
            style={{
              strokeDasharray: `${Math.round((cardSize.w + cardSize.h) * 0.18)} ${Math.round((cardSize.w + cardSize.h) * 2)}`,
              animation: 'borderLine 14s linear infinite',
            }}
          />
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(99,102,241,0)" />
              <stop offset="40%" stopColor="#818cf8" />
              <stop offset="60%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="rgba(139,92,246,0)" />
            </linearGradient>
          </defs>
        </svg>

        {/* ── INNER CARD: radial gradient bg + ray + lines (reference .card) ── */}
        <div
          className="relative rounded-[13px] overflow-hidden"
          style={{
            border: '1px solid #1e2022',
            background: 'radial-gradient(circle 320px at 0% 0%, #1a1535, #0c0d0d)',
          }}
        >
          {/* ── RAY: diagonal light sweep (reference .ray) ── */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 260,
              height: 50,
              borderRadius: 100,
              background: 'rgba(139,92,246,0.25)',
              opacity: 0.35,
              boxShadow: '0 0 50px rgba(139,92,246,0.4)',
              filter: 'blur(10px)',
              transformOrigin: '10%',
              top: 0,
              left: 0,
              transform: 'rotate(40deg)',
              zIndex: 0,
            }}
          />

          {/* ── CONTENT (all existing animation content, z-index above lines) ── */}
          <div className="relative z-10 p-6">
            <div className="relative grid grid-cols-2 gap-6">

          {/* ── LEFT: Document Preview ── */}
          <div className="relative">
            <div className="rounded-xl border border-border bg-[#111111] p-4">
              {/* Header */}
              <div className={`mb-4 transition-all duration-300 ${highlightedSections.includes('vendor') ? 'bg-primary/5 -mx-2 px-2 py-1 rounded' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-primary tracking-wider">INVOICE</span>
                  <span className="text-[10px] text-muted-foreground">INV-2024-0847</span>
                </div>
                <h3 className="text-sm font-bold text-foreground">Nexus Dynamics</h3>
                <p className="text-[10px] text-muted-foreground">123 Innovation Way, Tech City</p>
              </div>

              {/* Bill To */}
              <div className="mb-4 text-[10px]">
                <span className="text-muted-foreground block mb-1">Bill To:</span>
                <span className="text-foreground/80">Acme Corp</span>
              </div>

              {/* Line Items */}
              <div className={`mb-4 transition-all duration-300 ${highlightedSections.includes('items') ? 'bg-primary/5 -mx-2 px-2 py-1 rounded' : ''}`}>
                <div className="border-t border-b border-border py-2 space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Consulting Services (40h)</span>
                    <span className="text-foreground/80">$5,000.00</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Development Support (8h)</span>
                    <span className="text-foreground/80">$760.00</span>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className={`flex justify-between items-center transition-all duration-300 ${highlightedSections.includes('total') ? 'bg-primary/5 -mx-2 px-2 py-1 rounded' : ''}`}>
                <span className="text-xs font-medium text-muted-foreground">Total Due</span>
                <span className="text-lg font-bold text-foreground">$5,750.00</span>
              </div>

              {/* Scanning line */}
              {isScanning && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-primary transition-all duration-75"
                  style={{ top: `${scanProgress}%` }}
                />
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">invoice_q4_2024.pdf</span>
            </div>
          </div>

          {/* ── CENTER: Data Flow ── */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 flex flex-col items-center gap-1 z-10">
            {showDataFlow && (
              <>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary animate-ping"
                    style={{ animationDelay: `${i * 100}ms`, animationDuration: '1s' }} />
                ))}
              </>
            )}
            {/* Summary phase: different flow dots */}
            {phase === 'summarizing' && (
              <>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-success animate-ping"
                    style={{ animationDelay: `${i * 120}ms`, animationDuration: '1.2s' }} />
                ))}
              </>
            )}
          </div>

          {/* ── RIGHT: Output Panel ── */}
          <div className="relative">
            <div className="rounded-xl border border-border bg-[#111111] p-4 font-mono text-[10px] min-h-[200px]">
              {/* Panel header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-destructive/60" />
                  <div className="h-2 w-2 rounded-full bg-yellow-500/60" />
                  <div className="h-2 w-2 rounded-full bg-success/60" />
                </div>
                <span className="text-[9px] text-muted-foreground transition-all duration-500">{rightLabel}</span>
              </div>

              {/* JSON phase */}
              {!isSummarizing && (
                <div className="space-y-0.5 leading-relaxed">
                  {jsonOutput.slice(0, jsonLines).map((line, i) => (
                    <div key={i} className="animate-fade-in-up whitespace-pre" style={{ animationDuration: '0.2s' }}
                      dangerouslySetInnerHTML={{ __html: getJsonSyntax(line) }} />
                  ))}
                  {jsonLines > 0 && jsonLines < jsonOutput.length && (
                    <span className="inline-block w-1.5 h-3 bg-primary animate-cursor ml-0.5" />
                  )}
                </div>
              )}

              {/* Summary phase — same typewriter style, different content */}
              {isSummarizing && (
                <div className="space-y-2 leading-relaxed">
                  {/* Label */}
                  <div className="text-[9px] text-primary/70 mb-2 tracking-wider uppercase">AI Summary</div>

                  {/* Completed lines */}
                  {SUMMARY_LINES.slice(0, summaryLines).map((line, i) => (
                    <div key={i} className="animate-fade-in-up text-muted-foreground whitespace-pre-wrap"
                      style={{ animationDuration: '0.2s' }}>
                      {line}
                    </div>
                  ))}

                  {/* Currently typing line */}
                  {summaryLines < SUMMARY_LINES.length && (
                    <div className="text-muted-foreground">
                      {SUMMARY_LINES[summaryLines].slice(0, summaryChars)}
                      <span className="inline-block w-1.5 h-3 bg-primary animate-cursor ml-0.5" />
                    </div>
                  )}

                  {/* Confidence badge — appears in insight phase */}
                  {isComplete && (
                    <div className="mt-3 pt-2 border-t border-border flex items-center justify-between animate-fade-in-up"
                      style={{ animationDuration: '0.4s' }}>
                      <span className="text-[9px] text-muted-foreground">Sentiment</span>
                      <span className="text-[9px] font-semibold text-success">Neutral · 98%</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Output label */}
            <div className="mt-2 flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-colors duration-500 ${rightDot}`} />
              <span className="text-[10px] text-muted-foreground font-medium transition-all duration-300">
                {rightLabelText}
              </span>
            </div>
          </div>
        </div>

        {/* ── Status Bar ── */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${isComplete ? 'bg-success' : 'bg-primary animate-pulse'}`} />
            <span className="text-[10px] text-muted-foreground transition-all duration-300">{statusText}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Confidence:</span>
            <span className="text-[10px] font-semibold text-success">98%</span>
          </div>
        </div>
          </div>{/* close content div */}
        </div>{/* close inner card */}
      </div>{/* close outer wrapper */}
    </div>
  )
}
