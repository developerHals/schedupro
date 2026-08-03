import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { learnerTrackService } from '../../lib/learnerTrackService';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { 
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameDay, addDays, addMonths, subDays, subMonths, 
  isSameMonth, parseISO, getDay, startOfDay
} from 'date-fns';

const { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiRefreshCw, FiUser, FiBell } = FiIcons;

const TutorCalendarView = () => {
  const [tutors, setTutors] = useState([]);
  const [selectedTutorName, setSelectedTutorName] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState('month'); // 'week' or 'month'
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Select the first tutor once the list is available
  useEffect(() => {
    if (!selectedTutorName && tutors.length > 0) {
      setSelectedTutorName(tutors[0]);
    }
  }, [tutors, selectedTutorName]);

  const fetchBookings = useCallback(async () => {
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

      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const sessions = await learnerTrackService.getSessions({ dateFrom: startStr, dateTo: endStr });

      const mapped = (sessions || []).map(session => ({
        id: `lt-${session.ID}`,
        date: session.Date ? session.Date.slice(0, 10) : '',
        start_time: session.StartTime || '',
        end_time: session.EndTime || '',
        course_code: session.CourseShortLabel || session.CourseLabel || 'LT',
        course_name: session.CourseTitle || 'Learner Track Session',
        tutor: session.TutorLabel || '',
        room: session.local_room_number || session.RoomLabel || '',
        notes: '',
        aims: '',
        curriculum_area: '',
        sessions: '',
        course_details: null,
        course_start: null,
        course_end: null
      }));

      setAllBookings(mapped);
      const tutorList = [...new Set(mapped.map(b => b.tutor).filter(Boolean))].sort();
      setTutors(tutorList);
    } catch (error) {
      console.error('Error fetching tutor sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewType]);

  const bookings = useMemo(() => {
    if (!selectedTutorName) return [];
    return allBookings.filter(b => b.tutor === selectedTutorName);
  }, [allBookings, selectedTutorName]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const navigateDate = (direction) => {
    if (viewType === 'month') {
      setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'next' ? addDays(prev, 7) : subDays(prev, 7));
    }
  };

  const calculateTotalHours = () => {
    const totalMinutes = bookings.reduce((acc, booking) => {
      const start = parseISO(`2000-01-01T${booking.start_time}`);
      const end = parseISO(`2000-01-01T${booking.end_time}`);
      // Simple difference in minutes
      const diff = (end.getTime() - start.getTime()) / (1000 * 60);
      return acc + (diff > 0 ? diff : 0);
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
  };

  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <select
            value={selectedTutorName}
            onChange={(e) => setSelectedTutorName(e.target.value)}
            className="appearance-none bg-white border border-gray-200 text-black py-2 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-blue-500 font-bold"
            style={{ color: 'black', minWidth: '200px' }}
            disabled={tutors.length === 0}
          >
            {tutors.length === 0 && <option>No tutors available</option>}
            {tutors.map(tutor => (
              <option key={tutor} value={tutor} className="text-black">
                {tutor}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <SafeIcon icon={FiIcons.FiChevronDown} className="h-4 w-4" />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-sm border border-blue-100 flex items-center">
            <SafeIcon icon={FiClock} className="w-4 h-4 mr-1.5" />
            {calculateTotalHours()}
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
      </div>

      <div className="flex items-center gap-4">
        <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm font-bold text-green-700">Live Tutors: {tutors.length}</span>
        </div>
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
                  {dayBookings.map((booking, idx) => (
                    <div 
                      key={`${booking.id}-${idx}`}
                      className="text-[10px] p-1.5 rounded bg-blue-50 border border-blue-100 text-blue-700 truncate hover:bg-blue-100 transition-colors group relative"
                      title={`${booking.course_code} - ${booking.course_name}
Time: ${booking.start_time} - ${booking.end_time}
Room: ${booking.room}
AIMs: ${booking.aims || 'N/A'}
Curriculum: ${booking.curriculum_area || 'N/A'}`}
                    >
                      <div className="font-bold">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</div>
                      <div className="font-semibold truncate">{booking.course_code}</div>
                      <div className="truncate">{booking.course_name}</div>
                      <div className="truncate text-blue-500">{booking.room}</div>
                      <div className="truncate text-gray-500">{booking.tutor}</div>
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
                <div className={`text-xl font-bold mt-1 ${isSameDay(day, new Date()) ? 'text-blue-700' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </div>
              </div>

              <div className="space-y-2">
                {dayBookings.map((booking, idx) => (
                  <div 
                    key={`${booking.id}-${idx}`}
                    className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center text-xs font-bold text-gray-500 mb-2">
                      <SafeIcon icon={FiClock} className="w-3 h-3 mr-1" />
                      {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                    </div>
                    <div className="font-bold text-sm text-gray-900 mb-1">{booking.course_name}</div>
                    <div className="text-xs text-blue-600 font-medium mb-1">{booking.course_code}</div>
                    <div className="flex items-center text-xs text-gray-500">
                      <SafeIcon icon={FiMapPin} className="w-3 h-3 mr-1" />
                      {booking.room}
                    </div>
                    {booking.tutor && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          {booking.tutor}
                        </div>
                    )}
                    {booking.course_start && booking.course_end && (
                         <div className="text-[10px] text-gray-400 mt-0.5">
                           {format(new Date(booking.course_start), 'dd/MM/yyyy')}-{format(new Date(booking.course_end), 'dd/MM/yyyy')}
                         </div>
                    )}
                    {booking.aims && (
                       <div className="mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-500">
                         <span className="font-semibold">AIMs:</span> {booking.aims}
                       </div>
                    )}
                  </div>
                ))}
                {dayBookings.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs border-2 border-dashed border-gray-100 rounded-xl">
                    No classes
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
    <div className="p-6">
      {renderHeader()}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        viewType === 'month' ? renderMonthView() : renderWeekView()
      )}
    </div>
  );
};

export default TutorCalendarView;
