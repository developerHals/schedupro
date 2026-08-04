import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as FiIcons from 'react-icons/fi';
const { FiPlus, FiRefreshCw } = FiIcons;
import { useAuth } from '../../contexts/AuthContext';
import BookingCell from './BookingCell';
import AddRoomModal from '../Modals/AddRoomModal';
import { format } from 'date-fns';
import SafeIcon from '../../common/SafeIcon';
import { ALL_SLOTS, slotsBetween, SLOT_HEIGHT_PX } from '../../utils/timeSlots';
import { learnerTrackService } from '../../lib/learnerTrackService';

// Statuses that should NOT appear on the grid (Hidden = room is freed)
const HIDDEN_STATUSES = new Set(['Not started', 'Incomplete', 'Cancelled', 'Error']);

const CalendarGrid = ({ bookings, rooms, selectedDate, onBookingUpdate, onBookingDelete, getAvailableRooms, onEditBooking, onNewBooking, onNewCourse, onDuplicate, onRefresh }) => {
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState(null);
  const { canEditBookings } = useAuth();
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const syncLockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
      try {
        setSessionsError(null);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const data = await learnerTrackService.getSessions({ date: dateStr });
        console.log('[CalendarGrid] sessions loaded for', dateStr, ':', data?.length || 0, data);
        if (!cancelled) setSessions(data || []);
      } catch (err) {
        if (!cancelled) setSessionsError(err.message || 'Failed to load sessions');
      }
    };
    loadSessions();
    return () => { cancelled = true; };
  }, [selectedDate]);


  /**
   * bookingsLookup shape:
   *   { [roomId]: { [slotTime "HH:MM"]: { booking, isFirstSlot, slotSpan } | 'continuation' } }
   *
   * For each booking we compute its slots via slotsBetween(), then:
   *   - first slot  → { booking, isFirstSlot: true,  slotSpan: N }
   *   - other slots → { booking, isFirstSlot: false, slotSpan: 1 }  (continuation)
   */
  const bookingsLookup = useMemo(() => {
    if (!Array.isArray(rooms)) return {};

    // Build room normalisation maps
    // roomMap: id or room_number → room (no location context)
    // locationRoomMap: 'location|room_number' → room
    const roomMap = new Map();
    const locationRoomMap = new Map();
    rooms.forEach(room => {
      roomMap.set(String(room.id).toLowerCase().trim(), room);
      if (room.room_number) {
        const rn = String(room.room_number).toLowerCase().trim();
        roomMap.set(rn, room);

        // Add location-qualified entries
        const loc = String(room.location || '').toLowerCase().trim();
        if (loc) {
          const bare = rn.replace(/^room\s*/i, '').trim();
          locationRoomMap.set(`${loc}|${rn}`, room);
          locationRoomMap.set(`${loc}|${bare}`, room);
          locationRoomMap.set(`${loc}|room ${bare}`, room);
        }
      }
    });

    const lookup = {}; // { roomId: { slotTime: { booking, isFirstSlot, slotSpan } } }

    const resolveRoom = (roomLabel, location) => {
      const raw = String(roomLabel || '').trim().toLowerCase();
      if (!raw) return null;

      const loc = String(location || '').toLowerCase().trim();
      const roomNum = raw.replace(/^room\s*/i, '').trim();

      if (loc) {
        // Try to match within the same location first
        const locKey = `${loc}|${raw}`;
        if (locationRoomMap.has(locKey)) return locationRoomMap.get(locKey);
        if (locationRoomMap.has(`${loc}|room ${roomNum}`)) return locationRoomMap.get(`${loc}|room ${roomNum}`);
        if (locationRoomMap.has(`${loc}|${roomNum}`)) return locationRoomMap.get(`${loc}|${roomNum}`);
      }

      if (roomMap.has(raw)) return roomMap.get(raw);
      if (roomMap.has(roomNum)) return roomMap.get(roomNum);
      if (roomMap.has(`room ${raw}`)) return roomMap.get(`room ${raw}`);

      // Fallback numeric match (e.g. "3" matches any room number containing 3)
      const rawDigits = raw.match(/\d+/)?.[0];
      if (rawDigits) {
        for (const [key, room] of roomMap.entries()) {
          const keyDigits = key.match(/\d+/)?.[0];
          if (keyDigits === rawDigits) return room;
        }
      }

      return null;
    };

    const addToLookup = (item, startTime, endTime) => {
      const slots = slotsBetween(startTime, endTime);
      if (slots.length === 0) return;
      const normalizedRoomId = item._normalizedRoomId;
      if (!lookup[normalizedRoomId]) lookup[normalizedRoomId] = {};
      slots.forEach((slotTime, idx) => {
        // Don't overwrite a tile that already claimed this slot (bookings take priority over sessions)
        if (lookup[normalizedRoomId][slotTime]) return;
        lookup[normalizedRoomId][slotTime] = {
          booking: item,
          isFirstSlot: idx === 0,
          slotSpan: idx === 0 ? slots.length : 1,
        };
      });
    };

    // --- Process Learner Track sessions first (courses are the main grid view) ---
    let matchedSessions = 0;
    (sessions || []).forEach(session => {
      const status = String(session.BookingStatus || '').trim().toLowerCase();
      if (status.includes('cancel')) return;

      const isWoodGreen = String(session.LocationLabel || '').toLowerCase().includes('wood green');
      const sessionRoomLabel = isWoodGreen
        ? (session.local_room_number || session.RoomLabel || session.RoomId)
        : (session.local_room_number || session.RoomLabel);
      const room = resolveRoom(sessionRoomLabel, session.LocationLabel);
      if (!room) return;
      matchedSessions++;

      const displayRoomName = room.room_number
        ? (String(room.room_number).toLowerCase().includes('room') ? room.room_number : `Room ${room.room_number}`)
        : room.name;

      const processedSession = {
        id: `lt-${session.ID}`,
        isLearnerTrackSession: true,
        'Course ID': session.CourseShortLabel || session.CourseCode || 'LT',
        'Course Name': session.CourseTitle || 'Learner Track Session',
        'Tutor': session.TutorLabel || '',
        'Start time': session.StartTime,
        'End time': session.EndTime,
        'Room': session.local_room_number || session.RoomLabel,
        'BookingStatus': session.BookingStatus || '',
        courseStatus: session.BookingStatus || '',
        courseStart: session.Date,
        courseEnd: session.Date,
        displayRoomName,
        _normalizedRoomId: room.id,
      };

      addToLookup(processedSession, session.StartTime, session.EndTime);
    });

    // --- Process approved internal bookings as an overlay on free slots ---
    let matchedBookings = 0;
    (bookings || []).forEach(booking => {
      const status = booking['Status'] || booking['Lesson Number'] || booking.Status || '';
      const normalized = String(status).trim();
      if (HIDDEN_STATUSES.has(normalized) || normalized === 'Pending') return;

      const room = resolveRoom(booking['Room']);
      if (!room) return;
      matchedBookings++;

      const displayRoomName = room.room_number
        ? (String(room.room_number).toLowerCase().includes('room') ? room.room_number : `Room ${room.room_number}`)
        : room.name;

      const processedBooking = {
        ...booking,
        displayRoomName,
        _normalizedRoomId: room.id,
      };

      addToLookup(processedBooking, booking['Start time'], booking['End time']);
    });

    console.log('[CalendarGrid] lookup: rooms with tiles =', Object.keys(lookup).length, 'matched sessions =', matchedSessions, 'matched bookings =', matchedBookings, 'total rooms =', rooms.length);
    return lookup;
  }, [bookings, rooms, sessions]);

  const handleCellClick = useCallback((roomId, sessionType, booking) => {
    if (booking?.isLearnerTrackSession) return;
    if (booking) {
      if (!canEditBookings()) return;
      if (onEditBooking) onEditBooking(booking);
    } else {
      if (onNewBooking) onNewBooking(roomId, sessionType, selectedDate);
    }
  }, [canEditBookings, onEditBooking, onNewBooking, selectedDate]);

  const handleBookingDrop = async () => {
    console.warn('Drag and drop not fully implemented for Courses table');
  };

  const syncHorizontalScroll = useCallback((source, target) => {
    if (!source || !target) return;
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => { syncLockRef.current = false; });
  }, []);

  const handleHeaderScroll = useCallback(() => {
    syncHorizontalScroll(headerScrollRef.current, bodyScrollRef.current);
  }, [syncHorizontalScroll]);

  const handleBodyScroll = useCallback(() => {
    syncHorizontalScroll(bodyScrollRef.current, headerScrollRef.current);
  }, [syncHorizontalScroll]);

  return (
    <>
      <div className="bg-white rounded-xl shadow-md border border-gray-200">
        {/* ── Top bar ── */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
          <h2 className="text-lg md:text-xl font-bold text-gray-800">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h2>
          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
            {sessionsError && (
              <div className="text-xs text-red-600 font-medium" title={sessionsError}>
                Sessions error
              </div>
            )}
            <div className="text-xs md:text-sm text-gray-500 font-medium">
              {rooms.length} Rooms Available
            </div>
            <a href="/pomodoro" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100 group"
              title="Open Pomodoro Timer">
              <FiIcons.FiClock className="h-4 w-4 group-hover:animate-pulse" />
            </a>
            <a href="/?view=notifications" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100 group"
              title="Open Notifications">
              <FiIcons.FiBell className="h-4 w-4 group-hover:animate-swing" />
            </a>
            <button onClick={onRefresh}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Refresh">
              <SafeIcon icon={FiRefreshCw} className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Sticky column header ── */}
        <div ref={headerScrollRef} onScroll={handleHeaderScroll}
          className="overflow-x-auto scrollbar-hidden sticky top-[var(--app-header-height)] z-30 bg-gray-50/50 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="inline-block min-w-full align-middle">
            <div className="flex border-b border-gray-200 bg-gray-50/50">
              {/* Time column header */}
              <div className="w-16 md:w-24 flex-shrink-0 px-2 py-4 font-bold text-gray-700 bg-gray-100 sticky left-0 z-40 border-r border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-xs md:text-sm flex items-center">
                <span className="hidden md:inline">Time</span>
                <span className="md:hidden">⏱</span>
              </div>
              {rooms.map(room => (
                <div key={room.id}
                  className="w-[160px] md:w-[220px] flex-shrink-0 px-2 md:px-4 py-4 text-center border-r border-gray-200 group hover:bg-white transition-colors">
                  <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-wider text-xs md:text-sm truncate">
                    {room.room_number}
                  </div>
                  <div className="text-[10px] md:text-[11px] font-semibold text-gray-400 mt-1 flex items-center justify-center gap-1">
                    <SafeIcon name="Users" className="w-3 h-3" />
                    CAP: {room.capacity ?? '—'}
                  </div>
                </div>
              ))}
              {canEditBookings() && (
                <div className="w-[160px] md:w-[220px] flex-shrink-0 px-4 py-4 flex items-center justify-center">
                  <button onClick={() => setShowAddRoomModal(true)}
                    className="flex items-center justify-center w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group">
                    <SafeIcon icon={FiPlus} className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold">New Room</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 30-minute slot rows ── */}
        <div ref={bodyScrollRef} onScroll={handleBodyScroll}
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="inline-block min-w-full align-middle">
            {ALL_SLOTS.map((slotTime, slotIdx) => {
              const isHourMark = slotTime.endsWith(':00');
              return (
                <div
                  key={slotTime}
                  className={`flex border-b ${isHourMark ? 'border-gray-200' : 'border-gray-100'}`}
                  style={{ height: `${SLOT_HEIGHT_PX}px` }}
                >
                  {/* Time label */}
                  <div className={`w-16 md:w-24 flex-shrink-0 px-1 md:px-3 flex items-center border-r border-gray-200 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isHourMark ? 'bg-gray-100' : 'bg-gray-50'}`}>
                    <span className={`text-[10px] md:text-xs font-mono ${isHourMark ? 'font-bold text-gray-700' : 'text-gray-400'}`}>
                      {slotTime}
                    </span>
                  </div>

                  {/* Room cells */}
                  {rooms.map(room => {
                    const slotData = bookingsLookup[room.id]?.[slotTime];
                    // White separator: true when this is the first slot of a new booking
                    // AND the slot immediately above it was a continuation of a different booking
                    const prevSlotTime = slotIdx > 0 ? ALL_SLOTS[slotIdx - 1] : null;
                    const prevSlotData = prevSlotTime ? bookingsLookup[room.id]?.[prevSlotTime] : null;
                    const hasBorderTop = !!(slotData?.isFirstSlot && prevSlotData && !prevSlotData.isFirstSlot);

                    if (!slotData) {
                      // Empty interactive slot
                      return (
                        <BookingCell
                          key={`${room.id}-${slotTime}`}
                          roomId={room.id}
                          sessionType={slotTime}
                          booking={undefined}
                          bookings={undefined}
                          onCellClick={handleCellClick}
                          onDrop={handleBookingDrop}
                          canEdit={canEditBookings()}
                          onDelete={onBookingDelete}
                          onNewCourse={onNewCourse}
                          onDuplicate={onDuplicate}
                          isFirstSlot={true}
                          slotSpan={1}
                          slotTime={slotTime}
                        />
                      );
                    }

                    // Continuation slot — silent blocker
                    if (!slotData.isFirstSlot) {
                      return (
                        <BookingCell
                          key={`${room.id}-${slotTime}`}
                          roomId={room.id}
                          sessionType={slotTime}
                          booking={slotData.booking}
                          bookings={undefined}
                          onCellClick={handleCellClick}
                          onDrop={handleBookingDrop}
                          canEdit={canEditBookings()}
                          onDelete={onBookingDelete}
                          onNewCourse={onNewCourse}
                          onDuplicate={onDuplicate}
                          isFirstSlot={false}
                          slotSpan={1}
                          slotTime={slotTime}
                        />
                      );
                    }

                    // First slot of a booking — render full spanning tile
                    return (
                      <BookingCell
                        key={`${room.id}-${slotTime}`}
                        roomId={room.id}
                        sessionType={slotTime}
                        booking={slotData.booking}
                        bookings={undefined}
                        onCellClick={handleCellClick}
                        onDrop={handleBookingDrop}
                        canEdit={canEditBookings()}
                        onDelete={onBookingDelete}
                        onNewCourse={onNewCourse}
                        onDuplicate={onDuplicate}
                        isFirstSlot={true}
                        slotSpan={slotData.slotSpan}
                        slotTime={slotTime}
                        hasBorderTop={hasBorderTop}
                      />
                    );
                  })}

                  {canEditBookings() && (
                    <div className="w-[160px] md:w-[220px] flex-shrink-0 bg-gray-50/20 border-r border-gray-100" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AddRoomModal isOpen={showAddRoomModal} onClose={() => setShowAddRoomModal(false)} />
    </>
  );
};

export default CalendarGrid;
