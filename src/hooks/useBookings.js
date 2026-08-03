import { useState, useEffect } from 'react'
import { format, parseISO, getDay } from 'date-fns'
import { sortRooms } from '../utils/roomSort'
import { slotsBetween } from '../utils/timeSlots'
import { dataService } from '../lib/dataService'
import {
  MOCK_ROOMS,
  MOCK_BOOKINGS,
  MOCK_COURSES,
  addBooking,
  updateBookingById,
  deleteBookingById,
  addCourse,
  updateCourseByCourseId,
  deleteCourseByCourseId,
} from '../lib/mockData'

export const useBookings = (selectedDate, user = null) => {
  const [bookings, setBookings] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data, error } = await dataService.from('rooms').select('id, room_number')
        if (error) throw error
        setRooms(sortRooms(data || []))
      } catch (err) {
        console.error('Error fetching rooms:', err)
        setRooms(sortRooms(MOCK_ROOMS))
      }
    }
    fetchRooms()
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const loadData = () => {
    try {
      setLoading(true)
      setError(null)

      const dateString = format(selectedDate, 'yyyy-MM-dd')

      // Filter mock bookings for the selected date, excluding hard-coded demo entries
      let bookingsData = MOCK_BOOKINGS.filter(b => b['Start date'] === dateString && b.created_by !== 'system')

      // Enrich with course status from MOCK_COURSES
      const courseIds = [...new Set(bookingsData.map(b => b['Course ID']).filter(Boolean))]
      if (courseIds.length > 0) {
        const courseMap = new Map(MOCK_COURSES.map(c => [c['Course ID'], c]))
        bookingsData = bookingsData.map(booking => {
          if (!booking['Course ID']) return booking
          const course = courseMap.get(booking['Course ID'])
          if (!course) return booking
          return {
            ...booking,
            courseStart: course['Start date'],
            courseEnd: course['End date'],
            courseStatus: course['Status']
          }
        })
      }

      setBookings(bookingsData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  const createBooking = async (bookingData) => {
    try {
      const toInsert = Array.isArray(bookingData) ? bookingData : [bookingData]
      const created = toInsert.map(b => addBooking(b))
      loadData()
      return { data: created, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const updateBooking = async (id, updates) => {
    try {
      const updated = updateBookingById(id, updates)
      loadData()
      return { data: updated ? [updated] : [], error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const deleteBooking = async (id) => {
    try {
      deleteBookingById(id)
      loadData()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const createCourse = async (courseData) => {
    try {
      const toInsert = Array.isArray(courseData) ? courseData : [courseData]
      const created = toInsert.map(c => addCourse(c))
      return { data: created, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const updateCourse = async (id, updates) => {
    try {
      const updated = updateCourseByCourseId(id, updates)
      return { data: updated ? [updated] : [], error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const deleteCourse = async (id) => {
    try {
      deleteCourseByCourseId(id)
      loadData()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const getAvailableRooms = async (startDate, startTime, endTime, bookingIdToExclude = null, endDate = null, courseIdToExclude = null) => {
    try {
      const startStr = typeof startDate === 'string' ? startDate : format(startDate, 'yyyy-MM-dd')
      const allRooms = rooms && rooms.length > 0 ? rooms : sortRooms(MOCK_ROOMS)

      let targetDay = null
      if (endDate) {
        targetDay = getDay(parseISO(startStr))
      }

      const requestedSlots = new Set(slotsBetween(startTime, endTime))
      const roomOccupiedSlots = new Map()

      MOCK_BOOKINGS.forEach(b => {
        if (b.created_by === 'system') return
        if (b['Start date'] !== startStr) {
          if (!endDate) return
          if (b['Start date'] < startStr || b['Start date'] > endDate) return
          const bDate = parseISO(b['Start date'])
          if (getDay(bDate) !== targetDay) return
        }

        if (bookingIdToExclude && String(b.id) === String(bookingIdToExclude)) return
        if (courseIdToExclude && b['Course ID'] === courseIdToExclude) return

        const occupiedByBooking = slotsBetween(b['Start time'], b['End time'])
        const hasConflict = occupiedByBooking.some(s => requestedSlots.has(s))
        if (hasConflict) {
          if (!roomOccupiedSlots.has(b.Room)) roomOccupiedSlots.set(b.Room, true)
        }
      })

      const occupiedRoomIds = roomOccupiedSlots

      return allRooms.filter(r =>
        !occupiedRoomIds.has(String(r.id)) &&
        !occupiedRoomIds.has(String(r.room_number)) &&
        !occupiedRoomIds.has(String(r.id).toLowerCase()) &&
        !occupiedRoomIds.has(String(r.room_number || '').toLowerCase())
      )
    } catch (error) {
      console.error('Error getting available rooms:', error)
      return []
    }
  }

  return {
    bookings,
    rooms,
    loading,
    createBooking,
    updateBooking,
    deleteBooking,
    createCourse,
    updateCourse,
    deleteCourse,
    getAvailableRooms,
    refresh: () => loadData(),
    error
  }
}
