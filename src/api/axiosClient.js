import axios from 'axios'

const axiosClient = axios.create({
  baseURL: 'https://lers-backend.onrender.com/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Attach token to every request
axiosClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — redirect to login
axiosClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default axiosClient