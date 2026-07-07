import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PlanningPage from './pages/PlanningPage'
import WorkflowPage from './pages/WorkflowPage'
import EmailsPage from './pages/EmailsPage'
import ExcursionsPage from './pages/ExcursionsPage'
import PartnersPage from './pages/PartnersPage'
import OtasPage from './pages/OtasPage'
import CalendarPage from './pages/CalendarPage'
import CrmPage from './pages/CrmPage'
import AgentsPage from './pages/AgentsPage'
import SettingsPage from './pages/SettingsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/planning" element={<PrivateRoute><PlanningPage /></PrivateRoute>} />
      <Route path="/workflow" element={<PrivateRoute><WorkflowPage /></PrivateRoute>} />
      <Route path="/emails" element={<PrivateRoute><EmailsPage /></PrivateRoute>} />
      <Route path="/excursions" element={<PrivateRoute><ExcursionsPage /></PrivateRoute>} />
      <Route path="/partners" element={<PrivateRoute><PartnersPage /></PrivateRoute>} />
      <Route path="/otas" element={<PrivateRoute><OtasPage /></PrivateRoute>} />
      <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
      <Route path="/crm" element={<PrivateRoute><CrmPage /></PrivateRoute>} />
      <Route path="/agents" element={<PrivateRoute><AgentsPage /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
    </Routes>
  )
}
