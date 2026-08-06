import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import axiosClient from '../../api/axiosClient'
import useSettingsStore from '../../store/settingsStore'

if (!document.getElementById('lers-dispatcher-styles')) {
    const s = document.createElement('style')
    s.id = 'lers-dispatcher-styles'
    s.textContent = `
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeInScale { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    .page-refresh { animation: fadeIn 0.3s ease; }
    .new-badge { animation: pulse 2s infinite; }
    [data-theme="dark"] .lers-row:hover { background: #1e293b !important; }
    [data-theme="light"] .lers-row:hover { background: #f8fafc !important; }
    [data-theme="dark"] { --bg:#0f172a; --card:#1e293b; --border:#334155; --text:#f1f5f9; --text2:#94a3b8; }
    [data-theme="light"] { --bg:#f3f5f9; --card:#ffffff; --border:#e4e8ef; --text:#0f172a; --text2:#64748b; }
  `
    document.head.appendChild(s)
}

const STATUS_COLOR = { NEW: '#dc2626', DISPATCHED: '#2563eb', BACKUP: '#7c3aed', ON_THE_WAY: '#ea580c', ON_SCENE: '#d97706', CLOSED: '#16a34a', PARTIALLY_ACCEPTED: '#f59e0b' }
const STATUS_BG = { NEW: '#fee2e2', DISPATCHED: '#dbeafe', BACKUP: '#ede9fe', ON_THE_WAY: '#ffedd5', ON_SCENE: '#fef3c7', CLOSED: '#dcfce7', PARTIALLY_ACCEPTED: '#fef3c7' }
const TYPE_COLOR = { FIRE: '#dc2626', MEDICAL: '#2563eb', ACCIDENT: '#ea580c', DROWNING: '#7c3aed', TRANSFER: '#64748b', RESCUE: '#16a34a', EMS: '#16a34a', MULTI: '#f97316' }
const TYPE_BG = { FIRE: '#fee2e2', MEDICAL: '#dbeafe', ACCIDENT: '#ffedd5', DROWNING: '#ede9fe', TRANSFER: '#f1f5f9', RESCUE: '#dcfce7', EMS: '#dcfce7', MULTI: '#ffedd5' }
const sc = s => STATUS_COLOR[s] || '#64748b'
const sb = s => STATUS_BG[s] || '#f1f5f9'
const tc = t => TYPE_COLOR[t] || '#64748b'
const tb = t => TYPE_BG[t] || '#f1f5f9'
const ROLE_COLOR = { DRIVER: '#2563eb', PARAMEDIC: '#16a34a', PARAMEDIC_HELPER: '#ea580c', DISPATCHER: '#7c3aed' }
const rc = r => ROLE_COLOR[r] || '#64748b'

function initials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function timeAgo(iso) {
    if (!iso) return '—'
    const str = iso.toString().includes('Z') || iso.toString().includes('+') ? iso : iso + '+03:00'
    const d = Math.floor((Date.now() - new Date(str)) / 1000)
    if (d < 0) return 'just now'
    if (d < 60) return d + 's ago'
    if (d < 3600) return Math.floor(d / 60) + 'm ago'
    if (d < 86400) return Math.floor(d / 3600) + 'h ago'
    return Math.floor(d / 86400) + 'd ago'
}
function useDark() {
    const { theme } = useSettingsStore()
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function StatusPill({ status }) {
    return <span style={{ background: sb(status), color: sc(status), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: sc(status), display: 'inline-block' }} />{status}</span>
}
function TypePill({ type }) {
    return <span style={{ background: tb(type), color: tc(type), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: tc(type), display: 'inline-block' }} />{type}</span>
}
function KpiCard({ icon, color, num, label, sub }) {
    const isDark = useDark()
    const C = { red: { bg: '#fee2e2', text: '#dc2626' }, blue: { bg: '#dbeafe', text: '#2563eb' }, green: { bg: '#dcfce7', text: '#16a34a' }, orange: { bg: '#ffedd5', text: '#ea580c' }, purple: { bg: '#ede9fe', text: '#7c3aed' }, amber: { bg: '#fef3c7', text: '#d97706' } }
    const c = C[color] || C.blue
    return (
        <div style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e4e8ef'}`, borderRadius: 14, padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, color: c.text, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: isDark ? '#f1f5f9' : '#0f172a' }}>{num}</div>
                <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginTop: 4 }}>{label}</div>
                {sub && <div style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    )
}
function Modal({ title, onClose, children, wide }) {
    const isDark = useDark()
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(3px)', overflowY: 'auto' }} onClick={onClose}>
            <div style={{ background: isDark ? '#1e293b' : '#fff', borderRadius: 18, width: '100%', maxWidth: wide ? 720 : 500, padding: 30, boxShadow: '0 30px 80px rgba(0,0,0,0.4)', animation: 'fadeInScale 0.2s ease', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</div>
                    <button onClick={onClose} style={{ background: isDark ? '#334155' : '#f1f5f9', border: 0, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, display: 'grid', placeItems: 'center' }}>×</button>
                </div>
                {children}
            </div>
        </div>
    )
}
function LogoutPopup() {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '40px 48px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', animation: 'fadeInScale 0.2s ease' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fee2e2', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 26 }}>👋</div>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Logging out…</div>
                <div style={{ color: '#64748b', fontSize: 14 }}>See you next time!</div>
            </div>
        </div>
    )
}

function DispatchModal({ incident, employees, vehicles, onClose, onDispatched }) {
    const isDark = useDark()
    const border = isDark ? '#334155' : '#e4e8ef'
    const [aiLoading, setAiLoading] = useState(false)
    const [aiSuggestion, setAiSuggestion] = useState(null)
    const [driverId, setDriverId] = useState('')
    const [paramedicId, setParamedicId] = useState('')
    const [helperId, setHelperId] = useState('')
    const [vehicleId, setVehicleId] = useState('')
    const [dispatching, setDispatching] = useState(false)
    const [error, setError] = useState('')

    const onDutyDrivers = employees.filter(e => e.role === 'DRIVER' && e.dutyStatus === 'ON_DUTY')
    const onDutyParamedics = employees.filter(e => e.role === 'PARAMEDIC' && e.dutyStatus === 'ON_DUTY')
    const onDutyHelpers = employees.filter(e => e.role === 'PARAMEDIC_HELPER' && e.dutyStatus === 'ON_DUTY')
    const availVehicles = vehicles.filter(v => v.status === 'available')

    const getAiSuggestion = async () => {
        setAiLoading(true); setAiSuggestion(null)
        try {
            const response = await axiosClient.post('/ai/dispatch-suggest', {
                incidentType: incident.type, location: incident.locationText || 'Unknown', summary: incident.aiSummary || '',
                drivers: onDutyDrivers.map(e => e.fullName).join(', ') || 'none',
                paramedics: onDutyParamedics.map(e => e.fullName).join(', ') || 'none',
                helpers: onDutyHelpers.map(e => e.fullName).join(', ') || 'none',
                vehicles: availVehicles.map(v => v.code + ' (' + v.type + ')').join(', ') || 'none',
            })
            const text = response.data.suggestion || ''
            const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
            setAiSuggestion(parsed)
            if (parsed.recommendedDriver) { const d = onDutyDrivers.find(e => e.fullName === parsed.recommendedDriver); if (d) setDriverId(d.id) }
            if (parsed.recommendedParamedic) { const p = onDutyParamedics.find(e => e.fullName === parsed.recommendedParamedic); if (p) setParamedicId(p.id) }
            if (parsed.recommendedHelper) { const h = onDutyHelpers.find(e => e.fullName === parsed.recommendedHelper); if (h) setHelperId(h.id) }
            if (parsed.recommendedVehicle) { const v = availVehicles.find(v => v.code === parsed.recommendedVehicle); if (v) setVehicleId(v.id) }
        } catch {
            const suggestion = { urgency: incident.priority, reasoning: `${incident.type} incident at ${incident.locationText || 'unknown location'}. Suggested team based on available staff.`, recommendedDriver: onDutyDrivers[0]?.fullName || null, recommendedParamedic: onDutyParamedics[0]?.fullName || null, recommendedHelper: onDutyHelpers[0]?.fullName || null, recommendedVehicle: availVehicles[0]?.code || null }
            setAiSuggestion(suggestion)
            if (onDutyDrivers[0]) setDriverId(onDutyDrivers[0].id)
            if (onDutyParamedics[0]) setParamedicId(onDutyParamedics[0].id)
            if (onDutyHelpers[0]) setHelperId(onDutyHelpers[0].id)
            if (availVehicles[0]) setVehicleId(availVehicles[0].id)
        } finally { setAiLoading(false) }
    }
    useEffect(() => { getAiSuggestion() }, [])

    const handleDispatch = async () => {
        if (!driverId && !paramedicId) { setError('Select at least a driver or paramedic'); return }
        setDispatching(true); setError('')
        try { await axiosClient.patch(`/incidents/${incident.id}/dispatch`, { driverId: driverId || null, paramedicId: paramedicId || null, helperId: helperId || null, vehicleId: vehicleId || null }); onDispatched() }
        catch (e) { setError(e.response?.data?.message || 'Failed to dispatch'); setDispatching(false) }
    }

    const urgencyColor = u => u === 'CRITICAL' ? '#dc2626' : u === 'HIGH' ? '#ea580c' : '#d97706'
    const urgencyBg = u => u === 'CRITICAL' ? '#fee2e2' : u === 'HIGH' ? '#ffedd5' : '#fef3c7'
    const selStyle = (val) => ({ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: val ? (isDark ? '#1e3a5f' : '#eff6ff') : (isDark ? '#0f172a' : '#fff'), color: isDark ? '#f1f5f9' : '#0f172a' })

    return (
        <Modal title="" onClose={onClose} wide>
            <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 12, padding: 20, marginBottom: 20, color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ background: '#dc262620', borderRadius: 8, padding: '6px 10px' }}><TypePill type={incident.type} /></div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#94a3b8' }}>{incident.code}</div>
                    <div style={{ marginLeft: 'auto' }}><StatusPill status={incident.status} /></div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{incident.locationText || 'Unknown location'}</div>
                {incident.aiSummary && <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>✨ {incident.aiSummary}</div>}
            </div>
            <div style={{ background: aiLoading ? (isDark ? '#1e293b' : '#f8fafc') : 'linear-gradient(135deg,#eff6ff,#f0fdf4)', border: `1px solid ${isDark ? '#334155' : '#bfdbfe'}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: aiLoading ? 0 : 10 }}>
                    <span style={{ fontSize: 16 }}>🤖</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1e40af' }}>AI Dispatch Suggestion</span>
                    {!aiLoading && <button onClick={getAiSuggestion} style={{ marginLeft: 'auto', padding: '4px 10px', background: '#dbeafe', border: 0, borderRadius: 6, fontSize: 11, color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>↺ Retry</button>}
                </div>
                {aiLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: '#64748b', fontSize: 13 }}>
                        <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⚙️</span>
                        Analyzing incident data…
                    </div>
                ) : aiSuggestion ? (
                    <>
                        {aiSuggestion.urgency && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: urgencyBg(aiSuggestion.urgency), color: urgencyColor(aiSuggestion.urgency), padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🚨 {aiSuggestion.urgency} URGENCY</div>}
                        <div style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#334155', lineHeight: 1.6, marginBottom: 10 }}>{aiSuggestion.reasoning}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                            {aiSuggestion.recommendedDriver && <div style={{ background: '#dbeafe', borderRadius: 8, padding: '8px 10px', color: '#1e40af' }}>🚗 <strong>Driver:</strong> {aiSuggestion.recommendedDriver}</div>}
                            {aiSuggestion.recommendedParamedic && <div style={{ background: '#dcfce7', borderRadius: 8, padding: '8px 10px', color: '#15803d' }}>🏥 <strong>Paramedic:</strong> {aiSuggestion.recommendedParamedic}</div>}
                            {aiSuggestion.recommendedHelper && <div style={{ background: '#ffedd5', borderRadius: 8, padding: '8px 10px', color: '#c2410c' }}>💊 <strong>Helper:</strong> {aiSuggestion.recommendedHelper}</div>}
                            {aiSuggestion.recommendedVehicle && <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 10px', color: '#15803d' }}>🚑 <strong>Vehicle:</strong> {aiSuggestion.recommendedVehicle}</div>}
                        </div>
                    </>
                ) : null}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#94a3b8' : '#374151', marginBottom: 12 }}>Confirm Team Assignment</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>🚗 Driver</label>
                    <select value={driverId} onChange={e => setDriverId(e.target.value)} style={selStyle(driverId)}>
                        <option value="">— Not assigned —</option>
                        {onDutyDrivers.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                    </select>
                    {onDutyDrivers.length === 0 && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠️ No drivers on duty</div>}
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>🏥 Paramedic</label>
                    <select value={paramedicId} onChange={e => setParamedicId(e.target.value)} style={selStyle(paramedicId)}>
                        <option value="">— Not assigned —</option>
                        {onDutyParamedics.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                    </select>
                    {onDutyParamedics.length === 0 && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠️ No paramedics on duty</div>}
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>💊 Paramedic Helper</label>
                    <select value={helperId} onChange={e => setHelperId(e.target.value)} style={selStyle(helperId)}>
                        <option value="">— Not assigned —</option>
                        {onDutyHelpers.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>🚑 Vehicle</label>
                    <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={selStyle(vehicleId)}>
                        <option value="">— Not assigned —</option>
                        {availVehicles.map(v => <option key={v.id} value={v.id}>{v.code} — {v.type}</option>)}
                    </select>
                    {availVehicles.length === 0 && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠️ No vehicles available</div>}
                </div>
            </div>
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '10px 20px', background: isDark ? '#334155' : '#f1f5f9', border: 0, borderRadius: 9, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: isDark ? '#f1f5f9' : '#374151' }}>Cancel</button>
                <button onClick={handleDispatch} disabled={dispatching} style={{ padding: '10px 24px', background: dispatching ? '#86efac' : '#16a34a', color: '#fff', border: 0, borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: dispatching ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dispatching ? '⏳ Dispatching…' : '🚨 Confirm Dispatch'}
                </button>
            </div>
        </Modal>
    )
}

function Sidebar({ active, setActive, user, onLogout, photo, centerName, newCount }) {
    const [open, setOpen] = useState(false)
    const NAV = [
        { id: 'desk', icon: '📡', label: 'Dispatch Desk' },
        { id: 'active', icon: '🔴', label: 'Active Incidents' },
        { id: 'history', icon: '📋', label: 'History' },
        { id: 'team', icon: '👥', label: 'Team Status' },
        { id: 'hospitals', icon: '🏥', label: 'Hospitals' },
        { id: 'settings', icon: '⚙', label: 'Settings' },
    ]
    return (
        <div style={{ width: 240, background: '#0d1a33', color: '#8b96ad', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, padding: '20px 14px', gap: 4, flexShrink: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#dc2626', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>📡</div>
                <div><div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>LERS</div><div style={{ fontSize: 9, color: '#8b96ad', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>DISPATCHER</div></div>
            </div>
            {centerName && (
                <div style={{ background: '#ffffff10', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: '#8b96ad', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>My Center</div>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{centerName}</div>
                </div>
            )}
            {NAV.map(n => (
                <button key={n.id} onClick={() => setActive(n.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13.5, color: active === n.id ? '#fff' : '#8b96ad', background: active === n.id ? '#dc262622' : 'transparent', border: active === n.id ? '1px solid #dc262644' : '1px solid transparent', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: active === n.id ? 600 : 400 }}>
                    <span style={{ fontSize: 15 }}>{n.icon}</span>
                    {n.label}
                    {n.id === 'desk' && newCount > 0 && <span className="new-badge" style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{newCount}</span>}
                </button>
            ))}
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #ffffff10', position: 'relative' }}>
                {open && (
                    <div style={{ position: 'absolute', bottom: 62, left: 0, right: 0, background: '#11203d', borderRadius: 10, border: '1px solid #ffffff15', overflow: 'hidden', zIndex: 100 }}>
                        <button onClick={() => { setActive('settings'); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: 'none', border: 0, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>⚙️ Profile & Settings</button>
                        <button onClick={() => { setOpen(false); onLogout() }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: 'none', border: 0, borderTop: '1px solid #ffffff10', color: '#f87171', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>⎋ Logout</button>
                    </div>
                )}
                <button onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                    {photo ? <img src={photo} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#7f1d1d)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(user?.fullName)}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName}</div>
                        <div style={{ fontSize: 11, color: '#8b96ad' }}>{user?.email}</div>
                    </div>
                    <span style={{ color: '#8b96ad', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
                </button>
            </div>
        </div>
    )
}

function TopBar({ user, onRefresh, onProfile, photo, refreshing, onLogout, newCount }) {
    const [open, setOpen] = useState(false)
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    return (
        <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
            {refreshing && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#dc2626,#f97316,#dc2626)', zIndex: 9999 }} />}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 13, color: text2 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                {newCount > 0 && <div className="new-badge" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>🚨 {newCount} new incident{newCount > 1 ? 's' : ''} waiting!</div>}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <button onClick={onRefresh} style={{ padding: '8px 16px', background: card, border: `1px solid ${border}`, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: isDark ? '#f1f5f9' : '#374151' }}>
                    <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>🔄</span>
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <button onClick={() => setOpen(v => !v)} style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#7f1d1d)', display: 'grid', placeItems: 'center', border: 0, cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
                    {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{initials(user?.fullName)}</span>}
                </button>
                {open && (
                    <div style={{ position: 'absolute', top: 46, right: 0, background: card, border: `1px solid ${border}`, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', minWidth: 210, zIndex: 100, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
                        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                            {photo ? <img src={photo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#7f1d1d)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{initials(user?.fullName)}</div>}
                            <div><div style={{ fontWeight: 600, fontSize: 13, color: isDark ? '#f1f5f9' : '#0f172a' }}>{user?.fullName}</div><div style={{ fontSize: 11, color: text2 }}>{user?.email}</div></div>
                        </div>
                        <button onClick={() => { onProfile(); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 0, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: isDark ? '#f1f5f9' : '#374151' }}>⚙️ Profile & Settings</button>
                        <button onClick={() => { setOpen(false); onLogout() }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 0, borderTop: `1px solid ${border}`, fontSize: 13, color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>⎋ Logout</button>
                    </div>
                )}
            </div>
        </div>
    )
}

function PageDesk({ incidents, employees, vehicles, onRefresh }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [selected, setSelected] = useState(null)
    const newIncidents = incidents.filter(i => i.status === 'NEW')
    const dispatchedIncidents = incidents.filter(i => ['DISPATCHED', 'ON_THE_WAY', 'ON_SCENE'].includes(i.status))
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Dispatch Desk</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Manage incoming incidents · assign teams</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
                <KpiCard icon="🆕" color="red" num={newIncidents.length} label="New Incidents" sub="Awaiting dispatch" />
                <KpiCard icon="🚨" color="orange" num={dispatchedIncidents.length} label="In Progress" sub="Teams deployed" />
                <KpiCard icon="👥" color="blue" num={employees.filter(e => e.dutyStatus === 'ON_DUTY').length} label="On Duty" sub="Available now" />
                <KpiCard icon="🔴" color="purple" num={employees.filter(e => e.dutyStatus === 'ON_MISSION').length} label="On Mission" sub="Deployed" />
                <KpiCard icon="🚑" color="green" num={vehicles.filter(v => v.status === 'available').length} label="Vehicles Ready" sub="Available" />
            </div>
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: text }}>🆕 New Incidents</div>
                    {newIncidents.length > 0 && <span className="new-badge" style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{newIncidents.length} waiting</span>}
                </div>
                {newIncidents.length === 0 ? (
                    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                        <div style={{ fontWeight: 600, fontSize: 15, color: text2 }}>All clear!</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>No new incidents waiting for dispatch</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {newIncidents.map(inc => (
                            <div key={inc.id} style={{ background: card, border: `2px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16, animation: 'slideIn 0.3s ease', cursor: 'pointer' }}
                                onClick={() => setSelected(inc)}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = isDark ? '#7f1d1d' : '#fecaca'}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fee2e2', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>
                                    {inc.type === 'FIRE' ? '🔥' : inc.type === 'MEDICAL' ? '🏥' : inc.type === 'ACCIDENT' ? '💥' : inc.type === 'DROWNING' ? '🌊' : '🚨'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <TypePill type={inc.type} />
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{inc.code}</span>
                                        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, background: '#fee2e2', padding: '2px 8px', borderRadius: 6 }}>{timeAgo(inc.reportedAt)}</span>
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: text }}>{inc.locationText || 'Unknown location'}</div>
                                    {inc.aiSummary && <div style={{ fontSize: 12, color: text2 }}>✨ {inc.aiSummary}</div>}
                                </div>
                                <div style={{ flexShrink: 0 }}>
                                    <span style={{ background: inc.aiRiskLevel === 'HIGH' ? '#fee2e2' : inc.aiRiskLevel === 'MEDIUM' ? '#ffedd5' : '#dcfce7', color: inc.aiRiskLevel === 'HIGH' ? '#dc2626' : inc.aiRiskLevel === 'MEDIUM' ? '#ea580c' : '#16a34a', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{inc.aiRiskLevel || inc.priority}</span>
                                </div>
                                <button onClick={e => { e.stopPropagation(); setSelected(inc) }} style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>🚨 Dispatch</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {dispatchedIncidents.length > 0 && (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: text }}>🔴 Active — Teams Deployed</div>
                    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ background: theadBg }}>{['Code', 'Type', 'Location', 'Status', 'Team', 'Age'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                            <tbody>
                                {dispatchedIncidents.map(inc => (
                                    <tr key={inc.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                        <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: text }}>{inc.code}</td>
                                        <td style={{ padding: '14px 18px' }}><TypePill type={inc.type} /></td>
                                        <td style={{ padding: '14px 18px', fontSize: 13, color: text }}>{inc.locationText || '—'}</td>
                                        <td style={{ padding: '14px 18px' }}><StatusPill status={inc.status} /></td>
                                        <td style={{ padding: '14px 18px', fontSize: 12, color: text2 }}>{[inc.driverId && '🚗', inc.paramedicId && '🏥', inc.helperId && '💊'].filter(Boolean).join(' ') || '—'}</td>
                                        <td style={{ padding: '14px 18px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{timeAgo(inc.reportedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {selected && <DispatchModal incident={selected} employees={employees} vehicles={vehicles} onClose={() => setSelected(null)} onDispatched={() => { setSelected(null); onRefresh() }} />}
        </div>
    )
}

function PageActive({ incidents, onRefresh }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const active = incidents.filter(i => !['NEW', 'CLOSED'].includes(i.status))
    const [updating, setUpdating] = useState(null)
    const updateStatus = async (id, status) => { setUpdating(id); try { await axiosClient.patch(`/incidents/${id}/status`, { status }); onRefresh() } catch { } finally { setUpdating(null) } }
    const nextStatus = s => s === 'DISPATCHED' ? 'ON_THE_WAY' : s === 'ON_THE_WAY' ? 'ON_SCENE' : s === 'ON_SCENE' ? 'CLOSED' : null
    const nextLabel = s => s === 'DISPATCHED' ? 'On The Way' : s === 'ON_THE_WAY' ? 'On Scene' : s === 'ON_SCENE' ? 'Close Incident' : null
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Active Incidents</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{active.length} incidents with teams deployed</div>
            </div>
            {active.length === 0 ? (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🟢</div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: text2 }}>No active incidents</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {active.map(inc => (
                        <div key={inc.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 20, animation: 'slideIn 0.3s ease' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <TypePill type={inc.type} />
                                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{inc.code}</span>
                                <StatusPill status={inc.status} />
                                <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{timeAgo(inc.reportedAt)}</span>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: text }}>{inc.locationText || 'Unknown location'}</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                                {inc.driverId && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>🚗 Driver assigned</span>}
                                {inc.patientCondition && (
                                    <span style={{
                                        background: inc.patientCondition === 'CRITICAL' ? '#fee2e2' : inc.patientCondition === 'MODERATE' ? '#fef3c7' : '#dcfce7',
                                        color: inc.patientCondition === 'CRITICAL' ? '#dc2626' : inc.patientCondition === 'MODERATE' ? '#d97706' : '#16a34a',
                                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600
                                    }}>
                                        {inc.patientCondition === 'CRITICAL' ? '🔴' : inc.patientCondition === 'MODERATE' ? '🟡' : '🟢'} {inc.patientCondition}
                                    </span>
                                )}
                                {inc.paramedicId && <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>🏥 Paramedic assigned</span>}
                                {inc.helperId && <span style={{ background: '#ffedd5', color: '#c2410c', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>💊 Helper assigned</span>}
                                {inc.vehicleId && <span style={{ background: '#f0fdf4', color: '#15803d', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>🚑 Vehicle assigned</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, fontSize: 12, color: text2 }}>
                                {[['Reported', inc.reportedAt], ['Dispatched', inc.dispatchedAt], ['On Way', inc.acceptedAt], ['On Scene', inc.arrivedAt]].map(([l, t], i, arr) => (
                                    <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ color: t ? '#16a34a' : isDark ? '#475569' : '#d1d5db', fontWeight: t ? 600 : 400 }}>{t ? '✓' : i === arr.findIndex(a => !a[1]) ? '●' : '○'} {l}</span>
                                        {i < arr.length - 1 && <span style={{ color: isDark ? '#475569' : '#d1d5db' }}>→</span>}
                                    </span>
                                ))}
                            </div>
                            {nextStatus(inc.status) && (
                                <button onClick={() => updateStatus(inc.id, nextStatus(inc.status))} disabled={updating === inc.id}
                                    style={{ padding: '8px 18px', background: inc.status === 'ON_SCENE' ? '#dc2626' : '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    {updating === inc.id ? 'Updating…' : `→ Mark as ${nextLabel(inc.status)}`}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function PageHistory({ incidents }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [tab, setTab] = useState('all')
    const closed = incidents.filter(i => i.status === 'CLOSED')
    const TABS = ['all', 'FIRE', 'MEDICAL', 'ACCIDENT', 'RESCUE', 'DROWNING']
    const filtered = tab === 'all' ? closed : closed.filter(i => i.type === tab)
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Incident History</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{closed.length} closed incidents</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: card, padding: 4, border: `1px solid ${border}`, borderRadius: 10, width: 'fit-content', marginBottom: 16, flexWrap: 'wrap' }}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', background: tab === t ? '#f0fdf4' : 'transparent', border: tab === t ? '1px solid #bbf7d0' : '1px solid transparent', borderRadius: 7, fontSize: 13, color: tab === t ? '#16a34a' : text2, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t === 'all' ? 'All' : t}
                        <span style={{ marginLeft: 6, fontSize: 11, background: tab === t ? '#16a34a' : isDark ? '#334155' : '#e4e8ef', color: tab === t ? '#fff' : text2, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{t === 'all' ? closed.length : closed.filter(i => i.type === t).length}</span>
                    </button>
                ))}
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Code', 'Type', 'Location', 'Priority', 'Reported', 'Closed'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map(inc => (
                            <tr key={inc.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: text }}>{inc.code}</td>
                                <td style={{ padding: '14px 18px' }}><TypePill type={inc.type} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 13, color: text }}>{inc.locationText || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: inc.priority === 'HIGH' ? '#fee2e2' : inc.priority === 'MEDIUM' ? '#ffedd5' : '#dcfce7', color: inc.priority === 'HIGH' ? '#dc2626' : inc.priority === 'MEDIUM' ? '#ea580c' : '#16a34a' }}>{inc.priority}</span></td>
                                <td style={{ padding: '14px 18px', fontSize: 12, color: text2, fontFamily: 'monospace' }}>{timeAgo(inc.reportedAt)}</td>
                                <td style={{ padding: '14px 18px', fontSize: 12, color: '#16a34a', fontFamily: 'monospace' }}>{inc.closedAt ? timeAgo(inc.closedAt) : '—'}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No closed incidents</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function PageTeam({ employees, vehicles }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const rowPad = isDark ? '#1e293b' : '#f8fafc'
    const onDuty = employees.filter(e => e.dutyStatus === 'ON_DUTY')
    const onMission = employees.filter(e => e.dutyStatus === 'ON_MISSION')
    const offDuty = employees.filter(e => e.dutyStatus === 'OFF_DUTY')
    const vBg = s => s === 'available' ? '#dcfce7' : s === 'on-mission' ? '#fee2e2' : '#fef3c7'
    const vC = s => s === 'available' ? '#16a34a' : s === 'on-mission' ? '#dc2626' : '#d97706'
    const EmpCard = ({ emp, dot }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${rowPad}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${rc(emp.role)},${rc(emp.role)}99)`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(emp.fullName)}</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: text }}>{emp.fullName}</div>
                <div style={{ fontSize: 11, color: text2 }}>{emp.role?.replace(/_/g, ' ')}</div>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block', animation: dot === '#dc2626' ? 'pulse 1.5s infinite' : 'none' }} />
        </div>
    )
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Team Status</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{onDuty.length} on duty · {onMission.length} on mission · {offDuty.length} off duty</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: text }}>🟢 On Duty</div>
                        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{onDuty.length}</span>
                    </div>
                    <div style={{ padding: 16 }}>
                        {onDuty.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 13 }}>No employees on duty</div>
                            : onDuty.map(e => <EmpCard key={e.id} emp={e} dot="#16a34a" />)}
                    </div>
                </div>
                <div style={{ background: card, border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: text }}>🚨 On Mission</div>
                        <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{onMission.length}</span>
                    </div>
                    <div style={{ padding: 16 }}>
                        {onMission.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 13 }}>No one on mission</div>
                            : onMission.map(e => <EmpCard key={e.id} emp={e} dot="#dc2626" />)}
                    </div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: text }}>⚫ Off Duty</div>
                        <span style={{ background: isDark ? '#334155' : '#f1f5f9', color: text2, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{offDuty.length}</span>
                    </div>
                    <div style={{ padding: 16 }}>
                        {offDuty.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 13 }}>Everyone is on duty!</div>
                            : offDuty.map(e => (
                                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${rowPad}`, opacity: 0.6 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: isDark ? '#334155' : '#e4e8ef', display: 'grid', placeItems: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(e.fullName)}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 600, color: text2 }}>{e.fullName}</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.role?.replace(/_/g, ' ')}</div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderSub}` }}><div style={{ fontWeight: 600, fontSize: 15, color: text }}>🚑 Vehicle Fleet</div></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Code', 'Plate', 'Type', 'Status', 'Mileage'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {vehicles.map(v => (
                            <tr key={v.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: text }}>{v.code}</td>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text }}>{v.plate}</td>
                                <td style={{ padding: '14px 18px', fontSize: 13, color: text }}>{v.type || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><span style={{ background: vBg(v.status), color: vC(v.status), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{v.status}</span></td>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text2 }}>{v.mileage || 0} km</td>
                            </tr>
                        ))}
                        {vehicles.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No vehicles</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function PageSettings({ user, photo, setPhoto }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#334155' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
    const [msg, setMsg] = useState('')
    const [err, setErr] = useState('')
    const { theme, setTheme } = useSettingsStore()
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const fileRef = useRef()
    const handlePhoto = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => { setPhoto(ev.target.result); localStorage.setItem('dispatcherPhoto', ev.target.result) }; r.readAsDataURL(file) }
    const removePhoto = () => { setPhoto(null); localStorage.removeItem('dispatcherPhoto') }
    const handleSave = async () => {
        setMsg(''); setErr('')
        if (form.newPassword && form.newPassword !== form.confirmPassword) { setErr('Passwords do not match'); return }
        try { if (form.newPassword) await axiosClient.patch('/auth/change-password', { oldPassword: form.oldPassword, newPassword: form.newPassword }); setMsg('Saved!'); setForm({ oldPassword: '', newPassword: '', confirmPassword: '' }) }
        catch (e) { setErr(e.response?.data?.message || 'Failed') }
    }
    const FF = ({ label, value, onChange, type = 'text', placeholder }) => (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : '#374151', marginBottom: 6 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}
                onFocus={e => e.target.style.border = '1px solid #dc2626'}
                onBlur={e => e.target.style.border = `1px solid ${border}`} />
        </div>
    )
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Settings</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Account & profile</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Profile</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ position: 'relative' }}>
                            {photo ? <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #e4e8ef' }} /> : <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#7f1d1d)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 32 }}>{initials(user?.fullName)}</div>}
                            <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%', background: '#dc2626', border: '2px solid #fff', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 12, color: '#fff' }}>✏</button>
                            {photo && <button onClick={removePhoto} style={{ position: 'absolute', top: 2, right: 2, width: 26, height: 26, borderRadius: '50%', background: '#dc2626', border: '2px solid #fff', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 11, color: '#fff' }}>✕</button>}
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: 17, color: text }}>{user?.fullName}</div>
                            <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{user?.email}</div>
                            <div style={{ marginTop: 8 }}><span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>DISPATCHER</span></div>
                        </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${borderSub}`, marginTop: 20, paddingTop: 20 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>USER ID</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: text, background: isDark ? '#0f172a' : '#f8fafc', padding: '8px 12px', borderRadius: 8, wordBreak: 'break-all' }}>{user?.userId}</div>
                    </div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Change Password</div>
                    <FF label="Current Password" value={form.oldPassword} onChange={v => set('oldPassword', v)} type="password" placeholder="••••••••" />
                    <FF label="New Password" value={form.newPassword} onChange={v => set('newPassword', v)} type="password" placeholder="At least 8 characters" />
                    <FF label="Confirm New Password" value={form.confirmPassword} onChange={v => set('confirmPassword', v)} type="password" placeholder="Repeat new password" />
                    {err && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>⚠️ {err}</div>}
                    {msg && <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: 13, marginBottom: 14 }}>✅ {msg}</div>}
                    <button onClick={handleSave} style={{ padding: '11px 22px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Save Changes</button>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28, gridColumn: '1 / -1' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Appearance</div>
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: text2, marginBottom: 10 }}>Theme</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['system', '💻 System']].map(([val, label]) => (
                                <button key={val} onClick={() => setTheme(val)} style={{ padding: '8px 20px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: theme === val ? '2px solid #dc2626' : `2px solid ${border}`, background: theme === val ? '#fee2e2' : isDark ? '#0f172a' : '#f8fafc', color: theme === val ? '#dc2626' : text2, transition: 'all 0.15s' }}>{label}</button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════
// PATCH 3
// ══════════════════════════════════════════════

const HOSPITAL_TYPES = ['ALL', 'GENERAL', 'CARDIAC', 'TRAUMA', 'PEDIATRIC', 'PSYCHIATRIC', 'ONCOLOGY']
const HTYPE_COLOR = { GENERAL: '#2563eb', CARDIAC: '#dc2626', TRAUMA: '#ea580c', PEDIATRIC: '#7c3aed', PSYCHIATRIC: '#16a34a', ONCOLOGY: '#d97706' }
const HTYPE_BG = { GENERAL: '#dbeafe', CARDIAC: '#fee2e2', TRAUMA: '#ffedd5', PEDIATRIC: '#ede9fe', PSYCHIATRIC: '#dcfce7', ONCOLOGY: '#fef3c7' }
const ROOM_STATUS_COLOR = { AVAILABLE: '#16a34a', OCCUPIED: '#dc2626', RESERVED: '#d97706' }
const ROOM_STATUS_BG = { AVAILABLE: '#dcfce7', OCCUPIED: '#fee2e2', RESERVED: '#fef3c7' }

function PageHospitalsDispatcher({ employees, onRefresh }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'

    const [hospitals, setHospitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterType, setFilterType] = useState('ALL')
    const [selectedHospital, setSelectedHospital] = useState(null)
    const [floors, setFloors] = useState([])
    const [loadingFloors, setLoadingFloors] = useState(false)
    const [bookModal, setBookModal] = useState(null) // room object
    const [driverUserId, setDriverUserId] = useState('')
    const [incidentId, setIncidentId] = useState('')
    const [booking, setBooking] = useState(false)
    const [toast, setToast] = useState({ msg: '', type: '' })
    const [incidents, setIncidents] = useState([])

    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }

    const drivers = employees.filter(e => e.role === 'DRIVER')

    useEffect(() => {
        axiosClient.get('/hospitals').then(r => { setHospitals(Array.isArray(r.data) ? r.data : []); setLoading(false) }).catch(() => setLoading(false))
        axiosClient.get('/incidents').then(r => setIncidents(r.data.filter(i => ['ON_SCENE', 'ON_THE_WAY', 'DISPATCHED'].includes(i.status)))).catch(() => { })
    }, [])

    const selectHospital = async (h) => {
        setSelectedHospital(h)
        setLoadingFloors(true)
        try {
            const r = await axiosClient.get(`/hospitals/${h.id}/floors`)
            setFloors(r.data)
        } catch { setFloors([]) }
        finally { setLoadingFloors(false) }
    }

    const handleBook = async () => {
        if (!driverUserId) { showToast('Select a driver', 'error'); return }
        setBooking(true)
        try {
            await axiosClient.post(`/hospitals/rooms/${bookModal.id}/book/dispatcher`, null, {
                params: {
                    incidentId: incidentId || null,
                    driverUserId
                }
            })
            setBookModal(null)
            setDriverUserId('')
            setIncidentId('')
            showToast('Room booked! Driver notified 🚑', 'success')
            selectHospital(selectedHospital)
            onRefresh()
        } catch (e) { showToast(e.response?.data?.message || 'Failed to book', 'error') }
        finally { setBooking(false) }
    }

    const handleRelease = async (roomId) => {
        if (!window.confirm('Mark patient as discharged and release this room?')) return
        try {
            await axiosClient.patch(`/hospitals/rooms/${roomId}/release`)
            showToast('Room released!', 'success')
            selectHospital(selectedHospital)
        } catch { showToast('Failed', 'error') }
    }

    const shown = filterType === 'ALL' ? hospitals : hospitals.filter(h => h.type === filterType)

    const totalAvailable = (h) => {
        // count from floors if loaded
        if (selectedHospital?.id === h.id) {
            return floors.reduce((a, f) => a + (f.rooms?.filter(r => r.status === 'AVAILABLE').length || 0), 0)
        }
        return '—'
    }

    return (
        <div className="page-refresh">
            {/* Toast */}
            {toast.msg && (
                <div style={{ position: 'fixed', top: 20, right: 20, background: toast.type === 'error' ? '#fee2e2' : toast.type === 'loading' ? '#dbeafe' : '#dcfce7', color: toast.type === 'error' ? '#dc2626' : toast.type === 'loading' ? '#2563eb' : '#16a34a', border: `1px solid ${toast.type === 'error' ? '#dc262630' : '#16a34a30'}`, borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 500, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                    {toast.type === 'error' ? '⚠️' : toast.type === 'loading' ? '⏳' : '✅'} {toast.msg}
                </div>
            )}

            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Hospitals</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Find available rooms · assign to driver</div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 4, background: card, padding: 4, border: `1px solid ${border}`, borderRadius: 10, width: 'fit-content', marginBottom: 16, flexWrap: 'wrap' }}>
                {HOSPITAL_TYPES.map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                        style={{ padding: '7px 14px', background: filterType === t ? '#fee2e2' : 'transparent', border: filterType === t ? '1px solid #fecaca' : '1px solid transparent', borderRadius: 7, fontSize: 13, color: filterType === t ? '#dc2626' : text2, fontWeight: filterType === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t}
                        <span style={{ marginLeft: 6, fontSize: 11, background: filterType === t ? '#dc2626' : isDark ? '#334155' : '#e4e8ef', color: filterType === t ? '#fff' : text2, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                            {t === 'ALL' ? hospitals.length : hospitals.filter(h => h.type === t).length}
                        </span>
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedHospital ? '1fr 1.5fr' : '1fr', gap: 16 }}>
                {/* Hospitals List */}
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: theadBg }}>
                                {['Hospital', 'Region', 'Type', 'Phone', ''].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                            ) : shown.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                    <div style={{ fontSize: 36, marginBottom: 10 }}>🏥</div>
                                    <div>No hospitals found</div>
                                </td></tr>
                            ) : shown.map(h => (
                                <tr key={h.id} onClick={() => selectHospital(h)}
                                    style={{ borderBottom: `1px solid ${rowBorder}`, cursor: 'pointer', background: selectedHospital?.id === h.id ? (isDark ? '#7f1d1d20' : '#fff5f5') : 'transparent' }}>
                                    <td style={{ padding: '13px 16px', fontWeight: 600, fontSize: 13.5, color: text }}>{h.name}</td>
                                    <td style={{ padding: '13px 16px', fontSize: 13, color: text2 }}>{h.region || '—'}</td>
                                    <td style={{ padding: '13px 16px' }}>
                                        <span style={{ background: HTYPE_BG[h.type] || '#f1f5f9', color: HTYPE_COLOR[h.type] || '#64748b', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{h.type}</span>
                                    </td>
                                    <td style={{ padding: '13px 16px', fontSize: 12, fontFamily: 'monospace', color: text2 }}>{h.phone || '—'}</td>
                                    <td style={{ padding: '13px 16px' }}>
                                        <span style={{ fontSize: 18, color: selectedHospital?.id === h.id ? '#dc2626' : '#94a3b8' }}>›</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Hospital Detail — Floors & Rooms */}
                {selectedHospital && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Header */}
                        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 18 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: text }}>{selectedHospital.name}</div>
                                    <div style={{ fontSize: 13, color: text2, marginTop: 2 }}>{selectedHospital.region} · {selectedHospital.phone || 'No phone'}</div>
                                </div>
                                <button onClick={() => { setSelectedHospital(null); setFloors([]) }}
                                    style={{ background: isDark ? '#334155' : '#f1f5f9', border: 0, width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: text2, fontSize: 16, display: 'grid', placeItems: 'center' }}>×</button>
                            </div>
                            {/* Available rooms summary */}
                            {!loadingFloors && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                    {[
                                        { label: 'Available', count: floors.reduce((a, f) => a + (f.rooms?.filter(r => r.status === 'AVAILABLE').length || 0), 0), color: '#16a34a', bg: '#dcfce7' },
                                        { label: 'Occupied', count: floors.reduce((a, f) => a + (f.rooms?.filter(r => r.status === 'OCCUPIED').length || 0), 0), color: '#dc2626', bg: '#fee2e2' },
                                        { label: 'Reserved', count: floors.reduce((a, f) => a + (f.rooms?.filter(r => r.status === 'RESERVED').length || 0), 0), color: '#d97706', bg: '#fef3c7' },
                                    ].map(({ label, count, color, bg }) => (
                                        <div key={label} style={{ background: bg, borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontWeight: 700, fontSize: 16, color }}>{count}</span>
                                            <span style={{ fontSize: 12, color, fontWeight: 500 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Floors & Rooms */}
                        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 16, maxHeight: 500, overflowY: 'auto' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: text, marginBottom: 14 }}>Floors & Rooms</div>
                            {loadingFloors ? (
                                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Loading floors…</div>
                            ) : floors.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
                                    <div>No floors configured yet</div>
                                </div>
                            ) : floors.map(floor => (
                                <div key={floor.id} style={{ marginBottom: 14, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isDark ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${border}` }}>
                                        <div style={{ fontWeight: 600, fontSize: 13.5, color: text }}>Floor {floor.floorNumber}</div>
                                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                                            {floor.rooms?.filter(r => r.status === 'AVAILABLE').length || 0} available
                                        </span>
                                    </div>
                                    <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {!floor.rooms || floor.rooms.length === 0 ? (
                                            <div style={{ fontSize: 12, color: '#94a3b8' }}>No rooms</div>
                                        ) : floor.rooms.map(room => (
                                            <div key={room.id} style={{ background: ROOM_STATUS_BG[room.status] || '#f1f5f9', border: `2px solid ${ROOM_STATUS_COLOR[room.status]}40`, borderRadius: 10, padding: '10px 12px', minWidth: 100, textAlign: 'center' }}>
                                                <div style={{ fontWeight: 800, fontSize: 15, color: ROOM_STATUS_COLOR[room.status] }}>#{room.roomNumber}</div>
                                                <div style={{ fontSize: 11, color: ROOM_STATUS_COLOR[room.status], opacity: 0.8, marginTop: 2 }}>{room.type}</div>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: ROOM_STATUS_COLOR[room.status], marginTop: 3 }}>{room.status}</div>
                                                {room.status === 'AVAILABLE' && (
                                                    <button onClick={() => { setBookModal(room); setDriverUserId(''); setIncidentId('') }}
                                                        style={{ marginTop: 7, width: '100%', padding: '5px 0', background: '#dc2626', color: '#fff', border: 0, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>📋 Book</button>
                                                )}
                                                {room.status !== 'AVAILABLE' && (
                                                    <button onClick={() => handleRelease(room.id)}
                                                        style={{ marginTop: 7, width: '100%', padding: '5px 0', background: '#16a34a', color: '#fff', border: 0, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🔓 Release</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Book Room Modal */}
            {bookModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }} onClick={() => setBookModal(null)}>
                    <div style={{ background: card, borderRadius: 18, width: '100%', maxWidth: 460, padding: 30, boxShadow: '0 25px 80px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 700, fontSize: 18, color: text, marginBottom: 6 }}>📋 Book Room</div>
                        <div style={{ fontSize: 13, color: text2, marginBottom: 20 }}>
                            {selectedHospital?.name} · Floor {bookModal.floor?.floorNumber} · Room #{bookModal.roomNumber} · <span style={{ fontWeight: 600 }}>{bookModal.type}</span>
                        </div>

                        {/* Driver Select */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>🚗 Driver <span style={{ color: '#dc2626' }}>*</span></label>
                            <select value={driverUserId} onChange={e => setDriverUserId(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: isDark ? '#0f172a' : '#fff', color: text }}>
                                <option value="">— Select Driver —</option>
                                {drivers.map(d => <option key={d.id} value={d.id}>{d.fullName} {d.dutyStatus === 'ON_DUTY' ? '🟢' : d.dutyStatus === 'ON_MISSION' ? '🔴' : '⚫'}</option>)}
                            </select>
                            {drivers.length === 0 && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>⚠️ No drivers found</div>}
                        </div>

                        {/* Incident Select (optional) */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>🚨 Link to Incident <span style={{ fontSize: 11, color: '#94a3b8' }}>(optional)</span></label>
                            <select value={incidentId} onChange={e => setIncidentId(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: isDark ? '#0f172a' : '#fff', color: text }}>
                                <option value="">— No incident —</option>
                                {incidents.map(i => <option key={i.id} value={i.id}>{i.code} · {i.type} · {i.locationText || 'Unknown'}</option>)}
                            </select>
                        </div>

                        {/* Info Box */}
                        <div style={{ background: isDark ? '#1e3a1e' : '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#15803d', marginBottom: 20, lineHeight: 1.6 }}>
                            ✅ Room will be marked <strong>Occupied</strong> immediately.<br />
                            🔔 Driver will receive a push notification with hospital + room details.
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setBookModal(null)} style={{ padding: '9px 18px', background: isDark ? '#334155' : '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: text }}>Cancel</button>
                            <button onClick={handleBook} disabled={booking} style={{ padding: '9px 20px', background: booking ? '#fca5a5' : '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: booking ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                {booking ? '⏳ Booking…' : '📋 Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function DispatcherDashboard() {
    const [page, setPage] = useState('desk')
    const [incidents, setIncidents] = useState([])
    const [employees, setEmployees] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [center, setCenter] = useState(null)
    const [photo, setPhoto] = useState(() => localStorage.getItem('dispatcherPhoto') || null)
    const [refreshing, setRefreshing] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const { theme } = useSettingsStore()
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    const loadData = useCallback(async () => {
        setRefreshing(true)
        try {
            const [i, e, v] = await Promise.all([axiosClient.get('/incidents'), axiosClient.get('/employees'), axiosClient.get('/vehicles')])
            setIncidents(i.data); setEmployees(e.data); setVehicles(v.data)
            if (user?.centerId) { axiosClient.get(`/centers/${user.centerId}`).then(r => setCenter(r.data)).catch(() => { }) }
        } catch (e) { console.error(e) }
        finally { setTimeout(() => setRefreshing(false), 600) }
    }, [user])

    useEffect(() => { loadData() }, [loadData])
    useEffect(() => { const interval = setInterval(loadData, 3000); return () => clearInterval(interval) }, [loadData])

    const handleLogout = () => {
        if (!window.confirm('Are you sure you want to logout?')) return
        setLoggingOut(true)
        setTimeout(() => { logout(); navigate('/login') }, 2000)
    }

    const newCount = incidents.filter(i => i.status === 'NEW').length

    const renderPage = () => {
        switch (page) {
            case 'desk': return <PageDesk incidents={incidents} employees={employees} vehicles={vehicles} onRefresh={loadData} />
            case 'active': return <PageActive incidents={incidents} onRefresh={loadData} />
            case 'history': return <PageHistory incidents={incidents} />
            case 'team': return <PageTeam employees={employees} vehicles={vehicles} />
            case 'hospitals': return <PageHospitalsDispatcher employees={employees} onRefresh={loadData} />
            case 'settings': return <PageSettings user={user} photo={photo} setPhoto={setPhoto} />
            default: return <PageDesk incidents={incidents} employees={employees} vehicles={vehicles} onRefresh={loadData} />
        }
    }

    return (
        <div data-theme={isDark ? 'dark' : 'light'} style={{ display: 'flex', minHeight: '100vh', background: isDark ? '#0f172a' : '#f3f5f9', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 14 }}>
            {loggingOut && <LogoutPopup />}
            <Sidebar active={page} setActive={setPage} user={user} onLogout={handleLogout} photo={photo} centerName={center?.name} newCount={newCount} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <TopBar user={user} onRefresh={loadData} onProfile={() => setPage('settings')} photo={photo} refreshing={refreshing} onLogout={handleLogout} newCount={newCount} />
                <div style={{ padding: '24px 28px 64px', flex: 1 }}>
                    {renderPage()}
                </div>
            </div>
        </div>
    )
}