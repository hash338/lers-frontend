import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import axiosClient from '../../api/axiosClient'
import useSettingsStore from '../../store/settingsStore'

function useDark() {
    const { theme } = useSettingsStore()
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function Toast({ msg, type }) {
    if (!msg) return null
    const bg = type === 'error' ? '#fee2e2' : type === 'loading' ? '#dbeafe' : '#dcfce7'
    const co = type === 'error' ? '#dc2626' : type === 'loading' ? '#2563eb' : '#16a34a'
    return <div style={{ position: 'fixed', top: 20, right: 20, background: bg, color: co, border: `1px solid ${co}30`, borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 500, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
        {type === 'error' ? '⚠️' : type === 'loading' ? '⏳' : '✅'} {msg}
    </div>
}

const ROOM_STATUS_COLOR = { AVAILABLE: '#16a34a', OCCUPIED: '#dc2626', RESERVED: '#d97706' }
const ROOM_STATUS_BG = { AVAILABLE: '#dcfce7', OCCUPIED: '#fee2e2', RESERVED: '#fef3c7' }
const ROOM_TYPES = ['REGULAR', 'ICU', 'EMERGENCY', 'PEDIATRIC', 'CARDIAC', 'SURGERY']
const TYPE_COLOR = { GENERAL: '#2563eb', CARDIAC: '#dc2626', TRAUMA: '#ea580c', PEDIATRIC: '#7c3aed', PSYCHIATRIC: '#16a34a', ONCOLOGY: '#d97706' }
const TYPE_BG = { GENERAL: '#dbeafe', CARDIAC: '#fee2e2', TRAUMA: '#ffedd5', PEDIATRIC: '#ede9fe', PSYCHIATRIC: '#dcfce7', ONCOLOGY: '#fef3c7' }

function Sidebar({ active, setActive, hospital, onLogout }) {
    const NAV = [
        { id: 'overview', icon: '⊞', label: 'Overview' },
        { id: 'floors', icon: '🏗️', label: 'Floors & Rooms' },
        { id: 'bookings', icon: '📋', label: 'Bookings' },
    ]
    return (
        <div style={{ width: 230, background: '#0d1a33', color: '#8b96ad', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, padding: '20px 14px', gap: 4, flexShrink: 0 }}>
            <div style={{ padding: '4px 8px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#dc2626', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>🏥</div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>LERS</div>
                        <div style={{ fontSize: 9, color: '#8b96ad', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>HOSPITAL ADMIN</div>
                    </div>
                </div>
                {hospital && (
                    <div style={{ background: '#ffffff10', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
                        <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hospital.name}</div>
                        <div style={{ fontSize: 11, color: '#8b96ad', marginTop: 2 }}>{hospital.region}</div>
                    </div>
                )}
            </div>
            {NAV.map(n => (
                <button key={n.id} onClick={() => setActive(n.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13.5, color: active === n.id ? '#fff' : '#8b96ad', background: active === n.id ? '#dc2626' : 'transparent', border: 0, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: active === n.id ? 600 : 400 }}>
                    <span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}
                </button>
            ))}
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #ffffff10' }}>
                <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, width: '100%', background: 'none', border: 0, cursor: 'pointer', color: '#f87171', fontSize: 13, fontFamily: 'inherit' }}>⎋ Logout</button>
            </div>
        </div>
    )
}

function PageOverview({ hospital, floors }) {
    const isDark = useDark()
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'

    const totalRooms = floors.reduce((a, f) => a + (f.rooms?.length || 0), 0)
    const availableRooms = floors.reduce((a, f) => a + (f.rooms?.filter(r => r.status === 'AVAILABLE').length || 0), 0)
    const occupiedRooms = floors.reduce((a, f) => a + (f.rooms?.filter(r => r.status === 'OCCUPIED').length || 0), 0)
    const reservedRooms = floors.reduce((a, f) => a + (f.rooms?.filter(r => r.status === 'RESERVED').length || 0), 0)

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Overview</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{hospital?.name} · {hospital?.region}</div>
            </div>

            {/* Hospital Info */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: '#fee2e2', display: 'grid', placeItems: 'center', fontSize: 26 }}>🏥</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 18, color: text }}>{hospital?.name}</div>
                        <div style={{ fontSize: 13, color: text2, marginTop: 4 }}>{hospital?.address || hospital?.region}</div>
                        {hospital?.type && <span style={{ background: TYPE_BG[hospital.type] || '#f1f5f9', color: TYPE_COLOR[hospital.type] || '#64748b', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, display: 'inline-block', marginTop: 6 }}>{hospital.type}</span>}
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: text2 }}>Phone</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, color: text, marginTop: 2 }}>{hospital?.phone || '—'}</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {[
                        { label: 'Total Floors', value: floors.length, icon: '🏗️', bg: '#dbeafe', color: '#2563eb' },
                        { label: 'Total Rooms', value: totalRooms, icon: '🚪', bg: '#f3e8ff', color: '#7c3aed' },
                        { label: 'Available', value: availableRooms, icon: '✅', bg: '#dcfce7', color: '#16a34a' },
                        { label: 'Occupied', value: occupiedRooms, icon: '🔴', bg: '#fee2e2', color: '#dc2626' },
                    ].map(({ label, value, icon, bg, color }) => (
                        <div key={label} style={{ background: isDark ? '#0f172a' : '#f8fafc', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'grid', placeItems: 'center', fontSize: 18 }}>{icon}</div>
                            <div>
                                <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                                <div style={{ fontSize: 11, color: text2, marginTop: 4 }}>{label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Room Status */}
            {reservedRooms > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 16 }}>
                    <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>⏳ {reservedRooms} room(s) pending citizen booking confirmation</div>
                    <div style={{ fontSize: 13, color: '#78350f' }}>Go to Bookings tab to accept or deny pending requests.</div>
                </div>
            )}
        </div>
    )
}

function PageFloors({ hospital, floors, onRefresh, showToast }) {
    const isDark = useDark()
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'

    const [showAddFloor, setShowAddFloor] = useState(false)
    const [floorNum, setFloorNum] = useState('')
    const [showAddRoom, setShowAddRoom] = useState(null)
    const [roomForm, setRoomForm] = useState({ roomNumber: '', type: 'REGULAR' })
    const [saving, setSaving] = useState(false)

    const handleAddFloor = async () => {
        if (!floorNum) { showToast('Floor number required', 'error'); return }
        setSaving(true)
        try {
            await axiosClient.post(`/hospitals/${hospital.id}/floors?floorNumber=${floorNum}`)
            setShowAddFloor(false); setFloorNum('')
            showToast('Floor added!', 'success'); onRefresh()
        } catch { showToast('Failed to add floor', 'error') }
        finally { setSaving(false) }
    }

    const handleAddRoom = async (floorId) => {
        if (!roomForm.roomNumber) { showToast('Room number required', 'error'); return }
        setSaving(true)
        try {
            await axiosClient.post(`/hospitals/floors/${floorId}/rooms`, roomForm)
            setShowAddRoom(null); setRoomForm({ roomNumber: '', type: 'REGULAR' })
            showToast('Room added!', 'success'); onRefresh()
        } catch { showToast('Failed to add room', 'error') }
        finally { setSaving(false) }
    }

    const handleRelease = async (roomId) => {
        if (!window.confirm('Mark patient as discharged and release this room?')) return
        try {
            await axiosClient.patch(`/hospitals/rooms/${roomId}/release`)
            showToast('Room released!', 'success'); onRefresh()
        } catch { showToast('Failed', 'error') }
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Floors & Rooms</h1>
                    <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{floors.length} floors · {floors.reduce((a, f) => a + (f.rooms?.length || 0), 0)} total rooms</div>
                </div>
                <button onClick={() => setShowAddFloor(true)} style={{ padding: '10px 18px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Floor</button>
            </div>

            {floors.length === 0 ? (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>No floors yet</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Add a floor to get started!</div>
                </div>
            ) : floors.map(floor => (
                <div key={floor.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                    {/* Floor Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: isDark ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${border}` }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: text }}>Floor {floor.floorNumber}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: text2 }}>{floor.rooms?.length || 0} rooms</span>
                            <span style={{ fontSize: 12, color: '#16a34a' }}>{floor.rooms?.filter(r => r.status === 'AVAILABLE').length || 0} available</span>
                            <button onClick={() => setShowAddRoom(floor.id)} style={{ padding: '6px 12px', background: '#dc262610', border: '1px solid #dc262640', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#dc2626' }}>+ Room</button>
                        </div>
                    </div>

                    {/* Rooms Grid */}
                    <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {!floor.rooms || floor.rooms.length === 0 ? (
                            <div style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No rooms yet — add one!</div>
                        ) : floor.rooms.map(room => (
                            <div key={room.id} style={{ background: ROOM_STATUS_BG[room.status] || '#f1f5f9', border: `2px solid ${ROOM_STATUS_COLOR[room.status]}40`, borderRadius: 10, padding: '12px 14px', minWidth: 110, textAlign: 'center' }}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: ROOM_STATUS_COLOR[room.status] }}>#{room.roomNumber}</div>
                                <div style={{ fontSize: 11, color: ROOM_STATUS_COLOR[room.status], opacity: 0.8, marginTop: 2 }}>{room.type}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: ROOM_STATUS_COLOR[room.status], marginTop: 4, padding: '2px 6px', background: `${ROOM_STATUS_COLOR[room.status]}15`, borderRadius: 6, display: 'inline-block' }}>{room.status}</div>
                                {room.status !== 'AVAILABLE' && (
                                    <button onClick={() => handleRelease(room.id)} style={{ marginTop: 8, width: '100%', padding: '5px 0', background: '#16a34a', color: '#fff', border: 0, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🔓 Release</button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Room Inline */}
                    {showAddRoom === floor.id && (
                        <div style={{ padding: 16, borderTop: `1px solid ${border}`, background: isDark ? '#0f172a' : '#f8fafc' }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: text, marginBottom: 10 }}>Add Room to Floor {floor.floorNumber}</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 12, color: text2, marginBottom: 4 }}>Room Number</label>
                                    <input value={roomForm.roomNumber} onChange={e => setRoomForm(f => ({ ...f, roomNumber: e.target.value }))} placeholder="e.g. 101"
                                        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: isDark ? '#1e293b' : '#fff', color: text, boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 12, color: text2, marginBottom: 4 }}>Room Type</label>
                                    <select value={roomForm.type} onChange={e => setRoomForm(f => ({ ...f, type: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: isDark ? '#1e293b' : '#fff', color: text }}>
                                        {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <button onClick={() => handleAddRoom(floor.id)} disabled={saving} style={{ padding: '8px 14px', background: saving ? '#93c5fd' : '#dc2626', color: '#fff', border: 0, borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{saving ? '…' : '+ Add'}</button>
                                <button onClick={() => setShowAddRoom(null)} style={{ padding: '8px 12px', background: isDark ? '#334155' : '#f1f5f9', border: 0, borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: text2 }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* Add Floor Modal */}
            {showAddFloor && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }} onClick={() => setShowAddFloor(false)}>
                    <div style={{ background: card, borderRadius: 18, width: '100%', maxWidth: 360, padding: 30, boxShadow: '0 25px 80px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 700, fontSize: 18, color: text, marginBottom: 20 }}>Add Floor</div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: text2, marginBottom: 6 }}>Floor Number *</label>
                            <input value={floorNum} onChange={e => setFloorNum(e.target.value)} type="number" placeholder="e.g. 1"
                                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: text }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowAddFloor(false)} style={{ padding: '9px 18px', background: isDark ? '#334155' : '#f1f5f9', border: 0, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: text }}>Cancel</button>
                            <button onClick={handleAddFloor} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#fca5a5' : '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? '⏳' : 'Add Floor'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function PageBookings({ hospital, onRefresh, showToast }) {
    const isDark = useDark()
    const text = isDark ? '#f1f5f9' : '#0f172a'
    const text2 = isDark ? '#94a3b8' : '#64748b'
    const card = isDark ? '#1e293b' : '#fff'
    const border = isDark ? '#334155' : '#e4e8ef'
    const rowBorder = isDark ? '#1e293b' : '#f8fafc'
    const theadBg = isDark ? '#0f172a' : '#fafbfc'

    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('PENDING')

    const loadBookings = async () => {
        if (!hospital) return
        setLoading(true)
        try {
            const r = await axiosClient.get(`/hospitals/${hospital.id}/bookings`)
            setBookings(r.data)
        } catch { setBookings([]) }
        finally { setLoading(false) }
    }

    useEffect(() => { loadBookings() }, [hospital])

    const handleAccept = async (bookingId) => {
        try {
            await axiosClient.patch(`/hospitals/bookings/${bookingId}/accept`)
            showToast('Booking confirmed!', 'success')
            loadBookings(); onRefresh()
        } catch { showToast('Failed', 'error') }
    }

    const handleDeny = async (bookingId) => {
        try {
            await axiosClient.patch(`/hospitals/bookings/${bookingId}/deny`)
            showToast('Booking denied', 'success')
            loadBookings()
        } catch { showToast('Failed', 'error') }
    }

    const TABS = ['PENDING', 'CONFIRMED', 'DENIED', 'DISCHARGED']
    const STATUS_COLOR = { PENDING: '#d97706', CONFIRMED: '#16a34a', DENIED: '#dc2626', DISCHARGED: '#64748b' }
    const STATUS_BG = { PENDING: '#fef3c7', CONFIRMED: '#dcfce7', DENIED: '#fee2e2', DISCHARGED: '#f1f5f9' }
    const filtered = bookings.filter(b => b.status === tab)

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: text }}>Bookings</h1>
                <div style={{ color: text2, fontSize: 13, marginTop: 4 }}>{bookings.filter(b => b.status === 'PENDING').length > 0 && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>⏳ {bookings.filter(b => b.status === 'PENDING').length} pending</span>}</div>
            </div>

            <div style={{ display: 'flex', gap: 4, background: card, padding: 4, border: `1px solid ${border}`, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', background: tab === t ? '#eff6ff' : 'transparent', border: tab === t ? '1px solid #bfdbfe' : '1px solid transparent', borderRadius: 7, fontSize: 13, color: tab === t ? '#2563eb' : text2, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t}
                        <span style={{ marginLeft: 6, fontSize: 11, background: tab === t ? '#2563eb' : isDark ? '#334155' : '#e4e8ef', color: tab === t ? '#fff' : text2, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                            {bookings.filter(b => b.status === t).length}
                        </span>
                    </button>
                ))}
            </div>

            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: theadBg }}>
                            {['Room', 'Floor', 'Type', 'Booked By', 'Citizen', 'Notes', 'Status', tab === 'PENDING' ? 'Actions' : ''].filter(Boolean).map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${border}` }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No {tab.toLowerCase()} bookings</td></tr>
                        ) : filtered.map(b => (
                            <tr key={b.id} style={{ borderBottom: `1px solid ${rowBorder}` }}>
                                <td style={{ padding: '13px 16px', fontWeight: 700, color: text }}>#{b.room?.roomNumber}</td>
                                <td style={{ padding: '13px 16px', color: text2 }}>Floor {b.room?.floor?.floorNumber}</td>
                                <td style={{ padding: '13px 16px', fontSize: 12, color: text }}>{b.room?.type}</td>
                                <td style={{ padding: '13px 16px' }}>
                                    <span style={{ background: b.bookedBy === 'DISPATCHER' ? '#dbeafe' : '#ede9fe', color: b.bookedBy === 'DISPATCHER' ? '#2563eb' : '#7c3aed', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{b.bookedBy}</span>
                                </td>
                                <td style={{ padding: '13px 16px', fontSize: 13, color: text }}>{b.citizen?.fullName || '—'}</td>
                                <td style={{ padding: '13px 16px', fontSize: 12, color: text2 }}>{b.notes || '—'}</td>
                                <td style={{ padding: '13px 16px' }}>
                                    <span style={{ background: STATUS_BG[b.status], color: STATUS_COLOR[b.status], padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{b.status}</span>
                                </td>
                                {tab === 'PENDING' && (
                                    <td style={{ padding: '13px 16px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => handleAccept(b.id)} style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Accept</button>
                                            <button onClick={() => handleDeny(b.id)} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Deny</button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default function HospitalDashboard() {
    const [page, setPage] = useState('overview')
    const [hospital, setHospital] = useState(null)
    const [floors, setFloors] = useState([])
    const [loading, setLoading] = useState(true)
    const [loggingOut, setLoggingOut] = useState(false)
    const [toast, setToast] = useState({ msg: '', type: '' })
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const { theme } = useSettingsStore()
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    const showToast = (msg, type, dur = 3000) => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), dur) }

    const loadHospital = async () => {
        try {
            const r = await axiosClient.get('/hospitals/my')
            setHospital(r.data)
            const f = await axiosClient.get(`/hospitals/${r.data.id}/floors`)
            setFloors(Array.isArray(f.data) ? f.data : [])
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const loadFloors = async () => {
        if (!hospital) return
        try {
            const f = await axiosClient.get(`/hospitals/${hospital.id}/floors`)
            setFloors(f.data)
        } catch { }
    }

    useEffect(() => {
        loadHospital()
        const interval = setInterval(loadHospital, 5000)
        return () => clearInterval(interval)
    }, [])

    const handleLogout = () => {
        if (!window.confirm('Are you sure you want to logout?')) return
        setLoggingOut(true)
        setTimeout(() => { logout(); navigate('/login') }, 1500)
    }

    const renderPage = () => {
        if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8', fontSize: 15 }}>⏳ Loading hospital data…</div>
        switch (page) {
            case 'overview': return <PageOverview hospital={hospital} floors={floors} />
            case 'floors': return <PageFloors hospital={hospital} floors={floors} onRefresh={loadHospital} showToast={showToast} />
            case 'bookings': return <PageBookings hospital={hospital} onRefresh={loadHospital} showToast={showToast} />
            default: return <PageOverview hospital={hospital} floors={floors} />
        }
    }

    return (
        <div data-theme={isDark ? 'dark' : 'light'} style={{ display: 'flex', minHeight: '100vh', background: isDark ? '#0f172a' : '#f3f5f9', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 14 }}>
            {loggingOut && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', borderRadius: 20, padding: '40px 48px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.3)' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>Logging out…</div>
                    </div>
                </div>
            )}
            <Toast msg={toast.msg} type={toast.type} />
            <Sidebar active={page} setActive={setPage} hospital={hospital} onLogout={handleLogout} />
            <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
                {renderPage()}
            </div>
        </div>
    )
}