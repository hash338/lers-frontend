import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosClient from '../api/axiosClient'
import useAuthStore from '../store/authStore'
import logo from '../assets/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dots, setDots] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) { setDots(''); return }
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 400)
    return () => clearInterval(interval)
  }, [loading])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await axiosClient.post('/auth/login', { email, password })
      const { token, refreshToken, ...user } = res.data
      login(token, user)
      await new Promise(r => setTimeout(r, 4000))
      if (user.role === 'SUPER_ADMIN') navigate('/super/dashboard')
      else if (user.role === 'CENTER_ADMIN') navigate('/center/dashboard')
      else if (user.role === 'DISPATCHER') navigate('/dispatcher/desk')
      else if (user.role === 'HOSPITAL_ADMIN') navigate('/hospital/dashboard')
      else navigate('/')
    } catch (err) {
      await new Promise(r => setTimeout(r, 4000))
      setError('Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* LEFT — Logo faded */}
      <div
        className="hidden lg:flex w-1/2 border-r border-gray-800"
        style={{
          backgroundImage: `url(${logo})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.7,
        }}
      />

      {/* RIGHT */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-10">

        {/* TOP */}
        <div>
          <h1 className="text-white text-4xl font-bold mb-3 leading-tight">
            Lebanese Emergency<br />Rescue System
          </h1>
          <div className="w-20 h-1 bg-blue-500 mb-4 rounded-full" />
          <p className="text-gray-400 text-sm leading-relaxed">
            A national emergency response platform connecting citizens,
            dispatchers, and rescue teams across Lebanon in real time.
          </p>
        </div>

        {/* MIDDLE */}
        <div className="my-8 flex flex-col items-center">
          <form onSubmit={handleLogin} className="space-y-3 w-full max-w-sm">

            <h2 className="text-white text-2xl font-bold mb-2 text-center">
              Login Page
            </h2>

            <div>
              <label className="text-gray-400 text-sm font-medium mb-1 block">
                Email Address
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  color: '#ffffff',
                  caretColor: '#ffffff'
                }}
                onFocus={e => e.target.style.border = '3px solid #3b82f6'}
                onBlur={e => e.target.style.border = '1px solid #374151'}
                placeholder="Email"
                autoComplete="off"
                required
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm font-medium mb-1 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  color: '#ffffff',
                  caretColor: '#ffffff'
                }}
                onFocus={e => e.target.style.border = '3px solid #3b82f6'}
                onBlur={e => e.target.style.border = '1px solid #374151'}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-2 flex items-center gap-2"
                style={{
                  backgroundColor: 'rgba(127,29,29,0.5)',
                  border: '1px solid #991b1b'
                }}>
                <span className="text-red-400 text-sm">⚠️</span>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2.5 rounded-xl
                         transition-all duration-300 flex items-center justify-center gap-2 text-sm"
              style={loading ? {
                backgroundColor: '#6b7280',
                color: '#d1d5db',
                cursor: 'not-allowed',
              } : {
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(59,130,246,0.35)'
              }}
            >
              {loading ? (
                <span className="font-mono tracking-widest">
                  Logging in{dots}
                </span>
              ) : (
                <>
                  <span>Sign In</span>
                 
                </>
              )}
            </button>
          </form>
        </div>

        {/* BOTTOM: 3 stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: '24/7', label: 'Always Active' },
            { value: 'AI',   label: 'Powered' },
            { value: 'Live', label: 'Real-time' },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4
                         text-center animate-pulse"
              style={{ animationDelay: `${i * 0.4}s` }}
            >
              <div
                className="text-xl font-bold"
                style={{
                  color: '#ffffff',
                  textShadow: '0 0 10px #fff, 0 0 20px #fff, 0 0 40px rgba(255,255,255,0.4)'
                }}
              >
                {stat.value}
              </div>
              <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}