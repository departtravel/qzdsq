import clsx from 'clsx'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-text/60 uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full bg-bg3 border rounded-md px-3 py-2 text-sm text-text placeholder-text/30',
            'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60',
            'transition-colors duration-150',
            error ? 'border-alert' : 'border-border',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-alert">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
export default Input
