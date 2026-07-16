import axios from 'axios'

// All API calls go to our own Vercel serverless functions — never directly to Baserow.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Intercept responses globally for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? ''
      // Don't redirect on the session-check endpoint — AuthContext handles that gracefully
      const isSessionCheck = url.includes('/auth/me') || url.includes('/auth/login')
      if (!isSessionCheck) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
