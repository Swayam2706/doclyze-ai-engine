import { useRef, useState } from 'react'

interface PremiumButtonProps {
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  size?: 'sm' | 'md'
}

export function PremiumButton({
  onClick,
  children,
  className = '',
  disabled = false,
  type = 'button',
  size = 'md',
}: PremiumButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const pad = size === 'sm' ? 'px-3.5 py-2 text-[13px]' : 'px-5 py-2.5 text-[13px]'

  return (
    <button
      ref={btnRef}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={`relative inline-flex items-center gap-1.5 font-semibold rounded-lg overflow-hidden select-none ${pad} ${className}`}
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)'
          : 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
        color: '#fff',
        border: '1px solid rgba(129,140,248,0.4)',
        boxShadow: hovered
          ? '0 0 0 1px rgba(99,102,241,0.5), 0 4px 20px rgba(99,102,241,0.45), 0 1px 0 rgba(255,255,255,0.1) inset'
          : '0 0 0 1px rgba(99,102,241,0.2), 0 2px 8px rgba(99,102,241,0.2)',
        transform: pressed ? 'scale(0.97)' : hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {/* Shimmer sweep on hover */}
      {hovered && !disabled && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
            animation: 'premiumShimmer 0.55s ease-out forwards',
          }}
        />
      )}
      {/* Top highlight line */}
      <span
        className="absolute top-0 left-[15%] right-[15%] h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
          opacity: hovered ? 1 : 0.5,
          transition: 'opacity 0.2s',
        }}
      />
      {/* Content */}
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  )
}
