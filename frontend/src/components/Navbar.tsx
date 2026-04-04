import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Logo } from './Logo'
import { PremiumButton } from './PremiumButton'

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleAnalyze = () => {
    setMobileOpen(false)
    if (location.pathname === '/') {
      const el = document.getElementById('upload-section')
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 80
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }
    } else {
      navigate('/', { state: { scrollToUpload: true } })
    }
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(10, 10, 20, 0.85)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Left: Logo */}
          <Logo size="md" linkTo="/" />

          {/* Desktop: Links + CTA */}
          <div className="hidden sm:flex items-center gap-5">
            <Link
              to="/api-docs"
              className="text-sm font-medium transition-all duration-200 relative group"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <span className="group-hover:text-white transition-colors duration-200">API Docs</span>
              <span
                className="absolute -bottom-0.5 left-0 w-0 group-hover:w-full transition-all duration-200 rounded-full"
                style={{ height: '1px', background: 'rgba(99,102,241,0.7)' }}
              />
            </Link>
            <PremiumButton onClick={handleAnalyze} size="sm">Analyze</PremiumButton>
          </div>

          {/* Mobile: hamburger */}
          <button
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.04)' }}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="sm:hidden px-4 pb-4 pt-2 space-y-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,20,0.97)' }}
        >
          <Link
            to="/api-docs"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            API Docs
          </Link>
          <button
            onClick={handleAnalyze}
            className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-semibold transition-colors"
            style={{ color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            Analyze Document
          </button>
        </div>
      )}
    </nav>
  )
}
