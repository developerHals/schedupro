import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FiSearch, FiDownload, FiRefreshCw, FiClock, FiBell, FiCalendar } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import SafeIcon from '../../common/SafeIcon';
import { dataService } from '../../lib/dataService';
import { learnerTrackService } from '../../lib/learnerTrackService';

// Editable inline text cell for local override fields (notes / approval status).
const OverrideTextCell = ({ value, placeholder, onSave }) => {
  const [text, setText] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const initial = useRef(value || '');

  useEffect(() => {
    setText(value || '');
    initial.current = value || '';
  }, [value]);

  const handleBlur = async () => {
    if (text === initial.current) return;
    setSaving(true);
    try {
      await onSave(text);
      initial.current = text;
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`);
      setText(initial.current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      disabled={saving}
      className="w-full min-w-[130px] px-2 py-1 text-sm border border-transparent rounded-md hover:border-gray-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 bg-transparent disabled:opacity-50"
    />
  );
};

// Editable room-override dropdown, sourced from the internal `rooms` table.
const RoomOverrideCell = ({ session, rooms, onSave }) => {
  const [saving, setSaving] = useState(false);
  const value = session.local_room_id || '';

  const handleChange = async (e) => {
    const newVal = e.target.value || null;
    setSaving(true);
    try {
      await onSave(newVal);
    } catch (err) {
      toast.error(`Failed to save room: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      className="w-full min-w-[130px] px-2 py-1 text-sm border border-transparent rounded-md hover:border-gray-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 bg-transparent disabled:opacity-50"
    >
      <option value="">{session.RoomLabel || 'No override'}</option>
      {rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.room_number}
        </option>
      ))}
    </select>
  );
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
};

const SessionsView = ({ onRefresh }) => {
  const [sessions, setSessions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [tutorInput, setTutorInput] = useState('');
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');

  const [searchFilter, setSearchFilter] = useState('');
  const [tutorFilter, setTutorFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const fetchSessions = useCallback(async () => {
    if (sessions.length === 0) setLoading(true);
    try {
      const data = await learnerTrackService.getSessions({
        search: searchFilter || undefined,
        tutor: tutorFilter || undefined,
        dateFrom: dateFromFilter || undefined,
        dateTo: dateToFilter || undefined,
      });
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching Learner Track sessions:', error);
      toast.error(`Failed to load sessions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [searchFilter, tutorFilter, dateFromFilter, dateToFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    dataService.from('rooms').select('id, room_number').then(({ data }) => {
      if (data) setRooms(data);
    });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, tutorFilter, dateFromFilter, dateToFilter]);

  const handleKeyDown = (e, filterType) => {
    if (e.key !== 'Enter') return;
    if (filterType === 'search') setSearchFilter(searchInput);
    if (filterType === 'tutor') setTutorFilter(tutorInput);
  };

  const applyDateFilters = () => {
    setDateFromFilter(dateFromInput);
    setDateToFilter(dateToInput);
  };

  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sessions.slice(startIndex, startIndex + itemsPerPage);
  }, [sessions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sessions.length / itemsPerPage);

  const handleSaveOverride = async (session, patch) => {
    const updated = await learnerTrackService.patchSessionOverride({
      session_id: session.ID,
      ...patch,
    });
    setSessions((prev) =>
      prev.map((s) =>
        s.ID === session.ID
          ? {
              ...s,
              local_room_id: updated.local_room_id,
              local_notes: updated.local_notes,
              local_approval_status: updated.local_approval_status,
              local_room_number: rooms.find((r) => r.id === updated.local_room_id)?.room_number || null,
            }
          : s
      )
    );
  };

  const exportToCSV = () => {
    const headers = ['Course', 'Date', 'Day', 'Start', 'End', 'Term', 'Location', 'Room', 'Tutor', 'Booking Status', 'Local Notes', 'Local Approval'];
    const csvContent = [
      headers.join(','),
      ...sessions.map((s) =>
        [
          `"${(s.CourseTitle || '').replace(/"/g, '""')}"`,
          formatDate(s.Date),
          s.DayOfWeek || '',
          s.StartTime || '',
          s.EndTime || '',
          s.Term || '',
          `"${(s.LocationLabel || '').replace(/"/g, '""')}"`,
          s.local_room_number || s.RoomLabel || '',
          `"${(s.TutorLabel || '').replace(/"/g, '""')}"`,
          s.BookingStatus || '',
          `"${(s.local_notes || '').replace(/"/g, '""')}"`,
          s.local_approval_status || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lt_sessions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
            <span className="text-xs text-gray-400">Synced from Learner Track</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiDownload className="h-4 w-4 mr-2" />
              Export CSV
            </button>
            <a
              href="/pomodoro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100 group"
              title="Open Pomodoro Timer"
            >
              <FiClock className="h-4 w-4 group-hover:animate-pulse" />
            </a>
            <a
              href="/?view=notifications"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100 group"
              title="Open Notifications"
            >
              <FiBell className="h-4 w-4 group-hover:animate-swing" />
            </a>
            <button
              onClick={fetchSessions}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Refresh"
            >
              <FiRefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search course title/code... (Enter)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'search')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <input
            type="text"
            placeholder="Tutor... (Enter to filter)"
            value={tutorInput}
            onChange={(e) => setTutorInput(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'tutor')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="date"
            value={dateFromInput}
            onChange={(e) => setDateFromInput(e.target.value)}
            onBlur={applyDateFilters}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="date"
            value={dateToInput}
            onChange={(e) => setDateToInput(e.target.value)}
            onBlur={applyDateFilters}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => {
              setSearchInput('');
              setTutorInput('');
              setDateFromInput('');
              setDateToInput('');
              setSearchFilter('');
              setTutorFilter('');
              setDateFromFilter('');
              setDateToFilter('');
            }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="px-6 py-2 text-sm text-gray-600 bg-gray-50 border-b border-gray-200">
        Showing {sessions.length} sessions
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {['Course', 'Date', 'Day', 'Start', 'End', 'Term', 'Location', 'Room', 'Tutor', 'Booking Status'].map((header) => (
                <th key={header} className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">
                  {header}
                </th>
              ))}
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">
                Local Notes
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">
                Local Approval
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedSessions.length > 0 ? (
              paginatedSessions.map((session) => (
                <tr key={session.ID} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" title={session.CourseLabel}>
                    {session.CourseShortLabel || session.CourseTitle}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(session.Date)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.DayOfWeek}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.StartTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.EndTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.Term}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.LocationLabel}</td>
                  <td className="px-6 py-2 text-sm">
                    <RoomOverrideCell
                      session={session}
                      rooms={rooms}
                      onSave={(roomId) => handleSaveOverride(session, { local_room_id: roomId })}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.TutorLabel}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.BookingStatus}</td>
                  <td className="px-6 py-2 text-sm">
                    <OverrideTextCell
                      value={session.local_notes}
                      placeholder="Add note..."
                      onSave={(val) => handleSaveOverride(session, { local_notes: val })}
                    />
                  </td>
                  <td className="px-6 py-2 text-sm">
                    <OverrideTextCell
                      value={session.local_approval_status}
                      placeholder="Add status..."
                      onSave={(val) => handleSaveOverride(session, { local_approval_status: val })}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                      <SafeIcon icon={FiCalendar} className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="font-medium">No sessions found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, sessions.length)}</span> to{' '}
          <span className="font-medium">{Math.min(currentPage * itemsPerPage, sessions.length)}</span> of{' '}
          <span className="font-medium">{sessions.length}</span> results
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              currentPage === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              currentPage === totalPages || totalPages === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionsView;
