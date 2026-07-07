import clsx from 'clsx'
import Spinner from './Spinner'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const variantMap = {
  primary: 'bg-accent text-bg hover:bg-accent/90 font-semibold',
  secondary: 'bg-accent2 text-white hover:bg-accent2/90 font-semibold',
  danger: 'bg-alert text-white hover:bg-alert/90 font-semibold',
  ghost: 'bg-transparent text-text hover:bg-bg3 border border-border',
}

const sizeMap = {
  sm: 'px-3 py-1.5 text-xs rounded',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-3 text-base rounded-md',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 disabled:cursor-not-allowed',
        variantMap[variant],
        sizeMap[size],
        className,
      )}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
