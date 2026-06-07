import type { DeadlineStatus, Severity } from '../lib/fleet'

const styles: Record<Severity, string> = {
  ok: 'bg-green-100 text-green-800 border-green-200',
  warn: 'bg-amber-100 text-amber-800 border-amber-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  unknown: 'bg-slate-100 text-slate-500 border-slate-200',
}

const dot: Record<Severity, string> = {
  ok: 'bg-green-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
  unknown: 'bg-slate-400',
}

export function StatusBadge({ status }: { status: DeadlineStatus }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles[status.severity]}`}>
      <div className="flex items-center gap-2 font-medium">
        <span className={`inline-block h-2 w-2 rounded-full ${dot[status.severity]}`} />
        {status.label}
      </div>
      <div className="mt-0.5 text-xs opacity-90">{status.detail}</div>
    </div>
  )
}
