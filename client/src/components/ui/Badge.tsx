import clsx from 'clsx'

type BadgeVariant =
  | 'confirmed'
  | 'cancelled'
  | 'modified'
  | 'pending'
  | 'todo'
  | 'in_progress'
  | 'done'
  | 'normal'
  | 'high'
  | 'urgent'

interface BadgeProps {
  variant: BadgeVariant
  label?: string
  className?: string
}

const variantMap: Record<BadgeVariant, string> = {
  confirmed: 'bg-success/20 text-success border border-success/30',
  cancelled: 'bg-alert/20 text-alert border border-alert/30',
  modified: 'bg-warning/20 text-warning border border-warning/30',
  pending: 'bg-border/40 text-text/60 border border-border',
  todo: 'bg-border/40 text-text/60 border border-border',
  in_progress: 'bg-accent2/20 text-accent2 border border-accent2/30',
  done: 'bg-success/20 text-success border border-success/30',
  normal: 'bg-border/40 text-text/60 border border-border',
  high: 'bg-warning/20 text-warning border border-warning/30',
  urgent: 'bg-alert/20 text-alert border border-alert/30',
}

const labelMap: Record<BadgeVariant, string> = {
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  modified: 'Modifié',
  pending: 'En attente',
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  normal: 'Normal',
  high: 'Haute',
  urgent: 'Urgent',
}

export default function Badge({ variant, label, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variantMap[variant],
        className,
      )}
    >
      {label ?? labelMap[variant]}
    </span>
  )
}
