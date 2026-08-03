import React, { useState, useEffect, Suspense, lazy } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useBookings } from './hooks/useBookings'
import Header from './components/Layout/Header'
import CalendarGrid from './components/Calendar/CalendarGrid' // Keep default view eager
import TodayView from './components/Today/TodayView'
import BookRoomModal from './components/Modals/BookRoomModal'
import NewCourseModal from './components/Modals/NewCourseModal'
import { dataService } from './lib/dataService'
import { format } from 'date-fns'
import { Toaster, toast } from 'react-hot-toast'
import './App.css'

// Lazy load other views
const RoomCalendarView = lazy(() => import('./components/Calendar/RoomCalendarView'))
const CourseCalendarView = lazy(() => import('./components/Calendar/CourseCalendarView'))
const TutorCalendarView = lazy(() => import('./components/Calendar/TutorCalendarView'))
const DatabaseView = lazy(() => import('./components/Database/DatabaseView'))
const CourseView = lazy(() => import('./components/Database/CourseView'))
const BackupCoursesView = lazy(() => import('./components/Database/BackupCoursesView'))
const DeletedCoursesView = lazy(() => import('./components/Database/DeletedCoursesView'))
const OurCoursesView = lazy(() => import('./components/OurCourses/OurCoursesView'))
const DashboardView = lazy(() => import('./components/Dashboard/DashboardView'))
const TasksBoardView = lazy(() => import('./components/TasksBoard/TasksBoardView'))
const TailoredLearningView = lazy(() => import('./components/TailoredLearning/TailoredLearningView'))
const LearningAimsView = lazy(() => import('./components/LearningAims/LearningAimsView'))
const TutorsView = lazy(() => import('./components/Tutors/TutorsView'))
const CMsView = lazy(() => import('./components/CMs/CMsView'))
const PomodoroTimer = lazy(() => import('./components/Pomodoro/PomodoroTimer'))
const FeesView = lazy(() => import('./components/Fees/FeesView'))
const CostingView = lazy(() => import('./components/Costing/CostingView'))
const NotificationsView = lazy(() => import('./components/Database/NotificationsView'))
const TermDatesView = lazy(() => import('./components/TermDates/TermDatesView'))
const IncomeReportView = lazy(() => import('./components/Reports/IncomeReportView'))
const TutorDashboardView = lazy(() => import('./components/Reports/TutorDashboardView'))
const RoomsDashboardView = lazy(() => import('./components/Rooms/RoomsDashboardView'))
const UsersView = lazy(() => import('./components/Users/UsersView'))

import ConfirmationModal from './components/Modals/ConfirmationModal'
import RequestChangeModal from './components/Modals/RequestChangeModal'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Failed to load view. Try again.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const VIEW_ROUTES = {
  calendar: 'timetable',
  courses: 'courses',
  'course-calendar': 'calendar',
  'room-calendar': 'rooms',
  'tutor-calendar': 'tutors',
  database: 'sessions',
  'our-courses': 'ourcourses',
  'term-dates': 'dates',
  'approve-bookings': 'bookings',
  'tailored-learning': 'tailored-learning',
  'learning-aims': 'learning-aims',
  tutors: 'manage-tutors',
  cms: 'cms',
  'deleted-courses': 'deleted-courses',
  'backup-courses': 'backup-courses',
  dashboard: 'dashboard',
  'tasks-board': 'tasks',
  pomodoro: 'pomodoro',
  fees: 'fees',
  users: 'users',
  costing: 'costing',
  notifications: 'notifications',
  'income-report': 'income-report',
  'tutor-dashboard': 'tutor-dashboard',
  'rooms-dashboard': 'rooms-dashboard',
}
const ROUTE_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_ROUTES).map(([view, slug]) => [slug, view])
)

function AppContent() {
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '')
    const slug = path.replace(/^\//, '')
    if (ROUTE_TO_VIEW[slug]) return ROUTE_TO_VIEW[slug]

    const params = new URLSearchParams(window.location.search)
    return params.get('view') || 'today'
  })

  useEffect(() => {
    // Update URL when view changes
    if (currentView === 'today') {
      window.history.pushState({}, '', '/');
    } else if (VIEW_ROUTES[currentView]) {
      window.history.pushState({}, '', `/${VIEW_ROUTES[currentView]}`);
    } else {
      const params = new URLSearchParams(window.location.search);
      params.set('view', currentView);
      window.history.pushState({}, '', `?${params.toString()}`);
    }
  }, [currentView]);

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showBookRoomModal, setShowBookRoomModal] = useState(false)
  const [bookingToEdit, setBookingToEdit] = useState(null)
  const [initialBookingData, setInitialBookingData] = useState(null)
  const [showNewCourseModal, setShowNewCourseModal] = useState(false)
  const [courseToEdit, setCourseToEdit] = useState(null)
  const [showBookingSuccessModal, setShowBookingSuccessModal] = useState(false)
  const [showRequestChangeModal, setShowRequestChangeModal] = useState(false)
  const [requestChangeBooking, setRequestChangeBooking] = useState(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [bookingToApprove, setBookingToApprove] = useState(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  
  const { user, profile, isSuperuser, isAdmin, unauthorized, loading: authLoading } = useAuth()
  const {
    bookings,
    rooms,
    loading: bookingsLoading,
    createBooking,
    updateBooking,
    deleteBooking,
    createCourse,
    updateCourse,
    deleteCourse,
    getAvailableRooms,
    refresh,
    error: bookingsError
  } = useBookings(selectedDate, user)

  const handleBookRoom = React.useCallback(async (bookingData) => {
    try {
      // Map BookRoomModal data to 'bookings' table schema
      // BookRoomModal sends: { course_code, notes, date, start_time, end_time, room_id }
      // bookings table needs: "Course ID", "Notes", "Start date", "Start time", "End time", "Room"
      
      const room = rooms.find(r => r.id === bookingData.room_id);
      // Room column now expects UUID
      // const roomName = room ? (room.room_number || room.name) : '';

      const superuser = isSuperuser()
      const admin = profile?.role === 'admin' || superuser
      const mappedData = {
        'Course ID': bookingData.bookingType,
        'Course Name': bookingData.notes || bookingData.bookingType,
        'Notes': bookingData.bookingType,
        'Lesson Number': (superuser || admin) ? 'Approved' : 'Pending',
        'Status': (superuser || admin) ? 'Approved' : 'Pending',
        'Tutor': bookingData.tutor,
        'Start date': bookingData.date,
        'End date': bookingData.date, // Single day
        'Start time': bookingData.start_time,
        'End time': bookingData.end_time,
        'Room': bookingData.room_id, // Use UUID
        'Day Details': format(new Date(bookingData.date), 'EEEE') + ' - ' + bookingData.session_type,
        'created_by': user?.email || 'system', // Track who created this booking
        fees: bookingData.fees !== '' && bookingData.fees !== null && bookingData.fees !== undefined ? parseFloat(bookingData.fees) : null,
      };

      const { data, error } = await createBooking(mappedData)
      if (error) throw error
      setShowBookRoomModal(false)
      setBookingToEdit(null)
      if (!superuser && !admin) setShowBookingSuccessModal(true)
      return { success: true }
    } catch (error) {
      console.error('Error creating booking:', error)
      return { success: false, error }
    }
  }, [createBooking, rooms, user, profile, isSuperuser]);

  const handleRequestBooking = React.useCallback(async (bookingData) => {
    try {
      const { error } = await createBooking({
        'Course ID': bookingData.bookingType,
        'Course Name': bookingData.notes || bookingData.bookingType,
        'Notes': bookingData.bookingType,
        'Lesson Number': 'Pending',
        'Status': 'Pending',
        'Tutor': bookingData.tutor,
        'Start date': bookingData.date,
        'End date': bookingData.date,
        'Start time': bookingData.start_time,
        'End time': bookingData.end_time,
        'Room': null,
        'Day Details': format(new Date(bookingData.date), 'EEEE') + ' - request',
        'created_by': user?.email || 'system',
        fees: null,
      })
      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Error submitting booking request:', error)
      return { success: false, error }
    }
  }, [createBooking, user])

  const handleApproveWithRoom = React.useCallback((booking) => {
    setBookingToApprove(booking)
    setShowApproveModal(true)
  }, [])

  const handleEditBooking = React.useCallback((booking) => {
    if (isSuperuser()) {
      setBookingToEdit(booking)
      setShowBookRoomModal(true)
    } else {
      setRequestChangeBooking(booking);
      setShowRequestChangeModal(true);
    }
  }, [isSuperuser]);

  const handleEditCourse = React.useCallback(async (course) => {
    try {
      const { data: courseRows, error: courseError } = await dataService
        .from('Courses')
        .select('*')
        .eq('Course ID', course['Course ID']);
      
      if (courseError) throw courseError;

      const { data: bookingRows, error: bookingError } = await dataService
          .from('bookings')
          .select('*')
          .eq('Course ID', course['Course ID']);
      
      if (bookingError) throw bookingError;

      setCourseToEdit({ 
          courses: courseRows || [course], 
          bookings: bookingRows || [] 
      });
      setShowNewCourseModal(true);
    } catch (err) {
      console.error("Error fetching course details:", err);
      setCourseToEdit(course);
      setShowNewCourseModal(true);
    }
  }, []);

  const handleCalendarTileEdit = React.useCallback((booking) => {
    if (booking?.courseStart) {
      handleEditCourse(booking);
      return;
    }

    handleEditBooking(booking);
  }, [handleEditBooking, handleEditCourse]);

  const handleRequestChangeSubmit = React.useCallback(async (bookingId, comment) => {
    try {
      const { error } = await updateBooking(bookingId, {
        'Comments': comment,
        'Lesson Number': 'Pending',
        'Status': 'Pending',
      });
      if (error) throw error;
      
      setShowRequestChangeModal(false);
      setRequestChangeBooking(null);
      setShowBookingSuccessModal(true);
    } catch (error) {
      console.error('Error submitting change request:', error);
      // You might want to show an error toast here
    }
  }, [updateBooking]);

  const handleSaveCourse = React.useCallback(async (courseData) => {
    try {
      let result;
      // When regenerating sessions (e.g. changing dates), NewCourseModal returns an array.
      // We need to extract the single course object for the Courses table update.
      const coursePayload = Array.isArray(courseData) ? courseData[0] : courseData;
      
      if (courseToEdit) {
        // Update existing course
        // STRATEGY: Delete all existing sessions (Courses & Bookings) and recreate.
        // This ensures all sessions are updated and any new/removed sessions are handled.
        
        // Use the ORIGINAL Course ID for deletion, in case the user changed it in the form
        // Handle new data structure { courses: [], bookings: [] }
        let courseIdToDelete;
        if (courseToEdit.courses && Array.isArray(courseToEdit.courses) && courseToEdit.courses.length > 0) {
             courseIdToDelete = courseToEdit.courses[0]['Course ID'];
        } else {
             courseIdToDelete = courseToEdit['Course ID'];
        }
        
        if (!courseIdToDelete) {
             console.error("Could not determine Course ID to delete");
             // Fallback to courseData if available? No, that's the NEW id.
             // If we can't find ID, we might fail to delete.
             // Try to find from bookings?
             if (courseToEdit.bookings && courseToEdit.bookings.length > 0) {
                 courseIdToDelete = courseToEdit.bookings[0]['Course ID'];
             }
        }
        
        if (courseIdToDelete) {
             // 1. Delete existing course sessions
             const { error: deleteError } = await deleteCourse(courseIdToDelete);
             if (deleteError) throw deleteError;
        }

        // 2. Create new course sessions
        // createCourse handles array of sessions
        result = await createCourse(courseData);
      } else {
        // Create new course
        // createCourse can handle array (for bulk insert if needed) or object
        result = await createCourse(courseData);
      }

      const { data, error } = result;
      if (error) throw error
      
      // Switch view to the booking date so user can see the new/updated course
      const firstBooking = Array.isArray(courseData) ? courseData[0] : courseData
      if (firstBooking?.date) {
        const [year, month, day] = firstBooking.date.split('-').map(Number)
        setSelectedDate(new Date(year, month - 1, day))
      } else if (firstBooking?.Date) {
         // Handle 'Date' field from Courses table
         const [year, month, day] = firstBooking.Date.split('-').map(Number)
         setSelectedDate(new Date(year, month - 1, day))
      }
      
      setCourseToEdit(null);
      return { success: true }
    } catch (error) {
      console.error('Error saving course:', error)
      return { success: false, error }
    }
  }, [courseToEdit, deleteCourse, createCourse]);

  const handleBookingUpdate = React.useCallback(async (id, updates) => {
    try {
      const { data, error } = await updateBooking(id, updates)
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error updating booking:', error)
      return { success: false, error }
    }
  }, [updateBooking]);

  const handleDuplicateItem = React.useCallback(async (bookingItem) => {
    if (bookingItem?.courseStart) {
      // It's a course tile - open edit course modal without dates/room pre-filled
      try {
        const { data: courseRows, error: courseError } = await dataService
          .from('Courses')
          .select('*')
          .eq('Course ID', bookingItem['Course ID']);
        if (courseError) throw courseError;

        const { data: bookingRows, error: bookingError } = await dataService
          .from('bookings')
          .select('*')
          .eq('Course ID', bookingItem['Course ID']);
        if (bookingError) throw bookingError;

        // Clear the Course ID, dates, and room so user must fill them in
        const clearedCourseRows = (courseRows || []).map(r => ({
          ...r,
          'Course ID': '',
          'Start date': '',
          'End date': ''
        }));
        const clearedBookingRows = (bookingRows || []).map(r => ({
          ...r,
          id: undefined,
          'Start date': '',
          'End date': '',
          'Room': ''
        }));

        setCourseToEdit(null); // Ensure treated as new
        setCourseToEdit({ courses: clearedCourseRows, bookings: clearedBookingRows, isDuplicate: true });
        setShowNewCourseModal(true);
      } catch (err) {
        console.error('Error duplicating course:', err);
      }
    } else {
      // It's a plain booking - open booking modal without date/room pre-filled
      setBookingToEdit(null);
      setInitialBookingData({
        bookingType: bookingItem['Course ID'] || '',
        notes: bookingItem['Course Name'] || '',
        tutor: bookingItem['Tutor'] || '',
        start_time: bookingItem['Start time'] || '09:00',
        end_time: bookingItem['End time'] || '12:00',
        date: '',
        room_id: ''
      });
      setShowBookRoomModal(true);
    }
  }, []);

  const handleDuplicateCourse = React.useCallback(async (course) => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      const { data: courseRows, error: courseError } = await dataService
        .from('Courses')
        .select('*')
        .eq('Course ID', course['Course ID']);
      if (courseError) throw courseError;

      const { data: bookingRows, error: bookingError } = await dataService
        .from('bookings')
        .select('*')
        .eq('Course ID', course['Course ID']);
      if (bookingError) throw bookingError;

      // Prepare duplicated course rows with new values
      const duplicatedCourseRows = (courseRows || []).map(r => ({
        ...r,
        id: undefined, // Remove ID so Backend creates new records
        'Course ID': `Copy of ${course['Course ID']}`,
        'Status': 'Pending',
        'Start date': todayStr,
        'End date': '', // User will set this
        'Room': 'NR',
        'Room Capacity': '',
        'Actual Enrolments': 0,
        'Actual Completions': 0,
        'Comments': ''
      }));
      
      // Prepare duplicated booking rows with new values
      const duplicatedBookingRows = (bookingRows || []).map(r => ({
        ...r,
        id: undefined, // Remove ID so Backend creates new records
        'Course ID': `Copy of ${course['Course ID']}`,
        'Start date': todayStr,
        'End date': '', // User will set this
        'Room': 'NR',
        'Date': null,
        'created_at': today.toISOString()
      }));

      setCourseToEdit(null);
      // Pass as isDuplicate so modal knows to show "New Course" instead of "Edit Course"
      setCourseToEdit({ 
        courses: duplicatedCourseRows, 
        bookings: duplicatedBookingRows, 
        isDuplicate: true 
      });
      setShowNewCourseModal(true);
      
      toast.success(`Course "${course['Course ID']}" ready to duplicate as "Copy of ${course['Course ID']}"`);
    } catch (err) {
      console.error('Error duplicating course:', err);
      toast.error('Failed to duplicate course');
    }
  }, []);

  const handleBookingDelete = React.useCallback(async (id) => {
    try {
      const { error } = await deleteBooking(id)
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting booking:', error)
      return { success: false, error }
    }
  }, [deleteBooking]);

  const handleCourseDelete = React.useCallback(async (id) => {
    try {
      const { error } = await deleteCourse(id)
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting course:', error)
      return { success: false, error }
    }
  }, [deleteCourse]);

  const handleLogout = () => {
    window.location.href = '/api/auth/logout'
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access denied</h2>
          <p className="text-gray-600 mb-6">
            Sorry, you do not have access to this application. Please contact the administrator to request access.
          </p>
          <a
            href="/api/auth/logout"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Sign out
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Header
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        onViewChange={setCurrentView}
        currentView={currentView}
        onBookRoom={() => {
          setBookingToEdit(null)
          setShowBookRoomModal(true)
        }}
        onRequestBooking={() => setShowRequestModal(true)}
        onNewCourse={() => setShowNewCourseModal(true)}
        onLogout={handleLogout}
      />

      <main className="w-full px-2 sm:px-6 lg:px-10 py-6">
        <ConfirmationModal
          isOpen={showBookingSuccessModal}
          onClose={() => setShowBookingSuccessModal(false)}
          title="Important"
          message="Booking submitted successfully. This booking is provisional and will be confirmed within 1 working day."
          confirmLabel="OK"
        />
        {bookingsError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center shadow-sm">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Connection Error</p>
              <p className="text-sm">{bookingsError.toString()}</p>
            </div>
            <button 
              onClick={() => refresh()}
              className="ml-auto px-3 py-1 bg-white text-red-600 text-sm font-medium rounded hover:bg-red-50 border border-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {bookingsLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              {currentView === 'today' ? (
                <TodayView selectedDate={selectedDate} />
              ) : currentView === 'calendar' ? (
                <CalendarGrid
                  bookings={bookings}
                  rooms={rooms}
                  selectedDate={selectedDate}
                  onBookingUpdate={handleBookingUpdate}
                  onBookingDelete={handleBookingDelete}
                  getAvailableRooms={getAvailableRooms}
                  onEditBooking={handleCalendarTileEdit}
                  onRefresh={refresh}
                  onNewBooking={(roomId, sessionType, date) => {
                    let start = '09:00';
                    let end = '12:00';
                    if (sessionType === 'afternoon') { start = '13:00'; end = '16:00'; }
                    if (sessionType === 'evening') { start = '18:00'; end = '21:00'; }
                    
                    setInitialBookingData({
                      room_id: roomId,
                      date: format(date, 'yyyy-MM-dd'),
                      start_time: start,
                      end_time: end
                    });

                    if (isSuperuser() || isAdmin()) {
                      setShowBookRoomModal(true);
                    } else {
                      setShowRequestModal(true);
                    }
                  }}
                  onNewCourse={() => {
                    setCourseToEdit(null);
                    setShowNewCourseModal(true);
                  }}
                  onDuplicate={handleDuplicateItem}
                />
              ) : currentView === 'database' || currentView === 'approve-bookings' ? (
                <DatabaseView
                  user={user}
                  onBookingUpdate={handleBookingUpdate}
                  onBookingDelete={handleBookingDelete}
                  viewMode={currentView === 'approve-bookings' ? 'approve-bookings' : 'database'}
                  onRefresh={refresh}
                  onApproveWithRoom={handleApproveWithRoom}
                />
              ) : currentView === 'courses' ? (
                <CourseView 
                  user={user}
                  onEditCourse={handleEditCourse} 
                  onDeleteCourse={(course) => handleCourseDelete(course['Course ID'])}
                  onDuplicateCourse={handleDuplicateCourse}
                />
              ) : currentView === 'tailored-learning' ? (
                <TailoredLearningView />
              ) : currentView === 'learning-aims' ? (
                <LearningAimsView />
              ) : currentView === 'tutors' ? (
                <TutorsView />
              ) : currentView === 'cms' ? (
                <CMsView />
              ) : currentView === 'deleted-courses' ? (
                <DeletedCoursesView user={user} />
              ) : currentView === 'backup-courses' ? (
                <BackupCoursesView user={user} />
              ) : currentView === 'dashboard' ? (
                <DashboardView />
              ) : currentView === 'tasks-board' ? (
                <TasksBoardView />
              ) : currentView === 'our-courses' ? (
                <OurCoursesView />
              ) : currentView === 'pomodoro' ? (
                <PomodoroTimer />
              ) : currentView === 'fees' ? (
                <FeesView />
              ) : currentView === 'users' ? (
                <ErrorBoundary>
                  <Suspense fallback={<div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div></div>}>
                    <UsersView />
                  </Suspense>
                </ErrorBoundary>
              ) : currentView === 'costing' ? (
                <CostingView />
              ) : currentView === 'notifications' ? (
                <NotificationsView />
              ) : currentView === 'income-report' ? (
                <IncomeReportView />
              ) : currentView === 'tutor-dashboard' ? (
                <TutorDashboardView />
              ) : currentView === 'rooms-dashboard' ? (
                <RoomsDashboardView />
              ) : currentView === 'term-dates' ? (
                <TermDatesView />
              ) : currentView === 'course-calendar' ? (
                <CourseCalendarView selectedDate={selectedDate} onDateChange={setSelectedDate} />
              ) : currentView === 'tutor-calendar' ? (
                <TutorCalendarView selectedDate={selectedDate} onDateChange={setSelectedDate} />
              ) : (
                <RoomCalendarView rooms={rooms} selectedDate={selectedDate} onDateChange={setSelectedDate} />
              )}
            </Suspense>
          </ErrorBoundary>
        )}
      </main>

      <BookRoomModal 
        isOpen={showBookRoomModal} 
        onClose={() => {
          setShowBookRoomModal(false)
          setBookingToEdit(null)
          setInitialBookingData(null)
        }} 
        onSubmit={handleBookRoom}
        onEdit={async (id, data) => {
          const { error } = await updateBooking(id, {
            'Course ID': data.bookingType,
            'Course Name': data.notes || data.bookingType,
            'Notes': data.bookingType,
            'Tutor': data.tutor,
            'Start date': data.date,
            'Start time': data.start_time,
            'End time': data.end_time,
            'Room': data.room_id,
            'Day Details': format(new Date(data.date), 'EEEE') + ' - ' + data.session_type,
            fees: data.fees !== '' && data.fees !== null && data.fees !== undefined ? parseFloat(data.fees) : null,
            // Track who last edited this booking (for approval tracking)
            'approved_by': user?.email || 'system',
          })
          if (error) {
             console.error('Error updating booking:', error)
             alert('Failed to update booking')
          } else {
             setShowBookRoomModal(false)
             setBookingToEdit(null)
             // Superuser edits close silently; non-superuser edits show confirmation
          }
        }}
        getAvailableRooms={getAvailableRooms}
        bookingToEdit={bookingToEdit}
        initialValues={initialBookingData}
        allRooms={rooms}
        isSuperuserMode={isSuperuser()}
      />

      <NewCourseModal
        isOpen={showNewCourseModal}
        onClose={() => {
          setShowNewCourseModal(false);
          setCourseToEdit(null);
        }}
        onSubmit={handleSaveCourse}
        initialData={courseToEdit}
        getAvailableRooms={getAvailableRooms}
      />

      <RequestChangeModal
        isOpen={showRequestChangeModal}
        onClose={() => {
          setShowRequestChangeModal(false);
          setRequestChangeBooking(null);
        }}
        onSubmit={handleRequestChangeSubmit}
        booking={requestChangeBooking}
      />

      {/* External booking request modal — visible to everyone, requestMode greys out room/fee */}
      <BookRoomModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false)
          setInitialBookingData(null)
        }}
        onSubmit={handleRequestBooking}
        getAvailableRooms={getAvailableRooms}
        allRooms={rooms}
        initialValues={initialBookingData}
        requestMode={true}
      />

      {/* Approve modal — superuser assigns room & fee to a pending request */}
      <BookRoomModal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false)
          setBookingToApprove(null)
        }}
        bookingToEdit={bookingToApprove}
        onEdit={async (id, data) => {
          const { error } = await updateBooking(id, {
            'Course ID': data.bookingType,
            'Course Name': data.notes || data.bookingType,
            'Notes': data.bookingType,
            'Tutor': data.tutor,
            'Start date': data.date,
            'Start time': data.start_time,
            'End time': data.end_time,
            'Room': data.room_id,
            'Day Details': format(new Date(data.date), 'EEEE') + ' - ' + (data.session_type || 'booking'),
            fees: data.fees !== '' && data.fees !== null && data.fees !== undefined ? parseFloat(data.fees) : null,
            'Lesson Number': 'Approved',
            'Status': 'Approved',
            'approved_by': user?.email || 'system', // Track who approved this booking
          })
          if (error) {
            console.error('Error approving booking:', error)
            alert('Failed to approve booking')
          } else {
            setShowApproveModal(false)
            setBookingToApprove(null)
          }
        }}
        getAvailableRooms={getAvailableRooms}
        allRooms={rooms}
        isSuperuserMode={true}
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
