import { SITUATION_LABEL, type Situation } from '../lib/types'

const styles: Record<Situation, string> = {
  identifie: 'bg-green-100 text-green-800 border-green-200',
  non_identifie: 'bg-red-100 text-red-800 border-red-200',
  en_investigation: 'bg-amber-100 text-amber-800 border-amber-200',
  rapatrie: 'bg-blue-100 text-blue-800 border-blue-200',
}

const dot: Record<Situation, string> = {
  identifie: 'bg-green-500',
  non_identifie: 'bg-red-500',
  en_investigation: 'bg-amber-500',
  rapatrie: 'bg-blue-500',
}

export function StatusBadge({ situation }: { situation: Situation }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[situation]}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot[situation]}`} />
      {SITUATION_LABEL[situation]}
    </span>
  )
}
