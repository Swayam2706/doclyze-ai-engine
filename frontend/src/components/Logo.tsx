import { Link } from 'react-router-dom'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  linkTo?: string
}

const sizeMap = {
  sm: { icon: 22, text: 'text-base' },
  md: { icon: 26, text: 'text-xl' },
  lg: { icon: 32, text: 'text-2xl' },
}

export function Logo({ size = 'md', linkTo = '/' }: LogoProps) {
  const { icon, text } = sizeMap[size]

  const content = (
    <div className="flex items-center gap-2" style={{ lineHeight: 1 }}>
      {/* Use the clean vector icon.svg */}
      <img
        src="/icon.svg"
        alt=""
        width={icon}
        height={icon}
        style={{ display: 'block', flexShrink: 0 }}
        draggable={false}
      />
      <span className={`${text} font-bold text-foreground tracking-tight`}>
        Doclyze
      </span>
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className="flex items-center hover:opacity-80 transition-opacity">
        {content}
      </Link>
    )
  }

  return content
}
