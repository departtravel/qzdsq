import { useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  useDashboardStats,
  useMonthlyRevenue,
  useOtaBreakdown,
  useCheckAlerts,
  useReservations,
} from '../api/hooks'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  icon: string
}) {
  return (
    <div className="bg-bg2 border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-text/40 text-xs uppercase tracking-wide font-medium">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-text tabular-nums">{value}</div>
      {sub && <div className="text-xs text-text/40 mt-1">{sub}</div>}
    </div>
  )
}

const PIE_COLORS = ['#C9A96E', '#3D7EBF', '#27AE7A', '#E8A020', '#E8503A', '#6E8CAE']

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: monthlyRevenue, isLoading: revenueLoading } = useMonthlyRevenue()
  const { data: otaBreakdown } = useOtaBreakdown()
  const { data: reservations } = useReservations()
  const checkAlerts = useCheckAlerts()

  // Auto-refresh alerts every 5 minutes
  useEffect(() => {
    checkAlerts.mutate()
    const interval = setInterval(() => checkAlerts.mutate(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  const recentReservations = Array.isArray(reservations) ? reservations.slice(0, 5) : []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Tableau de Bord</h1>
        <p className="text-text/40 text-sm mt-0.5">Vue d'ensemble de l'activité</p>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Réservations totales"
            value={stats?.total_reservations ?? 0}
            sub="Ce mois"
            icon="📋"
          />
          <StatCard
            label="Chiffre d'affaires"
            value={`${(stats?.revenue_tnd ?? 0).toLocaleString('fr-TN')} TND`}
            sub="Mois en cours"
            icon="💰"
          />
          <StatCard
            label="Workflow en attente"
            value={stats?.pending_workflow ?? 0}
            sub="Nécessitent action"
            icon="⏳"
          />
          <StatCard
            label="OTAs actives"
            value={stats?.active_otas ?? 0}
            sub="Plateformes connectées"
            icon="🌐"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly revenue chart */}
        <div className="lg:col-span-2 bg-bg2 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-4">
            Revenus mensuels (TND)
          </h2>
          {revenueLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyRevenue ?? []} barSize={18}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#F5F0E8', opacity: 0.4, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#F5F0E8', opacity: 0.4, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1C2E42',
                    border: '1px solid #263D56',
                    borderRadius: 8,
                    color: '#F5F0E8',
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'rgba(201,169,110,0.08)' }}
                />
                <Bar dataKey="revenue" fill="#C9A96E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* OTA breakdown */}
        <div className="bg-bg2 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-4">
            Répartition OTA
          </h2>
          {otaBreakdown ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={otaBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={70}
                  innerRadius={35}
                >
                  {otaBreakdown.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1C2E42',
                    border: '1px solid #263D56',
                    borderRadius: 8,
                    color: '#F5F0E8',
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: '#F5F0E8', opacity: 0.6 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-bg2 border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide">
              Alertes ERP
            </h2>
            {checkAlerts.isPending && <Spinner size="sm" />}
          </div>
          {checkAlerts.data?.alerts?.length > 0 ? (
            <ul className="space-y-2">
              {checkAlerts.data.alerts.map((alert: { type: string; message: string }, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={alert.type === 'urgent' ? 'text-alert' : 'text-warning'}>
                    {alert.type === 'urgent' ? '🔴' : '🟡'}
                  </span>
                  <span className="text-text/70">{alert.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text/30 text-sm">Aucune alerte active.</p>
          )}
        </div>

        {/* Recent reservations */}
        <div className="bg-bg2 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-4">
            Réservations récentes
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text/40 text-xs uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Client</th>
                  <th className="text-left pb-2 font-medium">Excursion</th>
                  <th className="text-left pb-2 font-medium">Statut</th>
                  <th className="text-right pb-2 font-medium">Prix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentReservations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-text/30">
                      Aucune réservation
                    </td>
                  </tr>
                ) : (
                  recentReservations.map((r: Record<string, unknown>, i: number) => (
                    <tr key={i}>
                      <td className="py-2 text-text truncate max-w-[100px]">
                        {r.client_name as string}
                      </td>
                      <td className="py-2 text-text/60 truncate max-w-[100px]">
                        {r.excursion_name as string}
                      </td>
                      <td className="py-2">
                        <Badge variant={(r.status as 'confirmed' | 'cancelled' | 'modified' | 'pending') ?? 'pending'} />
                      </td>
                      <td className="py-2 text-right tabular-nums text-accent">
                        {r.sale_price_tnd as string}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
