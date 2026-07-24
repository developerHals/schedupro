import React, { useState, useEffect, useCallback } from 'react';
import { dataService } from '../../lib/dataService';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { 
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameDay, addDays, addMonths, subDays, subMonths, 
  isSameMonth, parseISO, getDay, startOfDay
} from 'date-fns';

const { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiRefreshCw, FiBell } = FiIcons;

const CourseCalendarView = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState('month'); // 'week' or 'month'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch unique Course IDs
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data, error } = await dataService
          .from('Courses')
          .select('"Course ID"')
          .order('Course ID', { ascending: true });
        
        if (error) throw error;

        // Filter unique IDs just in case
        const uniqueCourses = [...new Set(data.map(c => c['Course ID']).filter(Boolean))];
        setCourses(uniqueCourses);
        if (uniqueCourses.length > 0) {
          setSelectedCourseId(uniqueCourses[0]);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
    };

    fetchCourses();
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!selectedCourseId) return;

    setLoading(true);
    try {
      let start, end;

      if (viewType === 'month') {
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
      } else {
        start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
      }

      // Format as YYYY-MM-DD
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // 1. Get bookings for the selected course
      const { data: bookingsData, error } = await dataService
        .from('bookings')
        .select('"Course ID", "Course Name", "Start date", "Start time", "End time", "Tutor", "Room", "Notes"')
        .eq('"Course ID"', selectedCourseId)
        .gte('Start date', startStr)
        .lte('Start date', endStr);

      if (error) throw error;

      // 2. Get All Room details to map UUIDs to Room Numbers
      let roomsMap = {};
      const { data: roomsData } = await dataService
        .from('rooms')
        .select('id, room_number'); // Fetch all rooms to ensure we resolve everything
      
      if (roomsData) {
        roomsMap = roomsData.reduce((acc, r) => {
          // Prioritize room_number
          const label = r.room_number 
            ? (String(r.room_number).toLowerCase().includes('room') ? r.room_number : `Room ${r.room_number}`) 
            : 'Unnamed Room';
          acc[r.id] = label;
          return acc;
        }, {});
      }

      // 3. Get Course details for Start/End dates (self-lookup since we filtered by course)
      let courseDetails = null;
      const { data: courseData } = await dataService
        .from('Courses')
        .select('"Course ID", "Start date", "End date"')
        .eq('"Course ID"', selectedCourseId)
        .maybeSingle(); // Use maybeSingle as there might be multiple entries for same course ID (sessions), but we just need dates from one? 
                        // Actually, 'Courses' table has one row per session usually? Or is it one row per course?
                        // Based on NewCourseModal, it seems 'Courses' table stores sessions.
                        // However, the requirement says "Start date and End date of the course".
                        // Usually a course has a range. If 'Courses' has multiple rows, we might need min/max or just one.
                        // Let's stick to the logic in RoomCalendarView: 
                        // "const courseIds = [...new Set((bookingsData || []).map(b => b['Course ID'])..."
                        // It queries 'Courses' table by 'Course ID'.
      
      // We already know the Course ID, let's fetch its range.
      // If 'Courses' table has multiple rows for same ID, we might get any.
      // RoomCalendarView does: .in('Course ID', courseIds).
      // Let's do the same logic but for single ID.
      
      // Re-using logic from RoomCalendarView for consistency
      const { data: coursesData } = await dataService
          .from('Courses')
          .select('"Course ID", "Start date", "End date"')
          .eq('"Course ID"', selectedCourseId)
          .limit(1); // Just get one to grab dates? 
          // Wait, if a course spans multiple sessions, does it have one start/end date?
          // RoomCalendarView joins and puts it on the tile.
          // Let's assume fetching one record for the Course ID gives the correct course start/end.
      
      if (coursesData && coursesData.length > 0) {
          courseDetails = coursesData[0];
      }
      
      // Map 'bookings' data to component format
      const mappedData = (bookingsData || []).map(item => {
        // Resolve room name
        // The 'Room' field in bookings is a UUID.
        // We use the roomsMap to get the readable name.
        // If not in map, check if it's a UUID or a legacy string name
        const rawRoom = item['Room'];
        const isUUID = rawRoom && rawRoom.length === 36 && rawRoom.split('-').length === 5;
        const roomName = roomsMap[rawRoom] || (isUUID ? 'Unknown Room' : (rawRoom || 'Unknown Room'));

        return {
          id: item['Course ID'] + item['Start date'] + item['Start time'], // Generate a unique key if ID is missing
          date: item['Start date'],
          start_time: item['Start time'],
          end_time: item['End time'],
          course_code: item['Course ID'],
          course_name: item['Course Name'],
          tutor: item['Tutor'],
          room: roomName, 
          notes: item['Notes'],
          course_start: courseDetails ? courseDetails['Start date'] : null,
          course_end: courseDetails ? courseDetails['End date'] : null
        };
      });

      setBookings(mappedData);
    } catch (error) {
      console.error('Error fetching course bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, currentDate, viewType]);

  useEffect(() => {
    fetchBookings();

    // Subscribe to changes in 'bookings' table
    const channel = dataService
      .channel('course-calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      dataService.removeChannel(channel);
    };
  }, [fetchBookings]);

  const navigateDate = (direction) => {
    if (viewType === 'month') {
      setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'next' ? addDays(prev, 7) : subDays(prev, 7));
    }
  };

  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="appearance-none bg-white border border-gray-200 text-black py-2 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-blue-500 font-bold"
            style={{ color: 'black', minWidth: '200px' }}
            disabled={courses.length === 0}
          >
            {courses.length === 0 && <option>No courses available</option>}
            {courses.map(courseId => (
              <option key={courseId} value={courseId} className="text-black" style={{ color: 'black' }}>
                {courseId}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewType('week')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewType === 'week' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewType('month')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewType === 'month' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-all"
          >
            <SafeIcon icon={FiChevronLeft} className="h-5 w-5" />
          </button>
          <span className="px-4 font-bold text-gray-800 min-w-[140px] text-center">
            {format(currentDate, viewType === 'month' ? 'MMMM yyyy' : "'Week of' MMM d")}
          </span>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-all"
          >
            <SafeIcon icon={FiChevronRight} className="h-5 w-5" />
          </button>
        </div>
        <a
          href="/pomodoro"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100 group"
          title="Open Pomodoro Timer"
        >
          <SafeIcon icon={FiClock} className="h-4 w-4 group-hover:animate-pulse" />
        </a>
        <a
          href="/?view=notifications"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100 group"
          title="Open Notifications"
        >
          <SafeIcon icon={FiBell} className="h-4 w-4 group-hover:animate-swing" />
        </a>
        <button
          onClick={fetchBookings}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Refresh"
        >
          <SafeIcon icon={FiRefreshCw} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const renderMonthView = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px border-b border-gray-200">
          {days.map(day => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const dayBookings = bookings.filter(b => isSameDay(parseISO(b.date), day));
            
            return (
              <div 
                key={day.toString()} 
                className={`bg-white min-h-[120px] p-2 ${!isCurrentMonth ? 'bg-gray-50/50' : ''}`}
              >
                <div className={`text-sm font-bold mb-2 ${
                  isSameDay(day, new Date()) 
                    ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' 
                    : !isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1">
                  {dayBookings.map(booking => (
                    <div 
                      key={booking.id}
                      className="text-[10px] p-1.5 rounded bg-blue-50 border border-blue-100 text-blue-700 truncate hover:bg-blue-100 transition-colors"
                      title={`${booking.course_code} - ${booking.course_name} (${booking.start_time} - ${booking.end_time})`}
                    >
                      <div className="font-bold">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</div>
                      <div className="font-semibold truncate">{booking.course_code}</div>
                      <div className="truncate">{booking.course_name}</div>
                      <div className="truncate text-gray-600">{booking.room}</div>
                      <div className="truncate text-blue-500">{booking.tutor}</div>
                      {booking.course_start && booking.course_end && (
                        <div className="truncate text-[9px] text-gray-500">
                          {format(new Date(booking.course_start), 'dd/MM/yyyy')}-{format(new Date(booking.course_end), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    
    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map(day => {
          const dayBookings = bookings.filter(b => isSameDay(parseISO(b.date), day))
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

          return (
            <div key={day.toString()} className="flex flex-col space-y-3">
              <div className={`text-center p-3 rounded-xl border ${
                isSameDay(day, new Date()) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
              }`}>
                <div className={`text-xs font-bold uppercase ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-500'}`}>
                  {format(day, 'EEE')}
                </div>
                <div className={`text-lg font-black ${isSameDay(day, new Date()) ? 'text-blue-700' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </div>
              </div>

              <div className="space-y-2">
                {dayBookings.length > 0 ? (
                  dayBookings.map(booking => (
                    <div 
                      key={booking.id} 
                      className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center text-xs font-bold text-gray-500 mb-1">
                        <SafeIcon icon={FiClock} className="w-3 h-3 mr-1" />
                        {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                      </div>
                      <div className="font-bold text-blue-600 text-sm mb-0.5">
                        {booking.course_code}
                      </div>
                      <div className="text-xs text-gray-700 mb-0.5">
                        {booking.course_name}
                      </div>
                      <div className="text-xs text-gray-500 mb-0.5 flex items-center">
                        <SafeIcon icon={FiMapPin} className="w-3 h-3 mr-1" />
                        {booking.room}
                      </div>
                      {booking.tutor && (
                        <div className="text-[10px] text-gray-400 line-clamp-2">
                          {booking.tutor}
                        </div>
                      )}
                      {booking.course_start && booking.course_end && (
                        <div className="text-[10px] text-gray-400 mb-0.5">
                           {format(new Date(booking.course_start), 'dd/MM/yyyy')}-{format(new Date(booking.course_end), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 px-2 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-[10px] text-gray-400 font-medium">No bookings</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-full">
      {renderHeader()}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-2xl border border-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        viewType === 'month' ? renderMonthView() : renderWeekView()
      )}
    </div>
  );
};

export default CourseCalendarView;
