import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleAnalyze = () => {
    if (location.pathname === '/') {
      // Scroll to upload section on landing page
      const el = document.getElementById('upload-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      navigate('/')
    }
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(10, 10, 20, 0.75)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Left: Logo */}
          <Logo size="md" linkTo="/" />

          {/* Right: Links + CTA */}
          <div className="flex items-center gap-6">
            <Link
              to="/api-docs"
              className="text-sm font-medium transition-all duration-200 relative group"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <span className="group-hover:text-white transition-colors duration-200">
                API Docs
              </span>
              {/* Underline animation */}
              <span
                className="absolute -bottom-0.5 left-0 w-0 group-hover:w-full transition-all duration-200 rounded-full"
                style={{ height: '1px', background: 'rgba(99,102,241,0.7)' }}
              />
            </Link>

            <button
              onClick={handleAnalyze}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                color: '#fff',
                boxShadow: '0 0 0 0 rgba(99,102,241,0)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.35)'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 0 rgba(99,102,241,0)'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              }}
            >
              Analyze
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
