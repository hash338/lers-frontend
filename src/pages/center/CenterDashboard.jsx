import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import axiosClient from '../../api/axiosClient'
import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import useSettingsStore from '../../store/settingsStore'

if (!document.getElementById('lers-center-styles')) {
    const s = document.createElement('style')
    s.id = 'lers-center-styles'
    s.textContent = `
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeInScale { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
    .page-refresh { animation: fadeIn 0.3s ease; }
    [data-theme="dark"] .lers-row:hover { background: #1e293b !important; }
    [data-theme="light"] .lers-row:hover { background: #f8fafc !important; }
    [data-theme="dark"] { --bg:#0f172a; --card:#1e293b; --border:#334155; --text:#f1f5f9; --text2:#94a3b8; --sub:#475569; }
    [data-theme="light"] { --bg:#f3f5f9; --card:#ffffff; --border:#e4e8ef; --text:#0f172a; --text2:#64748b; --sub:#94a3b8; }
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
const ROLE_BG = { DRIVER: '#dbeafe', PARAMEDIC: '#dcfce7', PARAMEDIC_HELPER: '#ffedd5', DISPATCHER: '#ede9fe' }
const rc = r => ROLE_COLOR[r] || '#64748b'
const rb = r => ROLE_BG[r] || '#f1f5f9'

function initials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function timeAgo(iso) {
    if (!iso) return '—'
    const str = iso.toString().includes('Z') || iso.toString().includes('+') ? iso : iso.replace(' ', 'T') + 'Z'
    const d = Math.floor((Date.now() - new Date(str)) / 1000)
    if (d < 0) return 'just now'
    if (d < 60) return d + 's ago'
    if (d < 3600) return Math.floor(d / 60) + 'm ago'
    if (d < 86400) return Math.floor(d / 3600) + 'h ago'
    return Math.floor(d / 86400) + 'd ago'
}

// ── useDark hook ──────────────────────────────────────────────────────────────
function useDark() {
    const { theme } = useSettingsStore()
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, color, num, label, sub }) {
    const isDark = useDark()
    const C = { red: { bg: '#fee2e2', text: '#dc2626' }, blue: { bg: '#dbeafe', text: '#2563eb' }, green: { bg: '#dcfce7', text: '#16a34a' }, orange: { bg: '#ffedd5', text: '#ea580c' }, purple: { bg: '#ede9fe', text: '#7c3aed' }, amber: { bg: '#fef3c7', text: '#d97706' } }
    const c = C[color] || C.blue
    return (
        <div style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e4e8ef'}`, borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 14, alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bg, color: c.text, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: isDark ? '#f1f5f9' : '#0f172a' }}>{num}</div>
                <div style={{ fontSize: 12.5, color: isDark ? '#94a3b8' : '#64748b', marginTop: 5 }}>{label}</div>
                {sub && <div style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    )
}
function StatusPill({ status }) {
    return <span style={{ background: sb(status), color: sc(status), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: sc(status), display: 'inline-block' }} />{status}</span>
}
function TypePill({ type }) {
    return <span style={{ background: tb(type), color: tc(type), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: tc(type), display: 'inline-block' }} />{type}</span>
}
function Modal({ title, onClose, children, wide }) {
    const isDark = useDark()
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(3px)', overflowY: 'auto' }} onClick={onClose}>
            <div style={{ background: isDark ? '#1e293b' : '#fff', borderRadius: 18, width: '100%', maxWidth: wide ? 680 : 460, padding: 30, boxShadow: '0 25px 80px rgba(0,0,0,0.4)', animation: 'fadeInScale 0.2s ease', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</div>
                    <button onClick={onClose} style={{ background: isDark ? '#334155' : '#f1f5f9', border: 0, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, display: 'grid', placeItems: 'center' }}>×</button>
                </div>
                {children}
            </div>
        </div>
    )
}
function Toast({ msg, type }) {
    if (!msg) return null
    const bg = type === 'error' ? '#fee2e2' : type === 'loading' ? '#dbeafe' : '#dcfce7'
    const co = type === 'error' ? '#dc2626' : type === 'loading' ? '#2563eb' : '#16a34a'
    const icon = type === 'error' ? '⚠️' : type === 'loading' ? '⏳' : '✅'
    return (
        <div style={{ position: 'fixed', top: 20, right: 20, background: bg, color: co, border: `1px solid ${co}30`, borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 500, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', animation: 'fadeIn 0.2s ease' }}>
            {icon} {msg}
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
function FF({ label, value, onChange, type = 'text', placeholder, required }) {
    const isDark = useDark()
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : '#374151', marginBottom: 6 }}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#e4e8ef'}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}
                onFocus={e => e.target.style.border = '1px solid #16a34a'}
                onBlur={e => e.target.style.border = `1px solid ${isDark ? '#334155' : '#e4e8ef'}`}
            />
        </div>
    )
}
function SelectField({ label, value, onChange, options, required }) {
    const isDark = useDark()
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : '#374151', marginBottom: 6 }}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#e4e8ef'}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, user, onLogout, photo, centerName, unreadCount = 0 }) {
    const [open, setOpen] = useState(false)
    const NAV = [
        { id: 'dashboard', icon: '⊞', label: 'Dashboard' },
        { id: 'employees', icon: '👥', label: 'Employees' },
        { id: 'vehicles', icon: '🚑', label: 'Vehicles' },
        { id: 'incidents', icon: '⚠', label: 'Incidents' },
        { id: 'maintenance', icon: '🔧', label: 'Maintenance' },
        { id: 'stats', icon: '📊', label: 'Center Stats' },
        { id: 'messages', icon: '💬', label: 'Messages', badge: true },
        { id: 'settings', icon: '⚙', label: 'Settings' },
    ]
    return (
        <div style={{ width: 240, background: '#0d1a33', color: '#8b96ad', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, padding: '20px 14px', gap: 4, flexShrink: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#16a34a', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>+</div>
                <div><div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>LERS</div><div style={{ fontSize: 9, color: '#8b96ad', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CENTER ADMIN</div></div>
            </div>
            {centerName && (
                <div style={{ background: '#ffffff10', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: '#8b96ad', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>My Center</div>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{centerName}</div>
                </div>
            )}
            {NAV.map(n => (
                <button key={n.id} onClick={() => setActive(n.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13.5, color: active === n.id ? '#fff' : '#8b96ad', background: active === n.id ? '#16a34a22' : 'transparent', border: active === n.id ? '1px solid #16a34a44' : '1px solid transparent', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: active === n.id ? 600 : 400 }}>
                    <span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}
                                                                  {n.id === 'messages' && unreadCount > 0 && <span style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{unreadCount}</span>}
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
                    {photo ? <img src={photo} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(user?.fullName)}</div>}
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

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ user, onRefresh, onProfile, photo, refreshing, onLogout }) {
    const [open, setOpen] = useState(false)
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    return (
        <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
            {refreshing && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#16a34a,#4ade80,#16a34a)', zIndex: 9999 }} />}
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: text2 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <button onClick={onRefresh} style={{ padding: '8px 16px', background: card, border: `1px solid ${border}`, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: isDark ? '#f1f5f9' : '#374151' }}>
                    <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>🔄</span>
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <button onClick={() => setOpen(v => !v)} style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'grid', placeItems: 'center', border: 0, cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
                    {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{initials(user?.fullName)}</span>}
                </button>
                {open && (
                    <div style={{ position: 'absolute', top: 46, right: 0, background: card, border: `1px solid ${border}`, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', minWidth: 210, zIndex: 100, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
                        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                            {photo ? <img src={photo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{initials(user?.fullName)}</div>}
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

// ── Pages ─────────────────────────────────────────────────────────────────────
function PageDashboard({ employees, vehicles, incidents, center }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'

    const onDuty = employees.filter(e => e.dutyStatus === 'ON_DUTY').length
    const available = vehicles.filter(v => v.status === 'available').length
    const active = incidents.filter(i => i.status !== 'CLOSED').length
    const byStatus = Object.entries(incidents.reduce((a, i) => { a[i.status] = (a[i.status] || 0) + 1; return a }, {}))
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>{center?.name || 'Center Dashboard'}</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Welcome back · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <KpiCard icon="👥" color="blue" num={employees.length} label="Total Employees" sub={`${onDuty} on duty`} />
                <KpiCard icon="🚑" color="green" num={vehicles.length} label="Total Vehicles" sub={`${available} available`} />
                <KpiCard icon="⚠️" color="red" num={active} label="Active Incidents" sub="Assigned to us" />
                <KpiCard icon="✅" color="purple" num={incidents.filter(i => i.status === 'CLOSED').length} label="Closed Incidents" sub="Resolved" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: text }}>Employees On Duty</div>
                        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{onDuty} active</span>
                    </div>
                    <div style={{ padding: 20 }}>
                        {employees.filter(e => e.dutyStatus === 'ON_DUTY').length === 0
                            ? <div style={{ textAlign: 'center', color: text2, padding: '20px 0', fontSize: 13 }}>No employees on duty</div>
                            : employees.filter(e => e.dutyStatus === 'ON_DUTY').slice(0, 5).map(e => (
                                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${rc(e.role)},${rc(e.role)}99)`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(e.fullName)}</div>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: text }}>{e.fullName}</div><div style={{ fontSize: 11, color: text2 }}>{e.role}</div></div>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                                </div>
                            ))
                        }
                    </div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}` }}><div style={{ fontWeight: 600, fontSize: 15, color: text }}>Incidents by Status</div></div>
                    <div style={{ padding: 20 }}>
                        {byStatus.length === 0
                            ? <div style={{ textAlign: 'center', color: text2, padding: '20px 0', fontSize: 13 }}>No incidents</div>
                            : byStatus.map(([status, count]) => (
                                <div key={status} style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                                        <StatusPill status={status} /><span style={{ fontWeight: 600, color: text }}>{count}</span>
                                    </div>
                                    <div style={{ height: 6, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 3 }}>
                                        <div style={{ height: '100%', background: sc(status), borderRadius: 3, width: `${Math.min((count / Math.max(incidents.length, 1)) * 100, 100)}%`, transition: 'width 0.6s' }} />
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}` }}><div style={{ fontWeight: 600, fontSize: 15, color: text }}>Recent Incidents</div></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>
                        {['Code', 'Type', 'Location', 'Status', 'Priority', 'Age'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {incidents.slice(0, 5).map(inc => (
                            <tr key={inc.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: text }}>{inc.code}</td>
                                <td style={{ padding: '14px 18px' }}><TypePill type={inc.type} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 13.5, color: text }}>{inc.locationText || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><StatusPill status={inc.status} /></td>
                                <td style={{ padding: '14px 18px' }}><span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: inc.priority === 'HIGH' ? '#fee2e2' : inc.priority === 'MEDIUM' ? '#ffedd5' : '#dcfce7', color: inc.priority === 'HIGH' ? '#dc2626' : inc.priority === 'MEDIUM' ? '#ea580c' : '#16a34a' }}>{inc.priority}</span></td>
                                <td style={{ padding: '14px 18px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{timeAgo(inc.reportedAt)}</td>
                            </tr>
                        ))}
                        {incidents.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: text2 }}>No incidents assigned to your center</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function EmployeeModal({ emp, onClose, onSave }) {
    const isEdit = !!emp
    const [form, setForm] = useState({ fullName: emp?.fullName || '', email: emp?.email || '', password: '', phone: emp?.phone || '', role: emp?.role || 'DRIVER', dutyStatus: emp?.dutyStatus || 'OFF_DUTY' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const handleSave = async () => {
        if (!form.fullName || !form.email) { setError('Full Name and Email are required'); return }
        setSaving(true); setError('')
        try { if (isEdit) { await axiosClient.put(`/employees/${emp.id}`, form) } else { await axiosClient.post('/employees', form) }; onSave() }
        catch (e) { setError(e.response?.data?.message || 'Failed'); setSaving(false) }
    }
    return (
        <Modal title={isEdit ? `Edit — ${emp.fullName}` : 'Add New Employee'} onClose={onClose}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FF label="Full Name" value={form.fullName} onChange={v => set('fullName', v)} placeholder="Ahmad Khalil" required />
                <FF label="Email" value={form.email} onChange={v => set('email', v)} placeholder="ahmad@lers.lb" required />
                <FF label="Password" value={form.password} onChange={v => set('password', v)} type="password" placeholder={isEdit ? 'Leave blank to keep' : '••••••••'} />
                <FF label="Phone" value={form.phone} onChange={v => set('phone', v)} placeholder="+961-70-123456" />
            </div>
            <SelectField label="Role" value={form.role} onChange={v => set('role', v)} required options={[{ value: 'DRIVER', label: '🚗 Driver' }, { value: 'PARAMEDIC', label: '🏥 Paramedic' }, { value: 'PARAMEDIC_HELPER', label: '💊 Paramedic Helper' }, { value: 'DISPATCHER', label: '📡 Dispatcher' }]} />
            <SelectField label="Duty Status" value={form.dutyStatus} onChange={v => set('dutyStatus', v)} options={[{ value: 'OFF_DUTY', label: '⚫ Off Duty' }, { value: 'ON_DUTY', label: '🟢 On Duty' }]} />
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '9px 18px', background: '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#86efac' : '#16a34a', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? '⏳ Saving…' : isEdit ? 'Save Changes' : 'Create Employee'}</button>
            </div>
        </Modal>
    )
}

function PageEmployees({ employees, onRefresh }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [modal, setModal] = useState(null)
    const [toast, setToast] = useState({ msg: '', type: '' })
    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }
    const handleDelete = async id => {
        if (!window.confirm('Are you sure you want to delete this employee?')) return
        showToast('Deleting…', 'loading', 5000)
        try { await axiosClient.delete(`/employees/${id}`); showToast('Employee deleted!', 'success'); await onRefresh() }
        catch (e) { showToast(e.response?.data?.message || 'Failed to delete', 'error') }
    }
    const handleToggleDuty = async (id, current) => {
        const next = current === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY'
        try { await axiosClient.patch(`/employees/${id}/duty`, { dutyStatus: next }); await onRefresh() }
        catch { showToast('Failed to update duty status', 'error') }
    }
    const handleSaved = async () => { setModal(null); showToast(modal === 'create' ? '✅ Employee created!' : '✅ Employee updated!', 'success'); await onRefresh() }
    return (
        <div className="page-refresh">
            <Toast msg={toast.msg} type={toast.type} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Employees</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{employees.length} employees in your center</div></div>
                <button onClick={() => setModal('create')} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Employee</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {['DRIVER', 'PARAMEDIC', 'PARAMEDIC_HELPER', 'DISPATCHER'].map(role => (
                    <div key={role} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: rc(role) }}>{employees.filter(e => e.role === role).length}</div>
                        <div style={{ fontSize: 11, color: text2, marginTop: 4 }}>{role.replace(/_/g, ' ')}</div>
                    </div>
                ))}
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Name', 'Email', 'Phone', 'Role', 'Duty Status', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {employees.map(e => (
                            <tr key={e.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${rc(e.role)},${rc(e.role)}99)`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(e.fullName)}</div><span style={{ fontWeight: 600, fontSize: 13.5, color: text }}>{e.fullName}</span></div></td>
                                <td style={{ padding: '14px 18px', fontSize: 13, color: text2 }}>{e.email || '—'}</td>
                                <td style={{ padding: '14px 18px', fontSize: 13, fontFamily: 'monospace', color: text2 }}>{e.phone || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><span style={{ background: rb(e.role), color: rc(e.role), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{e.role?.replace(/_/g, ' ')}</span></td>
                                <td style={{ padding: '14px 18px' }}>
                                    <button onClick={() => e.dutyStatus !== 'ON_MISSION' && handleToggleDuty(e.id, e.dutyStatus)}
                                        style={{ background: e.dutyStatus === 'ON_DUTY' ? '#dcfce7' : e.dutyStatus === 'ON_MISSION' ? '#fee2e2' : isDark ? '#334155' : '#f1f5f9', color: e.dutyStatus === 'ON_DUTY' ? '#16a34a' : e.dutyStatus === 'ON_MISSION' ? '#dc2626' : text2, border: `1px solid ${e.dutyStatus === 'ON_DUTY' ? '#bbf7d0' : e.dutyStatus === 'ON_MISSION' ? '#fecaca' : border}`, padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: e.dutyStatus === 'ON_MISSION' ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                        {e.dutyStatus === 'ON_DUTY' ? '🟢 ON DUTY' : e.dutyStatus === 'ON_MISSION' ? '🚨 ON MISSION' : '⚫ OFF DUTY'}
                                    </button>
                                </td>
                                <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', gap: 6 }}><button onClick={() => setModal(e)} style={{ padding: '5px 10px', background: isDark ? '#334155' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: text }}>✏️ Edit</button><button onClick={() => handleDelete(e.id)} style={{ padding: '5px 10px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#dc2626' }}>🗑 Delete</button></div></td>
                            </tr>
                        ))}
                        {employees.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: text2 }}>No employees yet!</td></tr>}
                    </tbody>
                </table>
            </div>
            {modal !== null && <EmployeeModal emp={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSave={handleSaved} />}
        </div>
    )
}

function VehicleModal({ vehicle, onClose, onSave }) {
    const isEdit = !!vehicle
    const [form, setForm] = useState({ code: vehicle?.code || '', plate: vehicle?.plate || '', type: vehicle?.type || 'AMBULANCE', model: vehicle?.model || '', mileage: vehicle?.mileage || 0, status: vehicle?.status || 'available' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const handleSave = async () => {
        if (!form.code || !form.plate) { setError('Code and Plate are required'); return }
        setSaving(true); setError('')
        try { if (isEdit) await axiosClient.put(`/vehicles/${vehicle.id}`, { ...form, mileage: parseInt(form.mileage) || 0 }); else await axiosClient.post('/vehicles', { ...form, mileage: parseInt(form.mileage) || 0 }); onSave() }
        catch (e) { setError(e.response?.data?.message || 'Failed'); setSaving(false) }
    }
    return (
        <Modal title={isEdit ? `Edit — ${vehicle.code}` : 'Add New Vehicle'} onClose={onClose}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FF label="Code" value={form.code} onChange={v => set('code', v)} placeholder="V-101" required />
                <FF label="Plate" value={form.plate} onChange={v => set('plate', v)} placeholder="LB-1234" required />
                <FF label="Model" value={form.model} onChange={v => set('model', v)} placeholder="Toyota Land Cruiser" />
                <FF label="Mileage (km)" value={String(form.mileage)} onChange={v => set('mileage', v)} placeholder="0" />
            </div>
            <SelectField label="Type" value={form.type} onChange={v => set('type', v)} required options={[{ value: 'AMBULANCE', label: '🚑 Ambulance' }, { value: 'FIRE_TRUCK', label: '🚒 Fire Truck' }, { value: 'RESCUE_TRUCK', label: '🚐 Rescue Truck' }, { value: 'PATROL', label: '🚗 Patrol' }]} />
            <SelectField label="Status" value={form.status} onChange={v => set('status', v)} options={[{ value: 'available', label: '🟢 Available' }, { value: 'on-mission', label: '🔴 On Mission' }, { value: 'maintenance', label: '🟡 Maintenance' }]} />
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '9px 18px', background: '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#86efac' : '#16a34a', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? '⏳ Saving…' : isEdit ? 'Save Changes' : 'Add Vehicle'}</button>
            </div>
        </Modal>
    )
}

function PageVehicles({ vehicles, onRefresh }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [modal, setModal] = useState(null)
    const [toast, setToast] = useState({ msg: '', type: '' })
    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }
    const handleDelete = async id => { if (!window.confirm('Are you sure you want to delete this vehicle?')) return; showToast('Deleting…', 'loading', 5000); try { await axiosClient.delete(`/vehicles/${id}`); showToast('Vehicle deleted!', 'success'); onRefresh() } catch { showToast('Failed to delete', 'error') } }
    const handleSaved = async () => { setModal(null); showToast(modal === 'create' ? '✅ Vehicle added!' : '✅ Vehicle updated!', 'success'); onRefresh() }
    const vBg = s => s === 'available' ? '#dcfce7' : s === 'on-mission' ? '#fee2e2' : s === 'maintenance' ? '#fef3c7' : '#f1f5f9'
    const vC = s => s === 'available' ? '#16a34a' : s === 'on-mission' ? '#dc2626' : s === 'maintenance' ? '#d97706' : '#64748b'
    return (
        <div className="page-refresh">
            <Toast msg={toast.msg} type={toast.type} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Vehicles</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{vehicles.length} vehicles · {vehicles.filter(v => v.status === 'available').length} available</div></div>
                <button onClick={() => setModal('create')} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Vehicle</button>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Code', 'Plate', 'Type', 'Model', 'Status', 'Mileage', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {vehicles.map(v => (
                            <tr key={v.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: text }}>{v.code}</td>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text }}>{v.plate}</td>
                                <td style={{ padding: '14px 18px', fontSize: 13.5, color: text }}>{v.type || '—'}</td>
                                <td style={{ padding: '14px 18px', fontSize: 13, color: text2 }}>{v.model || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><span style={{ background: vBg(v.status), color: vC(v.status), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{v.status}</span></td>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text2 }}>{v.mileage || 0} km</td>
                                <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', gap: 6 }}><button onClick={() => setModal(v)} style={{ padding: '5px 10px', background: isDark ? '#334155' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: text }}>✏️ Edit</button><button onClick={() => handleDelete(v.id)} style={{ padding: '5px 10px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#dc2626' }}>🗑 Delete</button></div></td>
                            </tr>
                        ))}
                        {vehicles.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: text2 }}>No vehicles yet!</td></tr>}
                    </tbody>
                </table>
            </div>
            {modal !== null && <VehicleModal vehicle={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSave={handleSaved} />}
        </div>
    )
}

function PageIncidents({ incidents }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [tab, setTab] = useState('all')
    const TABS = ['all', 'NEW', 'DISPATCHED', 'BACKUP', 'ON_SCENE', 'CLOSED']
    const filtered = tab === 'all' ? incidents : incidents.filter(i => i.status === tab)
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Incidents</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Incidents assigned to your center</div></div>
            <div style={{ display: 'flex', gap: 4, background: card, padding: 4, border: `1px solid ${border}`, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', background: tab === t ? '#f0fdf4' : 'transparent', border: tab === t ? '1px solid #bbf7d0' : '1px solid transparent', borderRadius: 7, fontSize: 13, color: tab === t ? '#16a34a' : text2, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                        {t === 'all' ? 'All' : t}
                        <span style={{ fontSize: 11, background: tab === t ? '#16a34a' : isDark ? '#334155' : '#e4e8ef', color: tab === t ? '#fff' : text2, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{t === 'all' ? incidents.length : incidents.filter(i => i.status === t).length}</span>
                    </button>
                ))}
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Code', 'Type', 'Location', 'Priority', 'Status', 'Age'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map(inc => (
                            <tr key={inc.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: text }}>{inc.code}</td>
                                <td style={{ padding: '14px 18px' }}><TypePill type={inc.type} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 13.5, color: text }}>{inc.locationText || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: inc.priority === 'HIGH' ? '#fee2e2' : inc.priority === 'MEDIUM' ? '#ffedd5' : '#dcfce7', color: inc.priority === 'HIGH' ? '#dc2626' : inc.priority === 'MEDIUM' ? '#ea580c' : '#16a34a' }}>{inc.priority}</span></td>
                                <td style={{ padding: '14px 18px' }}><StatusPill status={inc.status} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{timeAgo(inc.reportedAt)}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: text2 }}>No incidents</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function PageMaintenance({ vehicles }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState({ vehicleId: '', serviceDate: '', description: '', mileageAtService: '', cost: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [toast, setToast] = useState({ msg: '', type: '' })
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }
    const load = () => { axiosClient.get('/maintenance/center').then(r => { setLogs(r.data); setLoading(false) }).catch(() => setLoading(false)) }
    useEffect(() => { load() }, [])
    const handleCreate = async () => {
        if (!form.vehicleId || !form.serviceDate || !form.description) { setError('Vehicle, Date, Description required'); return }
        setSaving(true); setError(''); showToast('Adding log…', 'loading', 10000)
        try { await axiosClient.post('/maintenance', form); setShowCreate(false); setForm({ vehicleId: '', serviceDate: '', description: '', mileageAtService: '', cost: '' }); showToast('✅ Maintenance log added!', 'success'); load() }
        catch (e) { setError(e.response?.data?.message || 'Failed'); showToast('Failed', 'error') }
        finally { setSaving(false) }
    }
    const handleDelete = async id => { if (!window.confirm('Delete this maintenance log?')) return; try { await axiosClient.delete(`/maintenance/${id}`); load() } catch { showToast('Failed to delete', 'error') } }
    const getVehicle = id => vehicles.find(v => v.id === id)
    return (
        <div className="page-refresh">
            <Toast msg={toast.msg} type={toast.type} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Maintenance Log</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Vehicle service history · {logs.length} records</div></div>
                <button onClick={() => { setForm({ vehicleId: vehicles[0]?.id || '', serviceDate: new Date().toISOString().split('T')[0], description: '', mileageAtService: '', cost: '' }); setError(''); setShowCreate(true) }} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Log Service</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '20px 22px' }}><div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{logs.length}</div><div style={{ fontSize: 13, color: text2, marginTop: 4 }}>Total Service Records</div></div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '20px 22px' }}><div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>{vehicles.filter(v => v.status === 'maintenance').length}</div><div style={{ fontSize: 13, color: text2, marginTop: 4 }}>Vehicles in Maintenance</div></div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '20px 22px' }}><div style={{ fontSize: 28, fontWeight: 700, color: '#ea580c' }}>${logs.reduce((sum, l) => sum + parseFloat(l.cost || 0), 0).toLocaleString()}</div><div style={{ fontSize: 13, color: text2, marginTop: 4 }}>Total Maintenance Cost</div></div>
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: 60, color: text2 }}>Loading…</div> : (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: theadBg }}>{['Vehicle', 'Date', 'Description', 'Mileage', 'Cost', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {logs.map(l => {
                                const v = getVehicle(l.vehicleId); return (
                                    <tr key={l.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                        <td style={{ padding: '14px 18px' }}><div style={{ fontWeight: 600, fontSize: 13, color: text }}>{v?.code || l.vehicleId?.toString().slice(0, 8) + '…'}</div><div style={{ fontSize: 11, color: text2 }}>{v?.plate || '—'}</div></td>
                                        <td style={{ padding: '14px 18px', fontSize: 13, fontFamily: 'monospace', color: text }}>{l.serviceDate}</td>
                                        <td style={{ padding: '14px 18px', fontSize: 13, maxWidth: 250, color: text }}>{l.description}</td>
                                        <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text2 }}>{l.mileageAtService ? l.mileageAtService.toLocaleString() + ' km' : '—'}</td>
                                        <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 600, color: l.cost ? text : text2 }}>{l.cost ? '$' + parseFloat(l.cost).toLocaleString() : '—'}</td>
                                        <td style={{ padding: '14px 18px' }}><button onClick={() => handleDelete(l.id)} style={{ padding: '5px 10px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#dc2626' }}>🗑</button></td>
                                    </tr>
                                )
                            })}
                            {logs.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: text2 }}>No maintenance records yet!</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
            {showCreate && (
                <Modal title="Log Vehicle Service" onClose={() => setShowCreate(false)}>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : '#374151', marginBottom: 6 }}>Vehicle <span style={{ color: '#dc2626' }}>*</span></label>
                        <select value={form.vehicleId} onChange={e => set('vehicleId', e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                            <option value="">— Select Vehicle —</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.code} — {v.plate} ({v.type})</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                        <FF label="Service Date" value={form.serviceDate} onChange={v => set('serviceDate', v)} type="date" required />
                        <FF label="Mileage at Service (km)" value={form.mileageAtService} onChange={v => set('mileageAtService', v)} placeholder="45000" />
                    </div>
                    <FF label="Description" value={form.description} onChange={v => set('description', v)} placeholder="Oil change, tire rotation…" required />
                    <FF label="Cost ($)" value={form.cost} onChange={v => set('cost', v)} placeholder="150.00" />
                    {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', background: '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Cancel</button>
                        <button onClick={handleCreate} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#86efac' : '#16a34a', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? '⏳ Saving…' : 'Log Service'}</button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

function PageStats({ employees, vehicles, incidents }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const closed = incidents.filter(i => i.status === 'CLOSED').length
    const total = incidents.length
    const onDuty = employees.filter(e => e.dutyStatus === 'ON_DUTY').length
    const available = vehicles.filter(v => v.status === 'available').length
    const byType = Object.entries(incidents.reduce((a, i) => { a[i.type] = (a[i.type] || 0) + 1; return a }, {})).map(([type, count]) => ({ type, count }))
    const byRole = ['DRIVER', 'PARAMEDIC', 'PARAMEDIC_HELPER', 'DISPATCHER'].map(role => ({ role: role.replace(/_/g, ' '), count: employees.filter(e => e.role === role).length, color: rc(role) }))
    const trend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, i) => ({ month: m, incidents: Math.floor(Math.random() * 8) + 2 + i }))
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Center Statistics</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Performance overview for your center</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <KpiCard icon="📋" color="blue" num={total} label="Total Incidents" sub="All time" />
                <KpiCard icon="✅" color="green" num={closed} label="Resolved" sub={`${total > 0 ? Math.round((closed / total) * 100) : 0}% rate`} />
                <KpiCard icon="👥" color="purple" num={onDuty} label="On Duty Now" sub={`of ${employees.length} total`} />
                <KpiCard icon="🚑" color="amber" num={available} label="Vehicles Available" sub={`of ${vehicles.length} total`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}` }}><div style={{ fontWeight: 600, fontSize: 15, color: text }}>Incidents Trend</div><div style={{ fontSize: 12, color: text2, marginTop: 2 }}>Last 6 months</div></div>
                    <div style={{ padding: 20 }}>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={trend}>
                                <defs><linearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient></defs>
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: text2 }} /><YAxis tick={{ fontSize: 11, fill: text2 }} />
                                <RTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${border}`, fontSize: 12, background: card, color: text }} />
                                <Area type="monotone" dataKey="incidents" stroke="#16a34a" strokeWidth={2.5} fill="url(#cgrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}` }}><div style={{ fontWeight: 600, fontSize: 15, color: text }}>Team Composition</div></div>
                    <div style={{ padding: 20 }}>
                        {byRole.map(({ role, count, color }) => (
                            <div key={role} style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                                    <span style={{ fontWeight: 500, color: text }}>{role}</span><span style={{ fontWeight: 600, color: text }}>{count}</span>
                                </div>
                                <div style={{ height: 8, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 4 }}>
                                    <div style={{ height: '100%', background: color, borderRadius: 4, width: `${employees.length > 0 ? Math.round((count / employees.length) * 100) : 0}%`, transition: 'width 0.6s' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: text }}>Incidents by Type</div>
                    {byType.length === 0 ? <div style={{ textAlign: 'center', color: text2, padding: '20px 0' }}>No incidents yet</div> : byType.map(({ type, count }) => (
                        <div key={type} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, color: text }}><span style={{ width: 10, height: 10, borderRadius: 3, background: tc(type), display: 'inline-block' }} />{type}</span>
                                <span style={{ fontWeight: 600, color: text }}>{count} <span style={{ color: text2, fontWeight: 400 }}>({total > 0 ? Math.round((count / total) * 100) : 0}%)</span></span>
                            </div>
                            <div style={{ height: 7, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 4 }}><div style={{ height: '100%', background: tc(type), borderRadius: 4, width: `${total > 0 ? Math.min((count / total) * 100, 100) : 0}%`, transition: 'width 0.6s' }} /></div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: text }}>Resolution Rate</div>
                        {total > 0 ? (<><div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}><div style={{ fontSize: 42, fontWeight: 700, color: '#16a34a', letterSpacing: '-0.03em' }}>{Math.round((closed / total) * 100)}%</div><div style={{ fontSize: 13, color: text2 }}><div>{closed} resolved</div><div>out of {total} total</div></div></div><div style={{ height: 10, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 5 }}><div style={{ height: '100%', background: 'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius: 5, width: `${Math.round((closed / total) * 100)}%`, transition: 'width 0.8s' }} /></div></>) : <div style={{ color: text2, fontSize: 13 }}>No incidents yet</div>}
                    </div>
                    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: text }}>Vehicle Status</div>
                        {[['available', '#16a34a', 'Available'], ['on-mission', '#dc2626', 'On Mission'], ['maintenance', '#d97706', 'Maintenance']].map(([s, c, l]) => (
                            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: text }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}</div>
                                <span style={{ fontWeight: 700, fontSize: 15, color: c }}>{vehicles.filter(v => v.status === s).length}</span>
                            </div>
                        ))}
                    </div>
                </div>
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
    const handlePhoto = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => { setPhoto(ev.target.result); localStorage.setItem('centerProfilePhoto', ev.target.result) }; r.readAsDataURL(file) }
    const removePhoto = () => { setPhoto(null); localStorage.removeItem('centerProfilePhoto') }
    const handleSave = async () => {
        setMsg(''); setErr('')
        if (form.newPassword && form.newPassword !== form.confirmPassword) { setErr('Passwords do not match'); return }
        try { if (form.newPassword) await axiosClient.patch('/auth/change-password', { oldPassword: form.oldPassword, newPassword: form.newPassword }); setMsg('Saved!'); setForm({ oldPassword: '', newPassword: '', confirmPassword: '' }) }
        catch (e) { setErr(e.response?.data?.message || 'Failed') }
    }
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Settings</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Account & profile settings</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Profile</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ position: 'relative' }}>
                            {photo ? <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #e4e8ef' }} /> : <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 32 }}>{initials(user?.fullName)}</div>}
                            <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%', background: '#16a34a', border: '2px solid #fff', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 12, color: '#fff' }}>✏</button>
                            {photo && <button onClick={removePhoto} style={{ position: 'absolute', top: 2, right: 2, width: 26, height: 26, borderRadius: '50%', background: '#dc2626', border: '2px solid #fff', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 11, color: '#fff' }}>✕</button>}
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: 17, color: text }}>{user?.fullName}</div>
                            <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{user?.email}</div>
                            <div style={{ marginTop: 8 }}><span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>CENTER ADMIN</span></div>
                        </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${borderSub}`, marginTop: 20, paddingTop: 20 }}>
                        <div style={{ fontSize: 12, color: text2, marginBottom: 6 }}>USER ID</div>
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
                    <button onClick={handleSave} style={{ padding: '11px 22px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Save Changes</button>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28, gridColumn: '1 / -1' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Appearance</div>
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: text2, marginBottom: 10 }}>Theme</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['system', '💻 System']].map(([val, label]) => (
                                <button key={val} onClick={() => setTheme(val)} style={{ padding: '8px 20px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: theme === val ? '2px solid #16a34a' : `2px solid ${border}`, background: theme === val ? '#f0fdf4' : isDark ? '#0f172a' : '#f8fafc', color: theme === val ? '#16a34a' : text2, transition: 'all 0.15s' }}>{label}</button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

function PageMessages() {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [sortedCitizens, setSortedCitizens] = useState([])
    const messagesEndRef = useRef(null)

    const load = useCallback(() => {
    axiosClient.get('/messages/center')
        .then(r => { 
            console.log('Messages:', r.data)
            setMessages(r.data); setLoading(false) 
        })
        .catch(() => setLoading(false))
    }, [])

    useEffect(() => { load() }, [load])

    useEffect(() => {
    const sorted = [...new Map(messages.map(m => {
        const isCenterAdmin = m.senderRole === 'CENTER_ADMIN'
        const personId = isCenterAdmin ? m.receiverId : m.senderId
        const personRole = isCenterAdmin ? (messages.find(msg => msg.senderId === m.receiverId)?.senderRole || 'CITIZEN') : m.senderRole
        return [personId, {
            citizenId: personId,
            personRole,
            senderName: messages.filter(msg => msg.senderId === personId && msg.senderName).pop()?.senderName,
            lastMessage: m.content,
            lastTime: m.createdAt,
            unread: messages.filter(msg => (msg.senderId === personId || msg.receiverId === personId) && !msg.read && msg.senderRole !== 'CENTER_ADMIN').length
        }]
    })).values()].sort((a, b) => b.unread - a.unread)
    setSortedCitizens(prev => {
    if (prev.length === 0) return sorted
    return prev.map(p => {
        const updated = sorted.find(s => s.citizenId === p.citizenId)
        return updated || p
    }).sort((a, b) => {
        if (a.citizenId === selected) return 0
        if (b.citizenId === selected) return 0
        if (b.unread !== a.unread) return b.unread - a.unread
        return new Date(b.lastTime) - new Date(a.lastTime)
    })
    })
    }, [messages])

    useEffect(() => { const i = setInterval(load, 8000); return () => clearInterval(i) }, [load])

    useEffect(() => {
    if (selected) {
        messages
            .filter(m => (m.senderId === selected || m.receiverId === selected) && !m.isRead && m.senderRole !== 'CENTER_ADMIN')
            .forEach(m => axiosClient.patch(`/messages/${m.id}/read`).catch(() => {}))
        setTimeout(() => load(), 500)
    }
    }, [selected])

    useEffect(() => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }, [selected, messages])

    const sendReply = async () => {
        if (!reply.trim() || !selected) return
        setSending(true)
        try {
            const centerMsg = messages.find(m => m.senderId === selected || m.receiverId === selected)
            await axiosClient.post('/messages', {
                centerId: centerMsg?.centerId,
                content: reply,
                receiverId: selected
            })
            setReply('')
            load()
        } catch (_) {}
        finally { setSending(false) }
    }

    const deleteConversation = async (citizenId) => {
        if (!window.confirm('Delete this conversation?')) return
        try {
            await axiosClient.delete(`/messages/conversation/${citizenId}`)
            if (selected === citizenId) setSelected(null)
            load()
        } catch (_) {}
    }

    const citizens = [...new Map(messages.map(m => {
    const isFromEmployee = ['DRIVER', 'PARAMEDIC', 'PARAMEDIC_HELPER'].includes(m.senderRole)
    const isCenterAdmin = m.senderRole === 'CENTER_ADMIN'
    const personId = isCenterAdmin ? m.receiverId : m.senderId
    const personRole = isCenterAdmin ? (messages.find(msg => msg.senderId === m.receiverId)?.senderRole || 'CITIZEN') : m.senderRole
    return [personId, {
        citizenId: personId,
        personRole,
        senderName: messages.filter(msg => msg.senderId === personId && msg.senderName).pop()?.senderName || m.senderName,
        lastMessage: m.content,
        lastTime: m.createdAt,
        unread: messages.filter(msg => (msg.senderId === personId || msg.receiverId === personId) && !msg.read && msg.senderRole !== 'CENTER_ADMIN').length
    }]
    })).values()].sort((a, b) => {
    if (a.citizenId === selected || b.citizenId === selected) return 0
    return b.unread - a.unread
    })

    const conv = selected
        ? messages.filter(m => m.senderId === selected || m.receiverId === selected)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        : []

    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Messages</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Citizen conversations</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, height: 600 }}>
                {/* Citizens list */}
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${borderSub}`, fontWeight: 600, fontSize: 14, color: text }}>
                        Conversations ({sortedCitizens.length})
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? <div style={{ padding: 20, textAlign: 'center', color: text2 }}>Loading…</div>
                        : sortedCitizens.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: text2 }}>No messages yet</div>
                        : sortedCitizens.map(c => (
                            <div key={c.citizenId}
                                style={{ padding: '14px 16px', borderBottom: `1px solid ${borderSub}`, cursor: 'pointer', background: selected === c.citizenId ? (isDark ? '#1e3a5f' : '#eff6ff') : 'transparent', display: 'flex', alignItems: 'center', gap: 10 }}
                                onClick={() => setSelected(c.citizenId)}>
                                <div style={{ width: 38, height: 38, borderRadius: '50%', background: c.personRole === 'CITIZEN' ? 'linear-gradient(135deg,#dc2626,#7f1d1d)' : 'linear-gradient(135deg,#2563eb,#1e40af)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                                    {c.personRole === 'CITIZEN' ? 'C' : 'E'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: text }}>
                                        {c.personRole === 'CITIZEN' ? 'Citizen' : (c.senderName || c.personRole.replace(/_/g, ' '))}
                                    </div>
                                    <div style={{ fontSize: 12, color: text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lastMessage}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                    {c.unread > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 6px' }}>{c.unread}</span>}
                                    <button onClick={e => { e.stopPropagation(); deleteConversation(c.citizenId) }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14, padding: 2 }}>🗑</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Conversation */}
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {!selected ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text2 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                                <div>Select a conversation</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${borderSub}`, fontWeight: 600, color: text, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Conversation</span>
                                <span style={{ fontSize: 11, color: text2 }}>Auto-refreshing every 8s</span>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                                {conv.map((msg, i) => {
                                    const isAdmin = msg.senderRole === 'CENTER_ADMIN'
                                    const isLast = i === conv.length - 1
                                    return (
                                        <div key={msg.id} style={{ marginBottom: 12, display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start' }}>
                                            <div>
                                                <div style={{ maxWidth: 300, background: isAdmin ? '#16a34a' : (isDark ? '#334155' : '#f1f5f9'), color: isAdmin ? '#fff' : text, padding: '10px 14px', borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 14 }}>
                                                    {msg.content}
                                                </div>
                                                <div style={{ fontSize: 10, color: text2, marginTop: 3, textAlign: isAdmin ? 'right' : 'left', display: 'flex', gap: 4, justifyContent: isAdmin ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
                                                    <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                    {isAdmin && <span style={{ color: msg.isRead ? '#2563eb' : text2 }}>{msg.isRead ? '✓✓ Seen' : '✓ Delivered'}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                            <div style={{ padding: '12px 16px', borderTop: `1px solid ${borderSub}`, display: 'flex', gap: 8 }}>
                                <input value={reply} onChange={e => setReply(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendReply()}
                                    placeholder="Type a reply…"
                                    style={{ flex: 1, padding: '10px 14px', border: `1px solid ${border}`, borderRadius: 24, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: isDark ? '#0f172a' : '#f8fafc', color: text }} />
                                <button onClick={sendReply} disabled={sending || !reply.trim()}
                                    style={{ padding: '10px 18px', background: sending ? '#86efac' : '#16a34a', color: '#fff', border: 0, borderRadius: 24, fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                    {sending ? '…' : 'Send'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}



export default function CenterDashboard() {
    const [page, setPage] = useState('dashboard')
    const [employees, setEmployees] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [incidents, setIncidents] = useState([])
    const [center, setCenter] = useState(null)
    const [photo, setPhoto] = useState(() => localStorage.getItem('centerProfilePhoto') || null)
    const [unreadCount, setUnreadCount] = useState(0)

useEffect(() => {
    const loadUnread = () => {
        axiosClient.get('/messages/center')
            .then(r => {
                const count = r.data.filter(m => !m.read && m.senderRole !== 'CENTER_ADMIN').length
                setUnreadCount(count)
            }).catch(() => {})
    }
    loadUnread()
    const interval = setInterval(loadUnread, 8000)
    return () => clearInterval(interval)
}, [])

    const [refreshing, setRefreshing] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const { theme } = useSettingsStore()
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    const loadData = useCallback(async () => {
        setRefreshing(true)
        try {
            const [e, v, i] = await Promise.all([axiosClient.get('/employees'), axiosClient.get('/vehicles'), axiosClient.get('/incidents')])
            setEmployees(e.data); setVehicles(v.data); setIncidents(i.data)
            if (user?.centerId) { axiosClient.get(`/centers/${user.centerId}`).then(r => setCenter(r.data)).catch(() => { }) }
        } catch (e) { console.error(e) }
        finally { setTimeout(() => setRefreshing(false), 600) }
    }, [user])

    useEffect(() => { loadData() }, [loadData])

    const handleLogout = () => {
        if (!window.confirm('Are you sure you want to logout?')) return
        setLoggingOut(true)
        setTimeout(() => { logout(); navigate('/login') }, 2000)
    }

    const renderPage = () => {
        switch (page) {
            case 'dashboard': return <PageDashboard employees={employees} vehicles={vehicles} incidents={incidents} center={center} />
            case 'employees': return <PageEmployees employees={employees} onRefresh={loadData} />
            case 'vehicles': return <PageVehicles vehicles={vehicles} onRefresh={loadData} />
            case 'incidents': return <PageIncidents incidents={incidents} />
            case 'maintenance': return <PageMaintenance vehicles={vehicles} />
            case 'stats': return <PageStats employees={employees} vehicles={vehicles} incidents={incidents} />
            case 'messages': return <PageMessages />
            case 'settings': return <PageSettings user={user} photo={photo} setPhoto={setPhoto} />
            default: return <PageDashboard employees={employees} vehicles={vehicles} incidents={incidents} center={center} />
        }
    }

    return (
        <div data-theme={isDark ? 'dark' : 'light'} style={{ display: 'flex', minHeight: '100vh', background: isDark ? '#0f172a' : '#f3f5f9', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 14 }}>
            {loggingOut && <LogoutPopup />}
            <Sidebar active={page} setActive={setPage} user={user} onLogout={handleLogout} photo={photo} centerName={center?.name} unreadCount={unreadCount} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <TopBar user={user} onRefresh={loadData} onProfile={() => setPage('settings')} photo={photo} refreshing={refreshing} onLogout={handleLogout} />
                <div style={{ padding: '24px 28px 64px', flex: 1 }}>
                    {renderPage()}
                </div>
            </div>
        </div>
    )
}