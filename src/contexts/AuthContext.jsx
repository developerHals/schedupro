import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const guestProfile = { id: 'guest', email: 'guest@example.com', role: 'guest', full_name: 'Guest' }

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(guestProfile)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const json = await res.json()
        if (json.data?.user) {
          const u = json.data.user
          setUser(u)
          setProfile({
            id: u.id,
            email: u.email,
            role: u.role?.toLowerCase() || 'guest',
            full_name: u.full_name || u.email,
            status: u.status || 'active',
            date_created: u.date_created,
          })
        }
      } catch (err) {
        console.error('Auth fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMe()
  }, [])

  const role = profile?.role || 'guest'
  const isActive = profile?.status === 'active'
  const isSuperuser = () => isActive && role === 'superuser'
  const isAdmin = () => isActive && (role === 'admin' || role === 'superuser')
  const isCM = () => isActive && (role === 'cm' || role === 'curriculum manager' || isAdmin())
  const canEditBookings = () => isAdmin() || isCM()
  const canEditBooking = () => isAdmin() || isCM()
  const canDeleteBooking = () => isAdmin() || isCM()

  const value = {
    user,
    profile,
    loading,
    isSuperuser,
    isAdmin,
    isCM,
    canEditBookings,
    canEditBooking,
    canDeleteBooking,
    isPasswordRecovery,
    setIsPasswordRecovery,
    clearPasswordRecovery: () => setIsPasswordRecovery(false),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}