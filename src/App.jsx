import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import useSettingsStore from './store/settingsStore'
import Login from './pages/Login'
import SuperDashboard from './pages/super/SuperDashboard'
import CenterDashboard from './pages/center/CenterDashboard'
import DispatcherDashboard from './pages/dispatcher/DispatcherDashboard'
import HospitalDashboard from './pages/hospital/HospitalDashboard'

function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" />
  if (allowedRoles && !allowedRoles.includes(user?.role))
    return <Navigate to="/login" />
  return children
}

function ThemeWrapper({ children }) {
  const { theme } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light')
    } else {
      // system
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }
  }, [theme])

  return children
}

function App() {
  return (
    <BrowserRouter>
      <ThemeWrapper>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/super/dashboard" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <SuperDashboard />
            </ProtectedRoute>
          } />
          <Route path="/center/dashboard" element={
            <ProtectedRoute allowedRoles={['CENTER_ADMIN']}>
              <CenterDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dispatcher/desk" element={
            <ProtectedRoute allowedRoles={['DISPATCHER']}>
              <DispatcherDashboard />
            </ProtectedRoute>
          } />
          <Route path="/hospital/dashboard" element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN']}>
              <HospitalDashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </ThemeWrapper>
    </BrowserRouter>
  )
}

export default App