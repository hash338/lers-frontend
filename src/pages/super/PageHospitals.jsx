import { useState, useEffect } from 'react'
import axiosClient from '../../api/axiosClient'
import useSettingsStore from '../../store/settingsStore'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function useDarkH() {
    const { theme } = useSettingsStore()
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

const HOSPITAL_TYPES = ['ALL', 'GENERAL', 'CARDIAC', 'TRAUMA', 'PEDIATRIC', 'PSYCHIATRIC', 'ONCOLOGY']
const TYPE_COLOR = { GENERAL: '#2563eb', CARDIAC: '#dc2626', TRAUMA: '#ea580c', PEDIATRIC: '#7c3aed', PSYCHIATRIC: '#16a34a', ONCOLOGY: '#d97706' }
const TYPE_BG = { GENERAL: '#dbeafe', CARDIAC: '#fee2e2', TRAUMA: '#ffedd5', PEDIATRIC: '#ede9fe', PSYCHIATRIC: '#dcfce7', ONCOLOGY: '#fef3c7' }

const PIN_ICON = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;background:#2563eb;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })

function MapClicker({ onPick }) {
    useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng) } })
    return null
}

export default function PageHospitals() {
    const isDark = useDarkH()
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const borderSub = isDark ? '#1e293b' : '#f1f5f9'
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'

    const [hospitals, setHospitals] = useState([])
    const [hospitalStats, setHospitalStats] = useState({}) // { hospitalId: { floors, totalRooms, available, occupied } }
    const [loading, setLoading] = useState(true)
    const [filterType, setFilterType] = useState('ALL')
    const [showCreate, setShowCreate] = useState(false)
    const [toast, setToast] = useState({ msg: '', type: '' })
    const [saving, setSaving] = useState(false)
    const emptyForm = { name: '', region: '', phone: '', address: '', latitude: '', longitude: '', type: 'GENERAL', adminEmail: '', adminPassword: '' }
    const [hForm, setHForm] = useState(emptyForm)

    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }

    const loadHospitals = async () => {
        setLoading(true)
        try {
            const r = await axiosClient.get('/hospitals')
            const list = Array.isArray(r.data) ? r.data : []
            setHospitals(list)
            // Load floors/rooms stats for each hospital
            const stats = {}
            await Promise.all(list.map(async h => {
                try {
                    const f = await axiosClient.get(`/hospitals/${h.id}/floors`)
                    const floors = Array.isArray(f.data) ? f.data : []
                    const totalRooms = floors.reduce((a, fl) => a + (fl.rooms?.length || 0), 0)
                    const available = floors.reduce((a, fl) => a + (fl.rooms?.filter(r => r.status === 'AVAILABLE').length || 0), 0)
                    const occupied = floors.reduce((a, fl) => a + (fl.rooms?.filter(r => r.status === 'OCCUPIED').length || 0), 0)
                    const reserved = floors.reduce((a, fl) => a + (fl.rooms?.filter(r => r.status === 'RESERVED').length || 0), 0)
                    stats[h.id] = { floors: floors.length, totalRooms, available, occupied, reserved }
                } catch {
                    stats[h.id] = { floors: 0, totalRooms: 0, available: 0, occupied: 0, reserved: 0 }
                }
            }))
            setHospitalStats(stats)
        } catch { showToast('Failed to load hospitals', 'error') }
        finally { setLoading(false) }
    }

    useEffect(() => { loadHospitals() }, [])

    const handleCreate = async () => {
        if (!hForm.name || !hForm.region) { showToast('Name and Region required', 'error'); return }
        if (!hForm.adminEmail || !hForm.adminPassword) { showToast('Admin Email and Password required', 'error'); return }
        setSaving(true)
        try {
            await axiosClient.post('/hospitals', {
                ...hForm,
                latitude: hForm.latitude ? parseFloat(hForm.latitude) : null,
                longitude: hForm.longitude ? parseFloat(hForm.longitude) : null
            })
            setShowCreate(false)
            setHForm(emptyForm)
            showToast('Hospital created!', 'success')
            loadHospitals()
        } catch (e) { showToast(e.response?.data?.message || 'Failed to create', 'error') }
        finally { setSaving(false) }
    }

    const shown = filterType === 'ALL' ? hospitals : hospitals.filter(h => h.type === filterType)
    const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: text }

    return (
        <div className="page-refresh">
            {toast.msg && (
                <div style={{ position: 'fixed', top: 20, right: 20, background: toast.type === 'error' ? '#fee2e2' : '#dcfce7', color: toast.type === 'error' ? '#dc2626' : '#16a34a', borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 500, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                    {toast.type === 'error' ? '⚠️' : '✅'} {toast.msg}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Hospitals</h1>
                    <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{shown.length} hospitals registered</div>
                </div>
                <button onClick={() => { setHForm(emptyForm); setShowCreate(true) }}
                    style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Create Hospital
                </button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 4, background: card, padding: 4, border: `1px solid ${border}`, borderRadius: 10, width: 'fit-content', marginBottom: 16, flexWrap: 'wrap' }}>
                {HOSPITAL_TYPES.map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                        style={{ padding: '7px 14px', background: filterType === t ? '#eff6ff' : 'transparent', border: filterType === t ? '1px solid #bfdbfe' : '1px solid transparent', borderRadius: 7, fontSize: 13, color: filterType === t ? '#2563eb' : text2, fontWeight: filterType === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t}
                        <span style={{ marginLeft: 6, fontSize: 11, background: filterType === t ? '#2563eb' : isDark ? '#334155' : '#e4e8ef', color: filterType === t ? '#fff' : text2, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                            {t === 'ALL' ? hospitals.length : hospitals.filter(h => h.type === t).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Table */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: theadBg }}>
                            {['Name', 'Region', 'Type', 'Admin Email', 'Floors', 'Total Rooms', 'Available', 'Occupied'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${borderSub}` }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                        ) : shown.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
                                <div>No hospitals yet. Create one!</div>
                            </td></tr>
                        ) : shown.map(h => {
                            const s = hospitalStats[h.id] || { floors: 0, totalRooms: 0, available: 0, occupied: 0 }
                            return (
                                <tr key={h.id} style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                    <td style={{ padding: '13px 16px', fontWeight: 600, fontSize: 13.5, color: text }}>{h.name}</td>
                                    <td style={{ padding: '13px 16px', fontSize: 13, color: text2 }}>{h.region || '—'}</td>
                                    <td style={{ padding: '13px 16px' }}>
                                        <span style={{ background: TYPE_BG[h.type] || '#f1f5f9', color: TYPE_COLOR[h.type] || '#64748b', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{h.type}</span>
                                    </td>
                                    <td style={{ padding: '13px 16px', fontSize: 12, color: text2 }}>{h.adminEmail || '—'}</td>
                                    <td style={{ padding: '13px 16px' }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: text }}>{s.floors}</span>
                                        <span style={{ fontSize: 11, color: text2, marginLeft: 4 }}>floors</span>
                                    </td>
                                    <td style={{ padding: '13px 16px' }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: text }}>{s.totalRooms}</span>
                                        <span style={{ fontSize: 11, color: text2, marginLeft: 4 }}>rooms</span>
                                    </td>
                                    <td style={{ padding: '13px 16px' }}>
                                        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{s.available} ✓</span>
                                    </td>
                                    <td style={{ padding: '13px 16px' }}>
                                        <span style={{ background: s.occupied > 0 ? '#fee2e2' : isDark ? '#334155' : '#f1f5f9', color: s.occupied > 0 ? '#dc2626' : '#94a3b8', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{s.occupied} 🔴</span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }} onClick={() => setShowCreate(false)}>
                    <div style={{ background: card, borderRadius: 18, width: '100%', maxWidth: 540, padding: 30, boxShadow: '0 25px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ fontWeight: 700, fontSize: 18, color: text }}>Create Hospital</div>
                            <button onClick={() => setShowCreate(false)} style={{ background: isDark ? '#334155' : '#f1f5f9', border: 0, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: text2, fontSize: 16, display: 'grid', placeItems: 'center' }}>×</button>
                        </div>

                        {/* Map */}
                        <div style={{ height: 180, borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}`, marginBottom: 14 }}>
                            <div style={{ fontSize: 11, color: text2, padding: '4px 8px', background: isDark ? '#0f172a' : '#f3f5f9', borderBottom: `1px solid ${border}` }}>📍 Click the map to set location</div>
                            <MapContainer center={[33.8547, 35.8623]} zoom={7} style={{ height: 'calc(100% - 24px)', width: '100%' }} zoomControl={false}>
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='' />
                                <MapClicker onPick={(lat, lng) => setHForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))} />
                                {hForm.latitude && hForm.longitude && (
                                    <Marker position={[parseFloat(hForm.latitude), parseFloat(hForm.longitude)]} icon={PIN_ICON} />
                                )}
                            </MapContainer>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                            {[['Name *', 'name', 'Beirut Medical Center'], ['Region *', 'region', 'Beirut'], ['Phone', 'phone', '+961-1-123456'], ['Address', 'address', 'Hamra Street']].map(([label, key, ph]) => (
                                <div key={key} style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>{label}</label>
                                    <input value={hForm[key]} onChange={e => setHForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={inputStyle} />
                                </div>
                            ))}
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>Type</label>
                                <select value={hForm.type} onChange={e => setHForm(f => ({ ...f, type: e.target.value }))} style={{ ...inputStyle, padding: '9px 12px' }}>
                                    {HOSPITAL_TYPES.filter(t => t !== 'ALL').map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>
                                    Lat / Lng {hForm.latitude && hForm.longitude && <span style={{ color: '#16a34a', fontSize: 11 }}>✓ {parseFloat(hForm.latitude).toFixed(4)}, {parseFloat(hForm.longitude).toFixed(4)}</span>}
                                </label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input value={hForm.latitude} onChange={e => setHForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Lat" style={{ ...inputStyle, flex: 1 }} />
                                    <input value={hForm.longitude} onChange={e => setHForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Lng" style={{ ...inputStyle, flex: 1 }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ borderTop: `1px solid ${border}`, margin: '4px 0 14px', paddingTop: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>🔑 Hospital Admin Account</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>Admin Email *</label>
                                    <input value={hForm.adminEmail} onChange={e => setHForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="hospital@lers.lb" style={inputStyle} />
                                </div>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>Admin Password *</label>
                                    <input type="password" value={hForm.adminPassword} onChange={e => setHForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="••••••••" style={inputStyle} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', background: isDark ? '#334155' : '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: text }}>Cancel</button>
                            <button onClick={handleCreate} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? '⏳ Creating…' : 'Create Hospital'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}