import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ── Auth ──────────────────────────────────────────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/auth/me').then((r) => r.data),
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiClient.post('/auth/login', data).then((r) => r.data),
  })
}

// ── Reservations ──────────────────────────────────────────────────────────────
export function useReservations(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => apiClient.get('/reservations', { params: filters }).then((r) => r.data),
  })
}

export function useReservation(id: string | null) {
  return useQuery({
    queryKey: ['reservations', id],
    queryFn: () => apiClient.get(`/reservations/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/reservations', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useUpdateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiClient.put(`/reservations/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useDeleteReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/reservations/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useAdvanceWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiClient.put(`/reservations/${id}/workflow`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      qc.invalidateQueries({ queryKey: ['workflow-board'] })
    },
  })
}

// ── Excursions ────────────────────────────────────────────────────────────────
export function useExcursions() {
  return useQuery({
    queryKey: ['excursions'],
    queryFn: () => apiClient.get('/excursions').then((r) => r.data),
  })
}

export function useExcursion(id: string | null) {
  return useQuery({
    queryKey: ['excursions', id],
    queryFn: () => apiClient.get(`/excursions/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateExcursion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/excursions', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['excursions'] }),
  })
}

export function useUpdateExcursion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiClient.put(`/excursions/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['excursions'] }),
  })
}

export function useCostBreakdown(id: string | null, pax: number) {
  return useQuery({
    queryKey: ['cost-breakdown', id, pax],
    queryFn: () =>
      apiClient.get(`/excursions/${id}/cost-breakdown`, { params: { pax } }).then((r) => r.data),
    enabled: !!id && pax > 0,
  })
}

// ── Partners ──────────────────────────────────────────────────────────────────
export function usePartners() {
  return useQuery({
    queryKey: ['partners'],
    queryFn: () => apiClient.get('/partners').then((r) => r.data),
  })
}

export function usePartner(id: string | null) {
  return useQuery({
    queryKey: ['partners', id],
    queryFn: () => apiClient.get(`/partners/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreatePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/partners', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

export function useUpdatePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiClient.put(`/partners/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

export function usePartnerMonthlySheet(id: string | null, month: string) {
  return useQuery({
    queryKey: ['partner-sheet', id, month],
    queryFn: () =>
      apiClient.get(`/partners/${id}/monthly-sheet/${month}`).then((r) => r.data),
    enabled: !!id && !!month,
  })
}

// ── OTAs ──────────────────────────────────────────────────────────────────────
export function useOtas() {
  return useQuery({
    queryKey: ['otas'],
    queryFn: () => apiClient.get('/otas').then((r) => r.data),
  })
}

export function useOtaMonthlySheet(id: string | null, month: string) {
  return useQuery({
    queryKey: ['ota-sheet', id, month],
    queryFn: () =>
      apiClient.get(`/otas/${id}/monthly-sheet/${month}`).then((r) => r.data),
    enabled: !!id && !!month,
  })
}

// ── Workflow ──────────────────────────────────────────────────────────────────
export function useWorkflowBoard() {
  return useQuery({
    queryKey: ['workflow-board'],
    queryFn: () => apiClient.get('/workflow/board').then((r) => r.data),
  })
}

export function useAssignReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiClient.put(`/workflow/${id}/assign`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-board'] }),
  })
}

export function useBookSuppliers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiClient.put(`/workflow/${id}/book`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-board'] }),
  })
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export function useTasks(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => apiClient.get('/tasks', { params: filters }).then((r) => r.data),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/tasks', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiClient.put(`/tasks/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/tasks/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.get('/dashboard/stats').then((r) => r.data),
  })
}

export function useMonthlyRevenue() {
  return useQuery({
    queryKey: ['monthly-revenue'],
    queryFn: () => apiClient.get('/dashboard/monthly-revenue').then((r) => r.data),
  })
}

export function useOtaBreakdown() {
  return useQuery({
    queryKey: ['ota-breakdown'],
    queryFn: () => apiClient.get('/dashboard/ota-breakdown').then((r) => r.data),
  })
}

// ── CRM ───────────────────────────────────────────────────────────────────────
export function useCrmClients() {
  return useQuery({
    queryKey: ['crm'],
    queryFn: () => apiClient.get('/crm').then((r) => r.data),
  })
}

export function useCrmClient(id: string | null) {
  return useQuery({
    queryKey: ['crm', id],
    queryFn: () => apiClient.get(`/crm/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useClientHistory(id: string | null) {
  return useQuery({
    queryKey: ['crm-history', id],
    queryFn: () => apiClient.get(`/crm/${id}/history`).then((r) => r.data),
    enabled: !!id,
  })
}

// ── Agents ────────────────────────────────────────────────────────────────────
export function useAgentLogs() {
  return useQuery({
    queryKey: ['agent-logs'],
    queryFn: () => apiClient.get('/agents/logs').then((r) => r.data),
  })
}

export function useParseEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email_text: string }) =>
      apiClient.post('/agents/voyage/parse', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-logs'] }),
  })
}

export function useCheckAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/agents/erp/alerts').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-logs'] }),
  })
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.get('/settings').then((r) => r.data),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.put('/settings', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => apiClient.get('/settings/exchange-rates').then((r) => r.data),
  })
}
