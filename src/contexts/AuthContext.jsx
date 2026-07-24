import React, { createContext, useContext } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Public guest session: no edit/delete permissions and no signed-in user UI.
const guestProfile = { id: 'guest', email: 'guest@example.com', role: 'guest', full_name: 'Guest' }

export const AuthProvider = ({ children }) => {
  const isSuperuser = () => false
  const isAdmin = () => false
  const isCM = () => false
  const canEditBookings = () => false
  const canEditBooking = () => false
  const canDeleteBooking = () => false

  const value = {
    user: null,
    profile: guestProfile,
    loading: false,
    isSuperuser,
    isAdmin,
    isCM,
    canEditBookings,
    canEditBooking,
    canDeleteBooking,
    isPasswordRecovery: false,
    clearPasswordRecovery: () => {},
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}