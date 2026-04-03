import { Link } from 'react-router-dom'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  linkTo?: string
}

const sizeMap = {
  sm: { iconSize: 22, fontSize: 14, gap: 7 },
  md: { iconSize: 26, fontSize: 16, gap: 8 },
  lg: { iconSize: 32, fontSize: 20, gap: 10 },
}

function DoclyzeIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Document base */}
      <rect x="4" y="2" width="16" height="21" rx="2" fill="#161616" stroke="#6366F1" strokeWidth="1.2" />

      {/* Folded corner — top right */}
      <path d="M15 2 L20 7 H15 V2Z" fill="#0A0A0A" stroke="#6366F1" strokeWidth="1.2" strokeLinejoin="round" />

      {/* Content lines */}
      <rect x="7" y="11" width="8"  height="1.4" rx="0.7" fill="#6366F1" opacity="0.9" />
      <rect x="7" y="14" width="6"  height="1.4" rx="0.7" fill="#A1A1AA" opacity="0.6" />
      <rect x="7" y="17" width="7"  height="1.4" rx="0.7" fill="#A1A1AA" opacity="0.6" />

      {/* AI badge — bottom right */}
      <rect x="17" y="18" width="11" height="11" rx="3" fill="#6366F1" />
      {/* Lightning bolt */}
      <path
        d="M24 19.5 L21.2 23.2 H23.1 L22.4 27 L25.2 23 H23.3 Z"
        fill="#FAFAFA"
      />
    </svg>
  )
}

export function Logo({ size = 'md', linkTo = '/' }: LogoProps) {
  const { iconSize, fontSize, gap } = sizeMap[size]

  const content = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      <DoclyzeIcon size={iconSize} />
      <span
        style={{
          fontSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#FAFAFA',
          lineHeight: 1,
        }}
      >
        Doclyze
      </span>
    </div>
  )

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        className="hover:opacity-80 transition-opacity duration-150"
      >
        {content}
      </Link>
    )
  }

  return content
}
