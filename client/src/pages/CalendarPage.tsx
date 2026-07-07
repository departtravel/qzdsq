import { useState, useMemo } from 'react'
import { useReservations } from '../api/hooks'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

interface Reservation {
  id: string
  client_name: string
  excursion_name: string
  excursion_date: string
  status: string
  pax: number
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const { data: reservations = [], isLoading } = useReservations({ month: monthStr })

  // Group reservations by date
  const byDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {}
    for (const r of reservations as Reservation[]) {
      const d = r.excursion_date?.slice(0, 10)
      if (d) {
        if (!map[d]) map[d] = []
        map[d].push(r)
      }
    }
    return map
  }, [reservations])

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const selectedKey = selectedDay
  const selectedReservations = selectedKey ? (byDate[selectedKey] ?? []) : []

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text">Calendrier</h1>
        <p className="text-text/40 text-sm mt-0.5">Vue mensuelle des excursions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-bg2 border border-border rounded-xl p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg3 text-text/60 hover:text-text transition-colors"
            >
              ‹
            </button>
            <h2 className="font-semibold text-text">
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg3 text-text/60 hover:text-text transition-colors"
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-text/30 uppercase tracking-wide py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} />
                }
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const resos = byDate[dateKey] ?? []
                const isToday =
                  today.getFullYear() === year &&
                  today.getMonth() === month &&
                  today.getDate() === day
                const isSelected = selectedDay === dateKey

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                    className={`
                      min-h-[60px] rounded-lg p-1.5 cursor-pointer transition-colors border
                      ${isSelected
                        ? 'bg-accent/15 border-accent/40'
                        : isToday
                        ? 'bg-bg3 border-accent/20'
                        : 'border-transparent hover:bg-bg3/70 hover:border-border'}
                    `}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isToday ? 'text-accent' : 'text-text/70'
                      }`}
                    >
                      {day}
                    </div>
                    {resos.length > 0 && (
                      <div
                        className={`
                          text-xs rounded px-1 py-0.5 text-center font-medium
                          ${resos.length > 3
                            ? 'bg-alert/20 text-alert'
                            : 'bg-accent2/20 text-accent2'}
                        `}
                      >
                        {resos.length}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Day detail */}
        <div className="bg-bg2 border border-border rounded-xl p-5">
          {selectedDay ? (
            <>
              <h3 className="font-semibold text-text mb-1">
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
              <p className="text-text/40 text-xs mb-4">
                {selectedReservations.length} réservation
                {selectedReservations.length !== 1 ? 's' : ''}
              </p>

              {selectedReservations.length === 0 ? (
                <p className="text-text/30 text-sm">Aucune réservation ce jour.</p>
              ) : (
                <div className="space-y-3">
                  {selectedReservations.map((r) => (
                    <div key={r.id} className="bg-bg3 rounded-lg p-3">
                      <div className="font-medium text-sm text-text">{r.client_name}</div>
                      <div className="text-xs text-text/50 mt-0.5">{r.excursion_name}</div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge
                          variant={
                            (r.status as 'confirmed' | 'cancelled' | 'modified' | 'pending') ??
                            'pending'
                          }
                        />
                        <span className="text-xs text-text/40">x{r.pax} pax</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <span className="text-3xl mb-3">📆</span>
              <p className="text-text/30 text-sm">
                Cliquez sur un jour pour voir les réservations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
