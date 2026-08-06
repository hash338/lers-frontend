import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import axiosClient from '../../api/axiosClient'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import useSettingsStore from '../../store/settingsStore'
import PageHospitals from './PageHospitals'

if (!document.getElementById('lers-styles')) {
    const s = document.createElement('style')
    s.id = 'lers-styles'
    s.textContent = `
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeInScale { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
    @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
    .page-refresh { animation: fadeIn 0.3s ease; }
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
function useDark() {
    const { theme } = useSettingsStore()
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
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
function KpiCard({ icon, color, num, label, sub }) {
    const isDark = useDark()
    const C = { red: { bg: '#fee2e2', text: '#dc2626' }, blue: { bg: '#dbeafe', text: '#2563eb' }, green: { bg: '#dcfce7', text: '#16a34a' }, orange: { bg: '#ffedd5', text: '#ea580c' }, purple: { bg: '#ede9fe', text: '#7c3aed' }, amber: { bg: '#fef3c7', text: '#d97706' } }
    const c = C[color] || C.blue
    return (
        <div style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e4e8ef'}`, borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 14, alignItems: 'center', transition: 'box-shadow 0.2s', cursor: 'default' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bg, color: c.text, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1 }}>
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
function PriBadge({ p }) {
    const bg = p === 'HIGH' ? '#fee2e2' : p === 'MEDIUM' ? '#ffedd5' : '#dcfce7'
    const co = p === 'HIGH' ? '#dc2626' : p === 'MEDIUM' ? '#ea580c' : '#16a34a'
    return <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: bg, color: co }}>{p}</span>
}
function Modal({ title, onClose, children, wide }) {
    const isDark = useDark()
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: 20, backdropFilter: 'blur(3px)' }} onClick={onClose}>
            <div style={{ background: isDark ? '#1e293b' : '#fff', borderRadius: 18, width: '100%', maxWidth: wide ? 700 : 480, padding: 30, boxShadow: '0 25px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
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
    return <div style={{ position: 'fixed', top: 20, right: 20, background: bg, color: co, border: `1px solid ${co}30`, borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 500, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', animation: 'fadeIn 0.2s ease' }}>{icon} {msg}</div>
}
function FF({ label, value, onChange, type = 'text', placeholder, required }) {
    const isDark = useDark()
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : '#374151', marginBottom: 6 }}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#e4e8ef'}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}
                onFocus={e => e.target.style.border = '1px solid #2563eb'}
                onBlur={e => e.target.style.border = `1px solid ${isDark ? '#334155' : '#e4e8ef'}`}
            />
        </div>
    )
}
function MapClicker({ onPick }) {
    useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng) } })
    return null
}
const PIN_ICON = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;background:#2563eb;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
function CenterForm({ form, set, onSave, onCancel, saving, label, error }) {
    const isDark = useDark()
    const border = isDark ? '#334155' : '#e4e8ef'
    return (
        <>
            <div style={{ height: 180, borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}`, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', padding: '4px 8px', background: isDark ? '#0f172a' : '#f3f5f9', borderBottom: `1px solid ${border}` }}>Click the map to set location</div>
                <MapContainer center={[33.8547, 35.8623]} zoom={7} style={{ height: 'calc(100% - 24px)', width: '100%' }} zoomControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='' />
                    <MapClicker onPick={(lat, lng) => { set('latitude', lat.toFixed(6)); set('longitude', lng.toFixed(6)) }} />
                    {form.latitude && form.longitude && <Marker position={[parseFloat(form.latitude), parseFloat(form.longitude)]} icon={PIN_ICON} />}
                </MapContainer>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FF label="Code" value={form.code} onChange={v => set('code', v)} placeholder="C-04" required />
                <FF label="Name" value={form.name} onChange={v => set('name', v)} placeholder="Rescue Center" required />
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : '#374151', marginBottom: 6 }}>Type <span style={{ color: '#dc2626' }}>*</span></label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                        <option>EMS</option><option>FIRE</option><option>RESCUE</option><option>MULTI</option>
                    </select>
                </div>
                <FF label="Region" value={form.region} onChange={v => set('region', v)} placeholder="Beirut" />
                <FF label="Latitude" value={form.latitude} onChange={v => set('latitude', v)} placeholder="33.8938" required />
                <FF label="Longitude" value={form.longitude} onChange={v => set('longitude', v)} placeholder="35.5018" required />
                <FF label="Phone" value={form.phone} onChange={v => set('phone', v)} placeholder="+961-1-123456" />
                <FF label="Address" value={form.address} onChange={v => set('address', v)} placeholder="Hamra Street" />
            </div>
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={onCancel} style={{ padding: '9px 18px', background: isDark ? '#334155' : '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: isDark ? '#f1f5f9' : '#374151' }}>Cancel</button>
                <button onClick={onSave} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? '⏳ Saving…' : label}</button>
            </div>
        </>
    )
}
function Sidebar({ active, setActive, user, onLogout, photo }) {
    const [open, setOpen] = useState(false)
    const NAV = [
        { id: 'dashboard', icon: '⊞', label: 'Dashboard' }, { id: 'incidents', icon: '⚠', label: 'Incidents' },
        { id: 'map', icon: '🗺', label: 'National Map' }, { id: 'centers', icon: '🏢', label: 'Centers' }, { id: 'hospitals', icon: '🏥', label: 'Hospitals' },
        { id: 'admins', icon: '👤', label: 'Center Admins' }, { id: 'vehicles', icon: '🚑', label: 'Vehicles' },
        { id: 'employees', icon: '👥', label: 'Employees' }, { id: 'feedback', icon: '💬', label: 'Feedback' },
        { id: 'analytics', icon: '📊', label: 'Analytics' }, { id: 'settings', icon: '⚙', label: 'Settings' },
    ]
    return (
        <div style={{ width: 240, background: '#0d1a33', color: '#8b96ad', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, padding: '20px 14px', gap: 4, flexShrink: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 24px' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2563eb', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>+</div>
                <div><div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>LERS</div><div style={{ fontSize: 9, color: '#8b96ad', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>SUPER ADMIN</div></div>
            </div>
            {NAV.map(n => (
                <button key={n.id} onClick={() => setActive(n.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13.5, color: active === n.id ? '#fff' : '#8b96ad', background: active === n.id ? '#1d4ed8' : 'transparent', border: 0, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: active === n.id ? 600 : 400 }}>
                    <span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}
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
                    {photo ? <img src={photo} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #ffffff20' }} /> : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(user?.fullName)}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName}</div><div style={{ fontSize: 11, color: '#8b96ad' }}>{user?.email}</div></div>
                    <span style={{ color: '#8b96ad', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
                </button>
            </div>
        </div>
    )
}
function TopBar({ user, onRefresh, onProfile, photo, searchQ, onSearch, refreshing, onLogout }) {
    const [open, setOpen] = useState(false)
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    return (
        <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
            {refreshing && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#2563eb,#7c3aed,#2563eb)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s linear infinite', zIndex: 9999 }} />}
            <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }}>🔍</span>
                <input value={searchQ} onChange={e => onSearch(e.target.value)} placeholder="Search incidents, centers, vehicles…"
                    style={{ width: '100%', padding: '8px 32px 8px 36px', border: `1px solid ${border}`, background: isDark ? '#0f172a' : '#f8fafc', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', color: isDark ? '#f1f5f9' : '#0f172a' }}
                    onFocus={e => e.target.style.border = '1px solid #2563eb'}
                    onBlur={e => e.target.style.border = `1px solid ${border}`}
                />
                {searchQ && <button onClick={() => onSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1 }}>×</button>}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <button onClick={onRefresh} style={{ padding: '8px 16px', background: card, border: `1px solid ${border}`, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: isDark ? '#f1f5f9' : '#374151' }}>
                    <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none', fontSize: 14 }}>🔄</span>
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <button onClick={() => setOpen(v => !v)} style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'grid', placeItems: 'center', border: 0, cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
                    {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{initials(user?.fullName)}</span>}
                </button>
                {open && (
                    <div style={{ position: 'absolute', top: 46, right: 0, background: card, border: `1px solid ${border}`, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', minWidth: 210, zIndex: 100, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
                        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                            {photo ? <img src={photo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{initials(user?.fullName)}</div>}
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
function AiSummaryCard({ stats, incidents }) {
    const [summary, setSummary] = useState('')
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const load = async () => {
        setLoading(true)
        try {
            const activeIncidents = incidents.filter(i => !['CLOSED'].includes(i.status)).map(i => ({ type: i.type, location: i.locationText, status: i.status, priority: i.priority }))
            const res = await axiosClient.post('/ai/national-summary', { totalIncidents: stats?.totalIncidents || 0, activeIncidents: stats?.activeIncidents || 0, closedIncidents: stats?.closedIncidents || 0, totalCenters: stats?.totalCenters || 0, backupTriggered: stats?.backupTriggered || 0, activeDetails: activeIncidents.slice(0, 10) })
            setSummary(res.data.summary); setLoaded(true)
        } catch { setSummary('System operational. All centers on standby.'); setLoaded(true) }
        finally { setLoading(false) }
    }
    useEffect(() => { if (stats) load() }, [stats])
    return (
        <div style={{ background: 'linear-gradient(135deg,#1e40af 0%,#4f46e5 50%,#7c3aed 100%)', borderRadius: 14, padding: 24, color: '#fff', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ffffff20', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 22 }}>✨</div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', opacity: 0.7 }}>AI SUMMARY · LERS SYSTEM</div>
                    {loaded && !loading && <button onClick={load} style={{ marginLeft: 'auto', background: '#ffffff20', border: 0, borderRadius: 6, padding: '3px 10px', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>↺ Refresh</button>}
                </div>
                {loading ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: 0.8 }}><span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⚙️</span>Analyzing national situation…</div>
                    : <div style={{ fontSize: 15, lineHeight: 1.7 }}>{summary}</div>}
            </div>
        </div>
    )
}
function PageDashboard({ stats, incidents, centers }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const trend = [12, 18, 24, 16, 20, 22, 28, 32, 26, 30, 34, 29, 36, 40].map((v, i) => ({ day: i + 1, count: v }))
    const byType = Object.entries(incidents.reduce((a, i) => { a[i.type] = (a[i.type] || 0) + 1; return a }, {})).map(([type, count]) => ({ type, count }))
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: text }}>Dashboard</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>National overview · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <KpiCard icon="🚨" color="red" num={stats?.activeIncidents || 0} label="Active Incidents" sub="Live now" />
                <KpiCard icon="📋" color="blue" num={stats?.totalIncidents || 0} label="Total Incidents" sub="All time" />
                <KpiCard icon="🏢" color="orange" num={stats?.totalCenters || 0} label="Centers" sub="Nationwide" />
                <KpiCard icon="🚑" color="green" num={stats?.totalVehicles || 0} label="Vehicles" sub="Fleet total" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: text }}>Incidents Over Time</div>
                        <span style={{ fontSize: 11, color: '#94a3b8', background: isDark ? '#0f172a' : '#f8fafc', padding: '3px 10px', borderRadius: 20, border: `1px solid ${border}` }}>Last 14 days</span>
                    </div>
                    <div style={{ padding: 20 }}>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={trend}>
                                <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                                <XAxis dataKey="day" hide /><YAxis hide />
                                <RTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${border}`, fontSize: 12, background: card, color: text }} />
                                <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} fill="url(#grad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}` }}><div style={{ fontWeight: 600, fontSize: 15, color: text }}>By Type</div></div>
                    <div style={{ padding: 20 }}>
                        {byType.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No data yet</div>
                            : byType.map(({ type, count }) => (
                                <div key={type} style={{ marginBottom: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                                        <span style={{ fontWeight: 500, color: text }}>{type}</span>
                                        <span style={{ color: text2, fontWeight: 600 }}>{count}</span>
                                    </div>
                                    <div style={{ height: 7, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 4 }}>
                                        <div style={{ height: '100%', background: tc(type), borderRadius: 4, width: `${Math.min((count / (stats?.totalIncidents || 1)) * 100, 100)}%`, transition: 'width 0.6s ease' }} />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: text }}>Recent Incidents</div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Latest 6</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Code', 'Type', 'Location', 'Status', 'Priority', 'Age'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {incidents.slice(0, 6).map(inc => (
                            <tr key={inc.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text, fontWeight: 600 }}>{inc.code}</td>
                                <td style={{ padding: '14px 18px' }}><TypePill type={inc.type} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 13.5, color: text }}>{inc.locationText || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><StatusPill status={inc.status} /></td>
                                <td style={{ padding: '14px 18px' }}><PriBadge p={inc.priority} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{timeAgo(inc.reportedAt)}</td>
                            </tr>
                        ))}
                        {incidents.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No incidents yet</td></tr>}
                    </tbody>
                </table>
            </div>
            <AiSummaryCard stats={stats} incidents={incidents} />
        </div>
    )
}
function PageIncidents({ incidents, searchQ }) {
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
    const q = (searchQ || '').toLowerCase()
    const searched = q ? incidents.filter(i => i.code?.toLowerCase().includes(q) || i.type?.toLowerCase().includes(q) || i.locationText?.toLowerCase().includes(q) || i.status?.toLowerCase().includes(q) || i.priority?.toLowerCase().includes(q)) : incidents
    const filtered = tab === 'all' ? searched : searched.filter(i => i.status === tab)
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Incidents</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>All incidents · Live feed {q && <span style={{ background: '#dbeafe', color: '#2563eb', padding: '2px 10px', borderRadius: 6, marginLeft: 8, fontSize: 12 }}>"{searchQ}" — {searched.length} results</span>}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: card, padding: 4, border: `1px solid ${border}`, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', background: tab === t ? '#eff6ff' : 'transparent', border: tab === t ? '1px solid #bfdbfe' : '1px solid transparent', borderRadius: 7, fontSize: 13, color: tab === t ? '#2563eb' : text2, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                        {t === 'all' ? 'All' : t}
                        <span style={{ fontSize: 11, background: tab === t ? '#2563eb' : isDark ? '#334155' : '#e4e8ef', color: tab === t ? '#fff' : text2, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{t === 'all' ? searched.length : searched.filter(i => i.status === t).length}</span>
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
                                <td style={{ padding: '14px 18px' }}><PriBadge p={inc.priority} /></td>
                                <td style={{ padding: '14px 18px' }}><StatusPill status={inc.status} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{timeAgo(inc.reportedAt)}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{q ? `No results for "${searchQ}"` : 'No incidents'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
function PageMap({ centers }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const [sel, setSel] = useState(null)
    const CC = t => t === 'FIRE' ? '#dc2626' : t === 'RESCUE' ? '#7c3aed' : '#16a34a'
    const center = centers.find(c => c.id === sel)
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>National Map</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Click a center pin to see details</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${border}`, height: 500 }}>
                    <MapContainer center={[33.8547, 35.8623]} zoom={8} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />
                        {centers.map(c => (
                            <CircleMarker key={c.id} center={[parseFloat(c.latitude), parseFloat(c.longitude)]} radius={sel === c.id ? 14 : 10} fillColor={CC(c.type)} color={sel === c.id ? '#fff' : '#ffffff80'} weight={sel === c.id ? 3 : 2} fillOpacity={0.9} eventHandlers={{ click: () => setSel(c.id) }}>
                                <Tooltip permanent={sel === c.id} direction="top">{c.name}</Tooltip>
                            </CircleMarker>
                        ))}
                    </MapContainer>
                </div>
                <div>
                    {center ? (
                        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
                            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: text }}>{center.name}</div>
                                <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{center.status}</span>
                            </div>
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 16px', fontSize: 13 }}>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Code</span><span style={{ fontFamily: 'monospace', fontWeight: 700, color: text }}>{center.code}</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Type</span><span><TypePill type={center.type} /></span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Region</span><span style={{ color: text }}>{center.region || '—'}</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Address</span><span style={{ color: text }}>{center.address || '—'}</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Phone</span><span style={{ fontFamily: 'monospace', color: text }}>{center.phone || '—'}</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Lat</span><span style={{ fontFamily: 'monospace', color: text }}>{center.latitude}</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Lng</span><span style={{ fontFamily: 'monospace', color: text }}>{center.longitude}</span>
                                </div>
                                <button onClick={() => setSel(null)} style={{ marginTop: 18, padding: '9px 14px', background: isDark ? '#334155' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', width: '100%', fontWeight: 500, color: text }}>Close</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 12, padding: 24 }}>
                            <div style={{ fontSize: 48 }}>📍</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: text2 }}>Click a center on the map</div>
                            <div style={{ fontSize: 12 }}>to see its details here</div>
                            <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 12 }}>{[['#16a34a', 'EMS'], ['#dc2626', 'FIRE'], ['#7c3aed', 'RESCUE']].map(([bg, l]) => <span key={l}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: bg, marginRight: 5 }} />{l}</span>)}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
function PageCenters({ centers, onRefresh, searchQ }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [showCreate, setShowCreate] = useState(false)
    const [editC, setEditC] = useState(null)
    const [form, setForm] = useState({ code: '', name: '', type: 'EMS', region: '', address: '', phone: '', latitude: '', longitude: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [toast, setToast] = useState({ msg: '', type: '' })
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }
    const q = (searchQ || '').toLowerCase()
    const shown = q ? centers.filter(c => c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) || c.region?.toLowerCase().includes(q) || c.type?.toLowerCase().includes(q)) : centers
    const openCreate = () => { setForm({ code: '', name: '', type: 'EMS', region: '', address: '', phone: '', latitude: '', longitude: '' }); setError(''); setShowCreate(true) }
    const openEdit = c => { setEditC(c); setForm({ code: c.code, name: c.name, type: c.type, region: c.region || '', address: c.address || '', phone: c.phone || '', latitude: String(c.latitude), longitude: String(c.longitude) }); setError('') }
    const handleCreate = async () => {
        if (!form.code || !form.name || !form.latitude || !form.longitude) { setError('Code, Name, Lat, Lng required'); return }
        setSaving(true); setError(''); showToast('Creating center…', 'loading', 10000)
        try { await axiosClient.post('/centers', { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude) }); setShowCreate(false); showToast('✅ Center created successfully!', 'success'); onRefresh() }
        catch (e) { setError(e.response?.data?.message || 'Failed'); showToast('Failed to create center', 'error') }
        finally { setSaving(false) }
    }
    const handleEdit = async () => {
        setSaving(true); setError('')
        try { await axiosClient.put(`/centers/${editC.id}`, { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude) }); setEditC(null); showToast('Center updated!', 'success'); onRefresh() }
        catch (e) { setError(e.response?.data?.message || 'Failed') }
        finally { setSaving(false) }
    }
    const handleDelete = async id => {
        if (!window.confirm('Are you sure you want to delete this center?')) return
        showToast('Deleting…', 'loading', 5000)
        try { await axiosClient.delete(`/centers/${id}`); showToast('Center deleted!', 'success'); onRefresh() }
        catch { showToast('Failed to delete — center may have linked data', 'error') }
    }
    return (
        <div className="page-refresh">
            <Toast msg={toast.msg} type={toast.type} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Centers</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{q ? <span>{shown.length} of {centers.length} centers</span> : <span>{centers.length} centers registered</span>}</div></div>
                <button onClick={openCreate} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Create Center</button>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Code', 'Name', 'Type', 'Region', 'Phone', 'Status', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {shown.map(c => (
                            <tr key={c.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: text }}>{c.code}</td>
                                <td style={{ padding: '14px 18px', fontSize: 13.5, fontWeight: 600, color: text }}>{c.name}</td>
                                <td style={{ padding: '14px 18px' }}><TypePill type={c.type} /></td>
                                <td style={{ padding: '14px 18px', fontSize: 13, color: text2 }}>{c.region || '—'}</td>
                                <td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text2 }}>{c.phone || '—'}</td>
                                <td style={{ padding: '14px 18px' }}><span style={{ background: c.status === 'active' ? '#dcfce7' : '#fee2e2', color: c.status === 'active' ? '#16a34a' : '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{c.status}</span></td>
                                <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', gap: 6 }}><button onClick={() => openEdit(c)} style={{ padding: '6px 12px', background: isDark ? '#334155' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: text }}>✏️ Edit</button><button onClick={() => handleDelete(c.id)} style={{ padding: '6px 12px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#dc2626', fontWeight: 500 }}>🗑 Delete</button></div></td>
                            </tr>
                        ))}
                        {shown.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{q ? `No centers match "${searchQ}"` : 'No centers'}</td></tr>}
                    </tbody>
                </table>
            </div>
            {showCreate && <Modal title="Create New Center" onClose={() => setShowCreate(false)} wide><CenterForm form={form} set={set} onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} label="Create Center" error={error} /></Modal>}
            {editC && <Modal title={`Edit — ${editC.name}`} onClose={() => setEditC(null)} wide><CenterForm form={form} set={set} onSave={handleEdit} onCancel={() => setEditC(null)} saving={saving} label="Save Changes" error={error} /></Modal>}
        </div>
    )
}
function PageAdmins({ searchQ }) {
    const isDark = useDark()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [users, setUsers] = useState([])
    const [centers, setCenters] = useState([])
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState({ fullName: '', email: '', password: 'lers2024', centerId: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [toast, setToast] = useState({ msg: '', type: '' })
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }
    const load = () => { axiosClient.get('/auth/users').then(r => setUsers(r.data)); axiosClient.get('/centers').then(r => setCenters(r.data)) }
    useEffect(() => { load() }, [])
    const admins = users.filter(u => u.role === 'CENTER_ADMIN')
    const q = (searchQ || '').toLowerCase()
    const shown = q ? admins.filter(u => u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)) : admins
    const handleCreate = async () => {
        if (!form.fullName || !form.email || !form.centerId) { setError('All fields required'); return }
        setSaving(true); setError(''); showToast('Adding admin…', 'loading', 10000)
        try { await axiosClient.post('/auth/register/staff', { fullName: form.fullName, email: form.email, password: form.password, role: 'CENTER_ADMIN', centerId: form.centerId }); setShowCreate(false); setForm({ fullName: '', email: '', password: 'lers2024', centerId: '' }); showToast('✅ Admin added successfully!', 'success'); load() }
        catch (e) { setError(e.response?.data?.message || 'Failed'); showToast('Failed to add admin', 'error') }
        finally { setSaving(false) }
    }
    const handleDelete = async id => {
        if (!window.confirm('Are you sure you want to delete this admin?')) return
        showToast('Deleting…', 'loading', 5000)
        try { await axiosClient.delete(`/auth/users/${id}`); showToast('Admin deleted!', 'success'); load() }
        catch { load(); showToast('Done!', 'success') }
    }
    return (
        <div className="page-refresh">
            <Toast msg={toast.msg} type={toast.type} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Center Admins</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{q ? `${shown.length} of ${admins.length}` : admins.length} administrators registered</div></div>
                <button onClick={() => { setForm({ fullName: '', email: '', password: 'lers2024', centerId: '' }); setError(''); setShowCreate(true) }} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Admin</button>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: theadBg }}>{['Name', 'Email', 'Center', 'Status', 'Created', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {shown.map(u => {
                            const c = centers.find(c => c.id === u.centerId); return (
                                <tr key={u.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                    <td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(u.fullName)}</div><span style={{ fontWeight: 600, fontSize: 13.5, color: text }}>{u.fullName}</span></div></td>
                                    <td style={{ padding: '14px 18px', fontSize: 13, color: text2 }}>{u.email || '—'}</td>
                                    <td style={{ padding: '14px 18px', fontSize: 13, color: text }}>{c?.name || '—'}</td>
                                    <td style={{ padding: '14px 18px' }}><span style={{ background: u.status === 'active' ? '#dcfce7' : '#fee2e2', color: u.status === 'active' ? '#16a34a' : '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{u.status}</span></td>
                                    <td style={{ padding: '14px 18px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                                    <td style={{ padding: '14px 18px' }}><button onClick={() => handleDelete(u.id)} style={{ padding: '6px 12px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#dc2626', fontWeight: 500 }}>🗑 Delete</button></td>
                                </tr>
                            )
                        })}
                        {shown.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{q ? `No admins match "${searchQ}"` : 'No center admins found'}</td></tr>}
                    </tbody>
                </table>
            </div>
            {showCreate && (
                <Modal title="Add Center Admin" onClose={() => setShowCreate(false)}>
                    <FF label="Full Name" value={form.fullName} onChange={v => set('fullName', v)} placeholder="Ahmad Khalil" required />
                    <FF label="Email" value={form.email} onChange={v => set('email', v)} placeholder="admin@lers.lb" required />
                    <FF label="Password" value={form.password} onChange={v => set('password', v)} type="password" />
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : '#374151', marginBottom: 6 }}>Center <span style={{ color: '#dc2626' }}>*</span></label>
                        <select value={form.centerId} onChange={e => set('centerId', e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}><option value="">— Select Center —</option>{centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    </div>
                    {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', background: isDark ? '#334155' : '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: isDark ? '#f1f5f9' : '#374151' }}>Cancel</button>
                        <button onClick={handleCreate} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? '⏳ Adding…' : 'Create Admin'}</button>
                    </div>
                </Modal>
            )}
        </div>
    )
}
function PageVehicles({ searchQ }) {
    const isDark = useDark(); const card = isDark ? '#1e293b' : '#fff'; const border = isDark ? '#334155' : '#e4e8ef'; const borderSub = isDark ? '#1e293b' : '#f1f5f9'; const text = isDark ? '#f1f5f9' : '#0f172a'; const text2 = isDark ? '#94a3b8' : '#64748b'; const rowBorder = isDark ? '#1e293b' : '#f8fafc'; const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [vehicles, setVehicles] = useState([]); const [loading, setLoading] = useState(true)
    useEffect(() => { axiosClient.get('/vehicles/all').then(r => { setVehicles(r.data); setLoading(false) }).catch(() => setLoading(false)) }, [])
    const q = (searchQ || '').toLowerCase()
    const shown = q ? vehicles.filter(v => v.code?.toLowerCase().includes(q) || v.plate?.toLowerCase().includes(q) || v.type?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q) || v.status?.toLowerCase().includes(q)) : vehicles
    const vBg = s => s === 'available' ? '#dcfce7' : s === 'on-mission' ? '#fee2e2' : s === 'maintenance' ? '#fef3c7' : '#f1f5f9'
    const vC = s => s === 'available' ? '#16a34a' : s === 'on-mission' ? '#dc2626' : s === 'maintenance' ? '#d97706' : '#64748b'
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Vehicles</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{q ? `${shown.length} of ${vehicles.length}` : vehicles.length} vehicles in fleet</div></div>
            {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>Loading vehicles…</div> : (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: theadBg }}>{['Code', 'Plate', 'Type', 'Model', 'Status', 'Mileage'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {shown.map(v => (<tr key={v.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}><td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: text }}>{v.code}</td><td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text }}>{v.plate}</td><td style={{ padding: '14px 18px', fontSize: 13.5, color: text }}>{v.type || '—'}</td><td style={{ padding: '14px 18px', fontSize: 13, color: text2 }}>{v.model || '—'}</td><td style={{ padding: '14px 18px' }}><span style={{ background: vBg(v.status), color: vC(v.status), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{v.status}</span></td><td style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', color: text2 }}>{v.mileage || 0} km</td></tr>))}
                            {shown.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{q ? `No vehicles match "${searchQ}"` : 'No vehicles found'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
function PageEmployees({ searchQ }) {
    const isDark = useDark(); const card = isDark ? '#1e293b' : '#fff'; const border = isDark ? '#334155' : '#e4e8ef'; const borderSub = isDark ? '#1e293b' : '#f1f5f9'; const text = isDark ? '#f1f5f9' : '#0f172a'; const text2 = isDark ? '#94a3b8' : '#64748b'; const rowBorder = isDark ? '#1e293b' : '#f8fafc'; const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const [employees, setEmployees] = useState([]); const [loading, setLoading] = useState(true)
    useEffect(() => {
        axiosClient.get('/employees/all').then(r => {
            console.log('keys:', Object.keys(r.data[0]))
            console.log('sample:', r.data[0])
            setEmployees(r.data); setLoading(false)
        }).catch(() => setLoading(false))
    }, [])
    const q = (searchQ || '').toLowerCase()
    const shown = q ? employees.filter(e => e.fullName?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || e.role?.toLowerCase().includes(q)) : employees
    const roleColor = r => r === 'DRIVER' ? '#2563eb' : r === 'PARAMEDIC' ? '#16a34a' : r === 'DISPATCHER' ? '#7c3aed' : '#ea580c'
    const roleBg = r => r === 'DRIVER' ? '#dbeafe' : r === 'PARAMEDIC' ? '#dcfce7' : r === 'DISPATCHER' ? '#ede9fe' : '#ffedd5'
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Employees</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{q ? `${shown.length} of ${employees.length}` : employees.length} employees nationwide</div></div>
            {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div> : (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: theadBg }}>{['Name', 'Email', 'Role', 'Duty Status', 'Center'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {shown.map(e => (<tr key={e.id} className="lers-row" style={{ borderBottom: `1px solid ${rowBorder}` }}><td style={{ padding: '14px 18px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor(e.role)},${roleColor(e.role)}99)`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(e.fullName)}</div><span style={{ fontWeight: 600, fontSize: 13.5, color: text }}>{e.fullName}</span></div></td><td style={{ padding: '14px 18px', fontSize: 13, color: text2 }}>{e.email || '—'}</td><td style={{ padding: '14px 18px' }}><span style={{ background: roleBg(e.role), color: roleColor(e.role), padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{e.role}</span></td><td style={{ padding: '14px 18px' }}><span style={{ background: e.dutyStatus === 'ON_DUTY' ? '#dcfce7' : e.dutyStatus === 'ON_MISSION' ? '#fee2e2' : isDark ? '#334155' : '#f1f5f9', color: e.dutyStatus === 'ON_DUTY' ? '#16a34a' : e.dutyStatus === 'ON_MISSION' ? '#dc2626' : '#64748b', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>
                                {e.dutyStatus === 'ON_DUTY' ? '🟢 ON DUTY' : e.dutyStatus === 'ON_MISSION' ? '🚨 ON MISSION' : '⚫ OFF DUTY'}
                            </span></td><td style={{ padding: '14px 18px', fontSize: 13, color: text }}>{e.centerId ? e.centerId.toString().slice(0, 8) + '…' : '—'}</td></tr>))}
                            {shown.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{q ? `No employees match "${searchQ}"` : 'No employees found'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
function PageFeedback() {
    const isDark = useDark(); const card = isDark ? '#1e293b' : '#fff'; const border = isDark ? '#334155' : '#e4e8ef'; const text = isDark ? '#f1f5f9' : '#334155'; const text2 = isDark ? '#94a3b8' : '#64748b'
    const [feedback, setFeedback] = useState([]); const [loading, setLoading] = useState(true); const [tab, setTab] = useState('all')
    const load = () => { axiosClient.get('/feedback').then(r => { setFeedback(r.data); setLoading(false) }).catch(() => setLoading(false)) }
    useEffect(() => { load() }, [])
    useEffect(() => { const interval = setInterval(load, 10000); return () => clearInterval(interval) }, [])
    const markRead = async id => { await axiosClient.patch(`/feedback/${id}/read`); load() }
    const unread = feedback.filter(f => !f.readByAdmin).length
    const stars = n => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))
    const filtered = feedback.filter(f => tab === 'all' ? true : tab === 'unread' ? !f.readByAdmin : f.readByAdmin)
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 20 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: isDark ? '#f1f5f9' : '#0f172a' }}>Citizen Feedback</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{feedback.length} total · {unread > 0 && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>{unread} unread</span>}</div></div>
            <div style={{ display: 'flex', gap: 4, background: card, padding: 4, border: `1px solid ${border}`, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
                {['all', 'unread', 'read'].map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', background: tab === t ? '#dbeafe' : 'transparent', border: tab === t ? '1px solid #bfdbfe' : '1px solid transparent', borderRadius: 7, fontSize: 13, color: tab === t ? '#2563eb' : text2, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                        {t === 'all' ? 'All' : t === 'unread' ? 'Unread' : 'Read'}
                        <span style={{ marginLeft: 6, fontSize: 11, background: tab === t ? '#2563eb' : isDark ? '#334155' : '#e4e8ef', color: tab === t ? '#fff' : text2, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                            {t === 'all' ? feedback.length : t === 'unread' ? feedback.filter(f => !f.readByAdmin).length : feedback.filter(f => f.readByAdmin).length}
                        </span>
                    </button>
                ))}
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div> : filtered.length === 0 ? (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 60, textAlign: 'center', color: '#94a3b8' }}><div style={{ fontSize: 48, marginBottom: 12 }}>💬</div><div style={{ fontSize: 15, fontWeight: 500 }}>No feedback yet</div><div style={{ fontSize: 13, marginTop: 6 }}>Citizen feedback will appear here after incidents are closed</div></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(f => (
                        <div key={f.id} style={{ background: card, border: `1px solid ${f.readByAdmin ? border : '#bfdbfe'}`, borderRadius: 14, padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: f.readByAdmin ? isDark ? '#334155' : '#f1f5f9' : '#dbeafe', display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{f.readByAdmin ? '✅' : '🔵'}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <span style={{ color: '#f59e0b', fontSize: 16, letterSpacing: 2 }}>{stars(f.rating)}</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{f.rating}/5</span>
                                    {!f.readByAdmin && <span style={{ background: '#dbeafe', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>NEW</span>}
                                    <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{f.submittedAt ? new Date(f.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                </div>
                                <div style={{ fontSize: 14, color: text, lineHeight: 1.6, marginBottom: 8 }}>{f.message || 'No message'}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                    {f.citizenName && <span style={{ fontWeight: 600, color: text }}>{f.citizenName}</span>}
                                    {f.citizenPhone && <span> · 📞 {f.citizenPhone}</span>}
                                    {f.incidentId && <span style={{ fontFamily: 'monospace' }}> · Incident: {f.incidentId?.toString().slice(0, 8)}…</span>}
                                </div>
                            </div>
                            {!f.readByAdmin && <button onClick={() => markRead(f.id)} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Mark Read</button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
function PageAnalytics({ stats }) {
    const isDark = useDark(); const card = isDark ? '#1e293b' : '#fff'; const border = isDark ? '#334155' : '#e4e8ef'; const text = isDark ? '#f1f5f9' : '#0f172a'; const text2 = isDark ? '#94a3b8' : '#64748b'
    const barData = stats?.byType ? Object.entries(stats.byType).map(([type, count]) => ({ type, count })) : []
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Analytics</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>National performance overview</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                {[{ label: 'Total Incidents', value: stats?.totalIncidents || 0, icon: '📋', color: 'blue', sub: 'All time' }, { label: 'Active Incidents', value: stats?.activeIncidents || 0, icon: '🚨', color: 'red', sub: 'Right now' }, { label: 'Closed Incidents', value: stats?.closedIncidents || 0, icon: '✅', color: 'green', sub: 'Resolved' }, { label: 'Backup Triggered', value: stats?.backupTriggered || 0, icon: '🔔', color: 'orange', sub: 'Auto-escalated' }, { label: 'Total Centers', value: stats?.totalCenters || 0, icon: '🏢', color: 'purple', sub: 'Nationwide' }, { label: 'Total Vehicles', value: stats?.totalVehicles || 0, icon: '🚑', color: 'amber', sub: 'Fleet' }].map(({ label, value, icon, color, sub }) => <KpiCard key={label} icon={icon} color={color} num={value} label={label} sub={sub} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: text }}>Resolution Rate</div>
                    {stats?.totalIncidents > 0 ? (<><div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}><div style={{ fontSize: 42, fontWeight: 700, color: '#16a34a', letterSpacing: '-0.03em' }}>{Math.round(((stats.closedIncidents || 0) / stats.totalIncidents) * 100)}%</div><div style={{ fontSize: 13, color: text2 }}><div>{stats.closedIncidents || 0} resolved</div><div>out of {stats.totalIncidents} total</div></div></div><div style={{ height: 10, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 5 }}><div style={{ height: '100%', background: 'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius: 5, width: `${Math.round(((stats.closedIncidents || 0) / stats.totalIncidents) * 100)}%`, transition: 'width 0.8s ease' }} /></div></>) : <div style={{ color: '#94a3b8', fontSize: 13 }}>No incidents yet</div>}
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: text }}>Backup Escalation Rate</div>
                    {stats?.totalIncidents > 0 ? (<><div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}><div style={{ fontSize: 42, fontWeight: 700, color: '#ea580c', letterSpacing: '-0.03em' }}>{Math.round(((stats.backupTriggered || 0) / stats.totalIncidents) * 100)}%</div><div style={{ fontSize: 13, color: text2 }}><div>{stats.backupTriggered || 0} escalated</div><div>out of {stats.totalIncidents} total</div></div></div><div style={{ height: 10, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 5 }}><div style={{ height: '100%', background: 'linear-gradient(90deg,#ea580c,#fb923c)', borderRadius: 5, width: `${Math.min(Math.round(((stats.backupTriggered || 0) / stats.totalIncidents) * 100), 100)}%`, transition: 'width 0.8s ease' }} /></div></>) : <div style={{ color: '#94a3b8', fontSize: 13 }}>No incidents yet</div>}
                </div>
            </div>
            {barData.length > 0 && (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Incidents by Type</div>
                    <div style={{ marginBottom: 16 }}><ResponsiveContainer width="100%" height={200}><BarChart data={barData} barSize={40}><XAxis dataKey="type" tick={{ fontSize: 12, fill: text2 }} /><YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} /><RTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${border}`, fontSize: 12, background: card, color: text }} /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{barData.map(({ type }) => <Cell key={type} fill={tc(type)} />)}</Bar></BarChart></ResponsiveContainer></div>
                    {barData.map(({ type, count }) => (<div key={type} style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}><span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, color: text }}><span style={{ width: 10, height: 10, borderRadius: 3, background: tc(type), display: 'inline-block' }} />{type}</span><span style={{ color: text2, fontWeight: 600 }}>{count} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({Math.round((count / stats.totalIncidents) * 100)}%)</span></span></div><div style={{ height: 8, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 4 }}><div style={{ height: '100%', background: tc(type), borderRadius: 4, width: `${Math.min((count / stats.totalIncidents) * 100, 100)}%`, transition: 'width 0.6s' }} /></div></div>))}
                </div>
            )}
        </div>
    )
}
function PageSettings({ user, photo, setPhoto }) {
    const isDark = useDark(); const card = isDark ? '#1e293b' : '#fff'; const border = isDark ? '#334155' : '#e4e8ef'; const borderSub = isDark ? '#334155' : '#f1f5f9'; const text = isDark ? '#f1f5f9' : '#0f172a'; const text2 = isDark ? '#94a3b8' : '#64748b'
    const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
    const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
    const { theme, setTheme } = useSettingsStore()
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const fileRef = useRef()
    const handlePhoto = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => { setPhoto(ev.target.result); localStorage.setItem('profilePhoto', ev.target.result) }; r.readAsDataURL(file) }
    const removePhoto = () => { setPhoto(null); localStorage.removeItem('profilePhoto') }
    const handleSave = async () => {
        setMsg(''); setErr('')
        if (form.newPassword && form.newPassword !== form.confirmPassword) { setErr('Passwords do not match'); return }
        try { if (form.newPassword) await axiosClient.patch('/auth/change-password', { oldPassword: form.oldPassword, newPassword: form.newPassword }); setMsg('Saved successfully!'); setForm({ oldPassword: '', newPassword: '', confirmPassword: '' }) }
        catch (e) { setErr(e.response?.data?.message || 'Failed') }
    }
    return (
        <div className="page-refresh">
            <div style={{ marginBottom: 24 }}><h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Settings</h1><div style={{ color: text2, fontSize: 13, marginTop: 4 }}>Account & system settings</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Profile</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ position: 'relative' }}>
                            {photo ? <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #e4e8ef' }} /> : <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 32 }}>{initials(user?.fullName)}</div>}
                            <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%', background: '#2563eb', border: '2px solid #fff', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 12, color: '#fff' }}>✏</button>
                            {photo && <button onClick={removePhoto} style={{ position: 'absolute', top: 2, right: 2, width: 26, height: 26, borderRadius: '50%', background: '#dc2626', border: '2px solid #fff', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 11, color: '#fff' }}>✕</button>}
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: 17, color: text }}>{user?.fullName}</div>
                            <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{user?.email}</div>
                            <div style={{ marginTop: 8 }}><span style={{ background: '#dbeafe', color: '#2563eb', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>SUPER ADMIN</span></div>
                        </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${borderSub}`, marginTop: 20, paddingTop: 20 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>USER ID</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: text, background: isDark ? '#0f172a' : '#f8fafc', padding: '8px 12px', borderRadius: 8, wordBreak: 'break-all' }}>{user?.userId}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12, marginBottom: 6 }}>ROLE</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: text, background: isDark ? '#0f172a' : '#f8fafc', padding: '8px 12px', borderRadius: 8 }}>{user?.role}</div>
                    </div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Change Password</div>
                    <FF label="Current Password" value={form.oldPassword} onChange={v => set('oldPassword', v)} type="password" placeholder="••••••••" />
                    <FF label="New Password" value={form.newPassword} onChange={v => set('newPassword', v)} type="password" placeholder="At least 8 characters" />
                    <FF label="Confirm New Password" value={form.confirmPassword} onChange={v => set('confirmPassword', v)} type="password" placeholder="Repeat new password" />
                    {err && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>⚠️ {err}</div>}
                    {msg && <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: 13, marginBottom: 14 }}>✅ {msg}</div>}
                    <button onClick={handleSave} style={{ padding: '11px 22px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Save Changes</button>
                    <div style={{ marginTop: 16, padding: 14, background: isDark ? '#0f172a' : '#f8fafc', borderRadius: 8, fontSize: 12, color: text2, lineHeight: 1.6 }}>💡 Use a strong password with at least 8 characters, including numbers and symbols.</div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 28, gridColumn: '1 / -1' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: text }}>Appearance</div>
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: text2, marginBottom: 10 }}>Theme</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['system', '💻 System']].map(([val, label]) => (
                                <button key={val} onClick={() => setTheme(val)} style={{ padding: '8px 20px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: theme === val ? '2px solid #2563eb' : `2px solid ${border}`, background: theme === val ? '#eff6ff' : isDark ? '#0f172a' : '#f8fafc', color: theme === val ? '#2563eb' : text2, transition: 'all 0.15s' }}>{label}</button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
export default function SuperDashboard() {
    const [page, setPage] = useState('dashboard')
    const [stats, setStats] = useState(null)
    const [incidents, setIncidents] = useState([])
    const [centers, setCenters] = useState([])
    const [photo, setPhoto] = useState(() => localStorage.getItem('profilePhoto') || null)
    const [searchQ, setSearchQ] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const { theme } = useSettingsStore()
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    const loadData = async () => {
        setRefreshing(true)
        try {
            const [s, i, c] = await Promise.all([axiosClient.get('/analytics/overview'), axiosClient.get('/incidents/all'), axiosClient.get('/centers')])
            setStats(s.data); setIncidents(i.data); setCenters(c.data)
        } catch (e) { console.error(e) }
        finally { setTimeout(() => setRefreshing(false), 600) }
    }
    useEffect(() => { loadData() }, [])
    const goPage = p => { setPage(p); setSearchQ('') }
    const handleLogout = () => {
        if (!window.confirm('Are you sure you want to logout?')) return
        setLoggingOut(true)
        setTimeout(() => { logout(); navigate('/login') }, 2000)
    }
    const renderPage = () => {
        switch (page) {
            case 'dashboard': return <PageDashboard stats={stats} incidents={incidents} centers={centers} />
            case 'incidents': return <PageIncidents incidents={incidents} searchQ={searchQ} />
            case 'map': return <PageMap centers={centers} />
            case 'centers': return <PageCenters centers={centers} onRefresh={loadData} searchQ={searchQ} />
            case 'hospitals': return <PageHospitals />
            case 'admins': return <PageAdmins searchQ={searchQ} />
            case 'vehicles': return <PageVehicles searchQ={searchQ} />
            case 'employees': return <PageEmployees searchQ={searchQ} />
            case 'feedback': return <PageFeedback />
            case 'analytics': return <PageAnalytics stats={stats} />
            case 'settings': return <PageSettings user={user} photo={photo} setPhoto={setPhoto} />
            default: return <PageDashboard stats={stats} incidents={incidents} centers={centers} />
        }
    }
    return (
        <div data-theme={isDark ? 'dark' : 'light'} style={{ display: 'flex', minHeight: '100vh', background: isDark ? '#0f172a' : '#f3f5f9', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 14 }}>
            {loggingOut && <LogoutPopup />}
            <Sidebar active={page} setActive={goPage} user={user} onLogout={handleLogout} photo={photo} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <TopBar user={user} onRefresh={loadData} onProfile={() => goPage('settings')} photo={photo} searchQ={searchQ} onSearch={setSearchQ} refreshing={refreshing} onLogout={handleLogout} />
                <div style={{ padding: '24px 28px 64px', flex: 1 }}>
                    {renderPage()}
                </div>
            </div>
        </div>
    )
}