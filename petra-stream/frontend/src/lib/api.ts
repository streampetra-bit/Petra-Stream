import axios from 'axios'
import { AUTH_TOKEN_KEY, clearAuth } from './auth'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 8000
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearAuth()
    }
    return Promise.reject(err)
  }
)

export default client
