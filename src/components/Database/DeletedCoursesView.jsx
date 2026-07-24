import React, { useState, useEffect } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { format } from 'date-fns';

const { FiSearch, FiBook, FiRefreshCw, FiDownload, FiEdit2, FiTrash2 } = FiIcons;

const DeletedCoursesView = ({ user }) => {
  const { isSuperuser } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tutorFilter, setTutorFilter] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [columns, setColumns] = useState([
    'SESSIONS',
    'Course ID',
    'Course Name',
    'Start date',
    'End date',
    'Day Details',
    'Start time',
    'End time',
    'Room',
    'Room Capacity',
    'Tutor',
    'Tutor Subject',
    'Tutor availability',
    'Curriculum Manager',
    'Curriculum Area',
    'AIMs',
    'Tailored learning aims',
    'Awarding Body',
    'GLH (Awarding Body)',
    'Planned numbers of hours',
    "Total Aim's Hours",
    'No of Hours per Week',
    'Total number of Sessions',
    'No. of Sessions per Week',
    'Course No of Weeks',
    'Mode of Delivery',
    'Dates with no sessions',
    'Base (unweighted rate)',
    'Full (weighted rate)',
    'Planned Progression',
    'Published on webenrol',
    'BKSB Initial Assessment',
    'Learning objective 1',
    'Learning objective 2',
    'Learning objective 3',
    'Learning objective 4',
    'Learning objective 5',
    'Single sentence description',
    'What is the course about?',
    'Who is the course for?',
    'Are there any entry requirements?',
    'Do I need to have an interview before I can enrol?',
    'How will I be taught?',
    'What feedback will I get?',
    'How will I be able to give my views on the course?',
    'What course can I do next?',
    'Additional Information',
    'Assessment methods',
    'Equipment required',
    'Comments',
    'Actual Enrolments',
    'Actual Completions'
  ]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data, error } = await dataService
        .from('Courses Deleted')
        .select('*')
        .order('Start date', { ascending: true });

      if (error) throw error;

      if (data) {
        setCourses(data);
      } else {
        setCourses([]);
      }
    } catch (error) {
      console.error('Error fetching deleted courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();

    // Subscribe to real-time changes
    const channel = dataService
      .channel('deleted-courses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Courses Deleted' }, (payload) => {
        // console.log('Real-time update in DeletedCoursesView:', payload);
        fetchCourses();
      })
      .subscribe();

    return () => {
      dataService.removeChannel(channel);
    };
  }, []);

  const handleExportCSV = () => {
    if (courses.length === 0) return;

    const headers = columns;
    const csvContent = [
      headers.join(','),
      ...filteredCourses.map(course => 
        headers.map(header => {
          const val = course[header];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `deleted_courses_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = !searchTerm || Object.values(course).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesTutor = !tutorFilter || (course['Tutor'] && course['Tutor'].toLowerCase().includes(tutorFilter.toLowerCase()));
    
    // First Week Filter: Show only sessions that belong to the first week
    let isFirstWeek = true;
    const sessionStr = course['SESSIONS']; // e.g., "EV10112-Session 1"
    const sessionsPerWeekStr = course['No. of Sessions per Week'];
    
    if (sessionStr && sessionsPerWeekStr) {
         const match = sessionStr.match(/Session\s+(\d+)/i);
         if (match && match[1]) {
             const sessionNum = parseInt(match[1], 10);
             const limit = parseInt(sessionsPerWeekStr, 10);
             if (!isNaN(sessionNum) && !isNaN(limit)) {
                 // If session number is within the first week's count
                 isFirstWeek = sessionNum <= limit;
             }
         }
    }

    return matchesSearch && matchesTutor && isFirstWeek;
  });

  const handleDeleteClick = async (course) => {
    if (!isSuperuser()) {
      alert('Only the Company Administrator can delete courses.');
      return;
    }

    setCourseToDelete(course);
    setDeleteConfirmationText('');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmationText !== 'DELETE') return;
    if (!courseToDelete) return;

    // Use 'id' (UUID) if available to delete specific row, otherwise 'Course ID'
    const deleteId = courseToDelete.id;
    const deleteCourseId = courseToDelete['Course ID'];

    try {
      // Direct deletion from Courses Deleted (Permanent)
      let query = dataService.from('Courses Deleted').delete();
      
      if (deleteId) {
          query = query.eq('id', deleteId);
      } else if (deleteCourseId) {
          query = query.eq('Course ID', deleteCourseId);
      } else {
          throw new Error('No valid ID found for deletion');
      }

      const { error } = await query;
      if (error) throw error;
      
      await fetchCourses();
      setDeleteModalOpen(false);
      setCourseToDelete(null);
    } catch (error) {
      console.error('Error deleting course permanently:', error);
      alert('Failed to delete course: ' + (error?.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Security check: Only render if superuser
  if (!isSuperuser()) {
      return (
          <div className="flex justify-center items-center h-64 text-red-600 font-bold">
              Access Denied. Superuser only.
          </div>
      )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 flex flex-col xl:flex-row justify-between items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-red-50 p-2 rounded-lg">
              <SafeIcon icon={FiTrash2} className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Deleted Courses</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search deleted courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <input
                type="text"
                placeholder="Filter by Tutor..."
                value={tutorFilter}
                onChange={(e) => setTutorFilter(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 shrink-0">
          <button 
            onClick={handleExportCSV}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Export to CSV"
          >
            <SafeIcon icon={FiDownload} className="h-4 w-4" />
          </button>
          <button 
            onClick={fetchCourses}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <SafeIcon icon={FiRefreshCw} className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100">
                  {col}
                </th>
              ))}
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100 bg-gray-50 sticky right-0 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.05)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((course, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors group">
                  {columns.map(col => (
                    <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {typeof course[col] === 'object' && course[col] !== null 
                        ? JSON.stringify(course[col]) 
                        : String(course[col] || '')}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white group-hover:bg-gray-50/50 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={() => handleDeleteClick(course)}
                        className="ml-2 text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Permanently Delete"
                    >
                        <SafeIcon icon={FiTrash2} className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                      <SafeIcon icon={FiTrash2} className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="font-medium">No deleted courses found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                <SafeIcon icon={FiTrash2} className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Permanently Delete?</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Are you sure you want to <strong>permanently delete</strong> this backup record? This action cannot be undone.
                <br />
                <span className="font-medium text-gray-700 mt-2 block">
                  Course: {courseToDelete?.['Course Name']} ({courseToDelete?.['Course ID']})
                </span>
              </p>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Type <span className="font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  placeholder="DELETE"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmationText !== 'DELETE'}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletedCoursesView;
