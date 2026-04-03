import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Logo } from './Logo'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'API Docs', to: '/api-docs' },
  { label: 'Analyze', to: '/' },
]

export function Footer() {
  return (
    <footer className="relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #07070f 0%, #0c0a1e 60%, #060610 100%)',
    }}>
      {/* Top border glow */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.35) 30%, rgba(139,92,246,0.5) 50%, rgba(99,102,241,0.35) 70%, transparent 100%)',
      }} />

      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 500, height: 200,
            left: '50%', top: '40%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Main footer content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 mb-10">

          {/* ── LEFT: Brand ── */}
          <div className="flex flex-col gap-4">
            <Logo size="md" linkTo="/" />
            <p className="text-[13px] leading-relaxed max-w-[220px]"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              AI-powered document intelligence platform.
            </p>
          </div>

          {/* ── CENTER: Navigation ── */}
          <div className="flex flex-col gap-3 md:items-center">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-1"
              style={{ color: 'rgba(99,102,241,0.6)' }}>
              Navigation
            </p>
            {NAV_LINKS.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className="relative text-[13px] font-medium w-fit group transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <span className="group-hover:text-white transition-colors duration-200">{label}</span>
                <span
                  className="absolute -bottom-0.5 left-0 w-0 group-hover:w-full transition-all duration-200 rounded-full"
                  style={{ height: '1px', background: 'rgba(99,102,241,0.6)' }}
                />
              </Link>
            ))}
          </div>

          {/* ── RIGHT: Info ── */}
          <div className="flex flex-col gap-3 md:items-end">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-1"
              style={{ color: 'rgba(99,102,241,0.6)' }}>
              Supported Formats
            </p>
            <div className="flex flex-wrap gap-2">
              {['PDF', 'DOCX', 'PNG', 'JPG'].map(fmt => (
                <span key={fmt}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.12)',
                  }}>
                  {fmt}
                </span>
              ))}
            </div>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Max 10 MB per file
            </p>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              © 2026 Doclyze. All rights reserved.
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(99,102,241,0.35)' }}>
              AI Document Intelligence
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
