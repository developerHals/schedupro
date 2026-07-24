import { format } from 'date-fns';

// Shared in-memory mock data store so the timetable renders without Backend.

const today = new Date();
const todayStr = format(today, 'yyyy-MM-dd');
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

let nextBookingId = 100;
let nextRoomId = 10;

export const MOCK_ROOMS = [
  { id: 'r1', room_number: '1', name: 'Room 1', color: 'blue' },
  { id: 'r2', room_number: '2', name: 'Room 2', color: 'green' },
  { id: 'r3', room_number: '3', name: 'Room 3', color: 'purple' },
  { id: 'r4', room_number: 'IT', name: 'IT Suite', color: 'orange' }
];

export const MOCK_BOOKINGS = [
  {
    id: 1,
    'Course ID': 'MATH-101',
    'Course Name': 'Mathematics GCSE',
    'Notes': 'Mathematics GCSE',
    'Lesson Number': 'Approved',
    'Tutor': 'A. Smith',
    'Start date': todayStr,
    'End date': todayStr,
    'Start time': '09:00',
    'End time': '12:00',
    'Room': 'r1',
    'Day Details': format(today, 'EEEE') + ' - morning',
    'created_by': 'system',
    'approved_by': 'system',
    'fees': null,
    courseStart: todayStr,
    courseEnd: todayStr,
    courseStatus: 'Approved'
  },
  {
    id: 2,
    'Course ID': 'ENG-201',
    'Course Name': 'English Literature',
    'Notes': 'English Literature',
    'Lesson Number': 'Approved',
    'Tutor': 'B. Jones',
    'Start date': todayStr,
    'End date': todayStr,
    'Start time': '13:00',
    'End time': '16:00',
    'Room': 'r2',
    'Day Details': format(today, 'EEEE') + ' - afternoon',
    'created_by': 'system',
    'approved_by': 'system',
    'fees': null,
    courseStart: todayStr,
    courseEnd: todayStr,
    courseStatus: 'Approved'
  },
  {
    id: 3,
    'Course ID': 'SCI-301',
    'Course Name': 'Combined Science',
    'Notes': 'Combined Science',
    'Lesson Number': 'Approved',
    'Tutor': 'C. Brown',
    'Start date': tomorrowStr,
    'End date': tomorrowStr,
    'Start time': '09:30',
    'End time': '12:30',
    'Room': 'r3',
    'Day Details': format(tomorrow, 'EEEE') + ' - morning',
    'created_by': 'system',
    'approved_by': 'system',
    'fees': null,
    courseStart: tomorrowStr,
    courseEnd: tomorrowStr,
    courseStatus: 'Approved'
  }
];

export const MOCK_COURSES = [
  {
    id: 'c1',
    'Course ID': 'MATH-101',
    'Course Name': 'Mathematics GCSE',
    Status: 'Approved',
    'Start date': todayStr,
    'End date': todayStr
  },
  {
    id: 'c2',
    'Course ID': 'ENG-201',
    'Course Name': 'English Literature',
    Status: 'Approved',
    'Start date': todayStr,
    'End date': todayStr
  },
  {
    id: 'c3',
    'Course ID': 'SCI-301',
    'Course Name': 'Combined Science',
    Status: 'Approved',
    'Start date': tomorrowStr,
    'End date': tomorrowStr
  }
];

export function getBookingsForDate(dateStr) {
  return MOCK_BOOKINGS.filter(b => b['Start date'] === dateStr);
}

export function getAllRooms() {
  return MOCK_ROOMS;
}

export function getRoomById(roomId) {
  return MOCK_ROOMS.find(r => r.id === roomId || String(r.room_number) === String(roomId));
}

export function addBooking(booking) {
  const id = booking.id || ++nextBookingId;
  const newBooking = { ...booking, id };
  MOCK_BOOKINGS.push(newBooking);
  return newBooking;
}

export function updateBookingById(id, updates) {
  const idx = MOCK_BOOKINGS.findIndex(b => String(b.id) === String(id));
  if (idx === -1) return null;
  MOCK_BOOKINGS[idx] = { ...MOCK_BOOKINGS[idx], ...updates };
  return MOCK_BOOKINGS[idx];
}

export function deleteBookingById(id) {
  const idx = MOCK_BOOKINGS.findIndex(b => String(b.id) === String(id));
  if (idx === -1) return false;
  MOCK_BOOKINGS.splice(idx, 1);
  return true;
}

export function addCourse(course) {
  const id = course.id || `c${++nextRoomId}`;
  const newCourse = { ...course, id };
  MOCK_COURSES.push(newCourse);
  return newCourse;
}

export function updateCourseByCourseId(courseId, updates) {
  const idx = MOCK_COURSES.findIndex(c => c['Course ID'] === courseId);
  if (idx === -1) return null;
  MOCK_COURSES[idx] = { ...MOCK_COURSES[idx], ...updates };
  return MOCK_COURSES[idx];
}

export function deleteCourseByCourseId(courseId) {
  const cIdx = MOCK_COURSES.findIndex(c => c['Course ID'] === courseId);
  if (cIdx !== -1) MOCK_COURSES.splice(cIdx, 1);
  const bIdx = MOCK_BOOKINGS.findIndex(b => b['Course ID'] === courseId);
  if (bIdx !== -1) MOCK_BOOKINGS.splice(bIdx, 1);
  return true;
}

export function getCoursesForCourseId(courseId) {
  return MOCK_COURSES.filter(c => c['Course ID'] === courseId);
}

export function getBookingsForCourseId(courseId) {
  return MOCK_BOOKINGS.filter(b => b['Course ID'] === courseId);
}
