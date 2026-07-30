import React, { useState, useEffect } from 'react';
import { FiSearch, FiEdit2, FiTrash2, FiDownload, FiUpload, FiFilter, FiRefreshCw, FiCheck, FiX, FiClock, FiBell } from 'react-icons/fi';
import { dataService } from '../../lib/dataService';
import { format } from 'date-fns';
import BookingEditModal from '../Modals/BookingEditModal';
import BulkUploadModal from '../Modals/BulkUploadModal';
import ConfirmationModal from '../Modals/ConfirmationModal';

import BookingRow from './BookingRow';
import SessionsView from './SessionsView';

const DatabaseView = ({ onBookingUpdate, onBookingDelete, viewMode = 'database', onRefresh, user, onApproveWithRoom }) => {
  // 'database' now shows Learner Track sessions (read-only + local overrides).
  // 'approve-bookings' keeps the original internal booking-approval workflow below.
  if (viewMode === 'database') {
    return <SessionsView onRefresh={onRefresh} />;
  }

  return <ApproveBookingsView onBookingUpdate={onBookingUpdate} onBookingDelete={onBookingDelete} viewMode={viewMode} onRefresh={onRefresh} user={user} onApproveWithRoom={onApproveWithRoom} />;
};

const ApproveBookingsView = ({ onBookingUpdate, onBookingDelete, viewMode = 'approve-bookings', onRefresh, user, onApproveWithRoom }) => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);

  useEffect(() => {
    loadData();

    // Subscribe to real-time changes
    const channel = dataService
      .channel('database-view-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        loadData();
      })
      .subscribe();

    return () => {
      dataService.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load rooms for mapping UUIDs to names
      const { data: roomsData } = await dataService.from('rooms').select('id, room_number');
      if (roomsData) setRooms(roomsData);

      // Load bookings from bookings table
      // OPTIMIZATION: Limit to last 30 days + future by default? 
      // For now, keeping as is to avoid breaking "search everything" requirement, 
      // but rendering is optimized via BookingRow.
      const { data: bookingsData, error: bookingsError } = await dataService
        .from('bookings')
        .select('id, "Course ID", "Course Name", "Lesson Number", "Lesson Length", "Start time", "End time", "Room", "Tutor", "Start date", "End date", "Day Details", "Notes", "Comments"')
        .order('Start date', { ascending: false });
      
      if (bookingsError) throw bookingsError;

      setBookings(bookingsData || []);
    } catch (error) {
      console.error('Error loading database:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const filteredBookingsMemo = React.useMemo(() => {
    let filtered = bookings;

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(booking => 
        (booking['Course ID'] && booking['Course ID'].toLowerCase().includes(lowerTerm)) ||
        (booking['Course Name'] && booking['Course Name'].toLowerCase().includes(lowerTerm)) ||
        (booking['Tutor'] && booking['Tutor'].toLowerCase().includes(lowerTerm))
      );
    }

    if (dateFilter) {
      filtered = filtered.filter(booking => booking['Start date'] === dateFilter);
    }

    if (viewMode === 'approve-bookings') {
      filtered = filtered.filter(booking => 
        booking['Lesson Number'] === 'Pending'
      );
    }

    return filtered;
  }, [bookings, searchTerm, dateFilter, viewMode]);

  useEffect(() => {
    setFilteredBookings(filteredBookingsMemo);
  }, [filteredBookingsMemo]);

  const handleApprove = React.useCallback((booking) => {
    if (onApproveWithRoom) {
      onApproveWithRoom(booking);
    }
  }, [onApproveWithRoom]);

  const handleEdit = React.useCallback((booking) => {
    setSelectedBooking(booking);
    setShowEditModal(true);
  }, []);

  const handleDelete = React.useCallback((bookingId) => {
    setBookingToDelete(bookingId);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (bookingToDelete) {
      await onBookingDelete(bookingToDelete);
      loadData();
      setShowDeleteModal(false);
      setBookingToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setBookingToDelete(null);
  };

  const exportToCSV = () => {
    const headers = ['Course ID', 'Course Name', 'Lesson Number', 'Lesson Length', 'Start Time', 'End Time', 'Room', 'Tutor', 'Start date', 'End date'];
    const csvContent = [
      headers.join(','),
      ...filteredBookings.map(booking => [
        booking['Course ID'] || '',
        `"${booking['Course Name']?.replace(/"/g, '""') || ''}"`,
        booking['Lesson Number'] || '',
        booking['Lesson Length'] || '',
        booking['Start time'] || '',
        booking['End time'] || '',
        booking['Room'] || '',
        `"${booking['Tutor']?.replace(/"/g, '""') || ''}"`,
        formatDate(booking['Start date']),
        formatDate(booking['End date'])
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings_${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {viewMode === 'approve-bookings' ? 'Approve Bookings' : 'Database View'}
            </h2>
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
                onClick={onRefresh}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Refresh"
              >
                <FiRefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search course ID, name, or tutor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="px-6 py-2 text-sm text-gray-600 bg-gray-50 border-b border-gray-200">
          Showing {filteredBookings.length} of {bookings.length} bookings
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {['Course ID', 'Course Name', 'Lesson Number', 'Date', 'Lesson Length', 'Start time', 'End time', 'Room', 'Tutor', 'Start date', 'End date'].map(header => (
                  <th key={header} className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">
                    {header}
                  </th>
                ))}
                {viewMode === 'approve-bookings' && (
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">
                    Comments
                  </th>
                )}
                {viewMode === 'approve-bookings' && (
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200 text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  viewMode={viewMode}
                  rooms={rooms}
                  onApprove={handleApprove}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUploadModal && (
        <BulkUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={loadData}
        />
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Important"
        message="Are you sure you want to delete this booking?"
        confirmLabel="OK"
        cancelLabel="Cancel"
        isDelete={true}
        verificationText="DELETE"
      />
    </>
  );
};

export default DatabaseView;