
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiSearch, FiBook, FiRefreshCw, FiDownload, FiEdit2, FiTrash2, FiSave, FiCopy, FiCheck, FiClock, FiBell } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../common/SafeIcon';
import { format } from 'date-fns';
import StatusModal from '../Modals/StatusModal';
import { checkAndUpdateCourseStatuses } from '../../utils/courseStatusUpdater';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation(); // Prevent row click events if any
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`ml-2 p-1.5 rounded-md transition-all ${
        copied 
          ? 'bg-green-50 text-green-600 opacity-100' 
          : 'opacity-0 group-hover/cell:opacity-100 hover:bg-gray-100 text-gray-400 hover:text-blue-600'
      }`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      <SafeIcon icon={copied ? FiCheck : FiCopy} className="h-3.5 w-3.5" />
    </button>
  );
};

const COLUMNS = [
  'SESSIONS',
  'Course ID',
  'Course Name',
  'Start date',
  'End date',
  'Tutor',
  'Status',
  'Day Details',
  'Start time',
  'End time',
  'Room',
  'Room Capacity',
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
  'Actual Completions',
  'Deadline',
];

const CourseView = ({ onEditCourse, onDeleteCourse, onDuplicateCourse, user }) => {
  const { isSuperuser, isCM } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Input States (what the user types)
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  });
  const [tutorInput, setTutorInput] = useState('');
  const [dayInput, setDayInput] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [curriculumInput, setCurriculumInput] = useState('');

  // Filter States (what triggers the search/filter)
  const [searchFilter, setSearchFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('filter') || 'Pending';
  });
  const [tutorFilter, setTutorFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  
  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCourseForStatus, setSelectedCourseForStatus] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Backup Modal State
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupConfirmationText, setBackupConfirmationText] = useState('');

  const fetchCourses = useCallback(async () => {
    // Only show full page loader on initial load (when courses is empty)
    if (courses.length === 0) setLoading(true);
    
    try {
      const buildQuery = (source) => {
        let q = dataService
          .from(source)
          .select('*')
          .order('Start date', { ascending: true });
        const sf = (statusFilter || 'All').toLowerCase();
        if (sf !== 'all') {
          if (sf === 'pending') {
            q = q.or('Status.ilike.pending%,Status.is.null,Status.eq.');
          } else {
            q = q.ilike('Status', `${sf}%`);
          }
        }
        const term = (searchFilter || '').trim();
        if (term) {
          const clean = term.replace(/"/g, '');
          q = q.or(`"Course ID".ilike.%${clean}%,"AIMs".ilike.%${clean}%,"Tailored learning aims".ilike.%${clean}%,"Course Name".ilike.%${clean}%`);
        }
        if (tutorFilter && tutorFilter.trim()) {
          q = q.ilike('Tutor', `%${tutorFilter.trim()}%`);
        }
        if (dayFilter && dayFilter.trim()) {
          q = q.ilike('Day Details', `%${dayFilter.trim()}%`);
        }
        if (roomFilter && roomFilter.trim()) {
          q = q.ilike('Room', `%${roomFilter.trim()}%`);
        }
        if (curriculumFilter && curriculumFilter.trim()) {
          q = q.ilike('Curriculum Area', `%${curriculumFilter.trim()}%`);
        }
        return q.limit(5000);
      };

      let data;
      let error;
      ({ data, error } = await buildQuery('Courses_FirstWeek'));
      if (error && String(error.message || '').toLowerCase().includes('courses_firstweek')) {
        ({ data, error } = await buildQuery('Courses'));
      }
      if (error) throw error;

      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchFilter, tutorFilter, dayFilter, roomFilter, curriculumFilter]);

  useEffect(() => {
    // Fetch courses immediately to ensure UI is populated
    fetchCourses();

    // Check for status updates in the background
    const runStatusUpdates = async () => {
      try {
        const updatesCount = await checkAndUpdateCourseStatuses();
        if (updatesCount > 0) {
           fetchCourses();
        }
      } catch (err) {
        console.error('Background status update failed:', err);
      }
    };
    
    runStatusUpdates();
  }, [fetchCourses]);

  // Separate effect for real-time subscription to avoid re-subscribing on filter changes
  useEffect(() => {
    const channel = dataService
      .channel('course-view-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Courses' }, (payload) => {
        fetchCourses();
      })
      .subscribe();

    return () => {
      dataService.removeChannel(channel);
    };
  }, [fetchCourses]);

  // Handle Enter key press for filters
  const handleKeyDown = (e, filterType) => {
    if (e.key === 'Enter') {
      switch (filterType) {
        case 'search':
          setSearchFilter(searchInput);
          break;
        case 'tutor':
          setTutorFilter(tutorInput);
          break;
        case 'day':
          setDayFilter(dayInput);
          break;
        case 'room':
          setRoomFilter(roomInput);
          break;
        case 'curriculum':
          setCurriculumFilter(curriculumInput);
          break;
        default:
          break;
      }
    }
  };

  const filteredCourses = useMemo(() => {
    // Helper: Check if a session day falls within the first week of the course
    const isSessionInFirstWeek = (startDateStr, dayDetails) => {
      if (!startDateStr || !dayDetails) return false;
      
      const dayMatch = dayDetails.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
      if (!dayMatch) return false;
      
      const sessionDayName = dayMatch[1];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      const startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) return false;
      
      const startDayIndex = startDate.getDay(); // 0=Sun, 1=Mon, etc.
      const sessionDayIndex = dayNames.indexOf(sessionDayName);
      
      if (sessionDayIndex === -1) return false;
      
      // Calculate how many days after the start date this session occurs
      let daysAfterStart = sessionDayIndex - startDayIndex;
      if (daysAfterStart < 0) daysAfterStart += 7;
      
      // First week: days 0-6 after start date (7 days total)
      return daysAfterStart >= 0 && daysAfterStart < 7;
    };

    // 1. Apply filters to get matching courses
    const matches = courses.filter(course => {
      // Status Filter Logic
      const rawStatus = course['Status'];
      // Normalize status: trim whitespace, default null/undefined/empty to 'Pending'
      const courseStatus = rawStatus && typeof rawStatus === 'string' && rawStatus.trim() 
        ? rawStatus.trim() 
        : 'Pending';
      const normalizedStatus = (courseStatus || '').toLowerCase();
      const normalizedFilter = (statusFilter || 'Pending').toLowerCase();
        
      if (statusFilter !== 'All') {
        if (normalizedFilter === 'pending') {
             // For Pending filter, accept "Pending" (normalized)
             // This covers explicit "Pending", "Pending " (whitespace), null, undefined, and empty strings
             if (normalizedStatus !== 'pending') {
                 return false;
             }
        } else if (normalizedStatus !== normalizedFilter) {
            return false;
        }
      }

      const matchesSearch = !searchFilter || [
        course['Course ID'],
        course['AIMs'],
        course['Tailored learning aims'],
        course['Course Name']
      ].some(val => 
        String(val || '').toLowerCase().includes(searchFilter.toLowerCase())
      );
      const matchesTutor = !tutorFilter || (course['Tutor'] && course['Tutor'].toLowerCase().includes(tutorFilter.toLowerCase()));
      const matchesDay = !dayFilter || (course['Day Details'] && course['Day Details'].toLowerCase().includes(dayFilter.toLowerCase()));
      const matchesRoom = !roomFilter || (course['Room'] && course['Room'].toLowerCase().includes(roomFilter.toLowerCase()));
      const matchesCurriculum = !curriculumFilter || (course['Curriculum Area'] && course['Curriculum Area'].toLowerCase().includes(curriculumFilter.toLowerCase()));
      
      return matchesSearch && matchesTutor && matchesDay && matchesRoom && matchesCurriculum;
    });

    // 2. Filter to show only sessions from the FIRST WEEK of each course
    // AND only the first unique session per day
    const uniqueSessions = [];
    const seenSessions = new Set(); // Key: CourseID-DayDetails

    matches.forEach(course => {
        const courseId = course['Course ID'];
        const startDate = course['Start date'];
        const dayDetails = course['Day Details'];
        
        // Only include sessions that fall within the first week
        if (!isSessionInFirstWeek(startDate, dayDetails)) {
          return;
        }
        
        // Normalize day: trim and lowercase. If empty, treat as 'unknown' but still unique per course
        const day = (dayDetails || '').trim().toLowerCase();
        
        // Use a composite key to ensure we only show the first session of that day for that course
        const key = `${courseId}-${day}`;
        
        if (!seenSessions.has(key)) {
            seenSessions.add(key);
            uniqueSessions.push(course);
        }
    });

    return uniqueSessions;
  }, [courses, searchFilter, statusFilter, tutorFilter, dayFilter, roomFilter, curriculumFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, statusFilter, tutorFilter, dayFilter, roomFilter, curriculumFilter]);

  const paginatedCourses = useMemo(() => {
    if (!filteredCourses) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCourses.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCourses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);

  const handleOpenStatusModal = (course) => {
    setSelectedCourseForStatus(course);
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async (courseId, newStatus, newDeadline, actualEnrolments, actualCompletions, comments, publishedOnWebenrol) => {
    try {
      // Find the course ID (UUID) or use Course ID string if that's what we have
      // Usually we need the UUID 'id' column for updates
      const courseToUpdate = courses.find(c => c['Course ID'] === courseId || c.id === courseId);
      if (!courseToUpdate) return;
      
      // Prepare update object, handling numeric conversion for empty strings
      const updateData = { 
        'Status': newStatus, 
        'Deadline': newDeadline,
        'Actual Enrolments': actualEnrolments === '' ? null : Number(actualEnrolments),
        'Actual Completions': actualCompletions === '' ? null : Number(actualCompletions),
        'Comments': comments,
        'Published on webenrol': publishedOnWebenrol
      };

      // Ensure we have a valid ID to update
      if (!courseToUpdate.id) {
          throw new Error(`Cannot update course: Missing unique ID (UUID) for Course ID '${courseId}'`);
      }

      const { error } = await dataService
        .from('Courses')
        .update(updateData)
        .eq('id', courseToUpdate.id); // Assume 'id' is the primary key UUID

      if (error) throw error;

      // Update local state
      setCourses(courses.map(c => 
        c.id === courseToUpdate.id 
          ? { 
              ...c, 
              ...updateData
            } 
          : c
      ));
      
      setStatusModalOpen(false);
      setSelectedCourseForStatus(null);
      
      toast.success('Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(`Failed to update status: ${error.message || 'Unknown error'}`);
    }
  };

  const liveCoursesCount = useMemo(() => {
    // Filter courses where Status is 'Live'
    const liveCourses = filteredCourses.filter(c => c.Status === 'Live');
    const uniqueCourseIds = new Set(liveCourses.map(c => c['Course ID']));
    return uniqueCourseIds.size;
  }, [filteredCourses]);

  const totalCoursesCount = useMemo(() => {
    const uniqueCourseIds = new Set(filteredCourses.map(c => c['Course ID']));
    return uniqueCourseIds.size;
  }, [filteredCourses]);

  const handleExportCSV = () => {
    if (courses.length === 0) return;

    const headers = COLUMNS;
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
    link.setAttribute('download', `courses_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEdit = (course) => {
    if (onEditCourse) {
      onEditCourse(course);
    }
  };

  const handleDeleteClick = async (course) => {
    if (!isSuperuser()) {
      toast.error('Only the Company Administrator can delete courses.');
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
    // Warning: 'Course ID' deletion might affect multiple rows if not unique
    const deleteId = courseToDelete.id;
    const deleteCourseId = courseToDelete['Course ID'];

    try {
      // Backup to Courses Deleted
      const { error: backupError } = await dataService.from('Courses Deleted').upsert([courseToDelete]);
      if (backupError) {
        console.error('Backup failed:', backupError);
        const proceed = window.confirm(`Backup failed: ${backupError.message}\n\nDo you want to delete the course anyway?`);
        if (!proceed) {
          setDeleteModalOpen(false);
          return;
        }
      }

      if (onDeleteCourse) {
        // If parent handler provided, use it
        const result = await onDeleteCourse(courseToDelete);
        if (result && result.success === false) {
          throw result.error || new Error('Delete failed');
        }
      } else {
        // Direct deletion
        let query = dataService.from('Courses').delete();
        
        if (deleteId) {
            query = query.eq('id', deleteId);
        } else if (deleteCourseId) {
            query = query.eq('Course ID', deleteCourseId);
        } else {
            throw new Error('No valid ID found for deletion');
        }

        const { error } = await query;
        if (error) throw error;
      }
      
      await fetchCourses();
      setDeleteModalOpen(false);
      setCourseToDelete(null);
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleBackup = async () => {
    if (!isSuperuser()) return;
    setBackupConfirmationText('');
    setBackupModalOpen(true);
  };

  const handleConfirmBackup = async () => {
    if (backupConfirmationText !== 'BACKUP') return;

    setLoading(true);
    try {
      // 1. Delete all existing data in Courses Backup
      // Using a condition that is likely always true for UUIDs to bypass "delete without filter" protection
      const { error: deleteError } = await dataService
        .from('Courses Backup')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); 
      
      if (deleteError) throw deleteError;

      // 2. Fetch all data from Courses
      const { data: sourceData, error: fetchError } = await dataService
        .from('Courses')
        .select('*');
      
      if (fetchError) throw fetchError;
      
      if (!sourceData || sourceData.length === 0) {
        toast.info('No courses to backup.');
        setBackupModalOpen(false);
        return;
      }

      // 3. Insert into Courses Backup
      const { error: insertError } = await dataService
        .from('Courses Backup')
        .insert(sourceData);

      if (insertError) throw insertError;

      toast.success('Backup completed successfully!');
      setBackupModalOpen(false);
    } catch (error) {
      console.error('Backup failed:', error);
      toast.error('Backup failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 flex flex-col gap-4">
        {/* Top Row: Title and Status */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-gray-900">Courses</h2>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700"
            >
              <option value="Pending">Pending</option>
              <option value="Not started">Not started</option>
              <option value="All">All</option>
              <option value="Planned">Planned</option>
              <option value="Live">Live</option>
              <option value="Incomplete">Incomplete</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Ended">Ended</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center space-x-3">
            {isSuperuser() && (
              <button 
                onClick={handleBackup}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-sm font-medium text-sm"
                title="Backup Courses"
              >
                <SafeIcon icon={FiSave} className="h-4 w-4" />
                <span>Backup</span>
              </button>
            )}
            <button 
              onClick={handleExportCSV}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Export to CSV"
            >
              <SafeIcon icon={FiDownload} className="h-4 w-4" />
            </button>
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
              onClick={fetchCourses}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Refresh"
            >
              <SafeIcon icon={FiRefreshCw} className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Bottom Row: Filters, Counters, and Buttons */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto flex-wrap">
            <div className="relative w-full sm:w-64">
              <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Course... (Enter to search)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'search')}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <input
                type="text"
                placeholder="Tutor... (Enter to filter)"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'tutor')}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <input
                type="text"
                placeholder="Curriculum... (Enter to filter)"
                value={curriculumInput}
                onChange={(e) => setCurriculumInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'curriculum')}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <input
                type="text"
                placeholder="Day... (Enter to filter)"
                value={dayInput}
                onChange={(e) => setDayInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'day')}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <input
                type="text"
                placeholder="Room... (Enter to filter)"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'room')}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-blue-700">Total: {totalCoursesCount}</span>
            </div>
            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium text-green-700">Live: {liveCoursesCount}</span>
            </div>
          </div>
          

        </div>
      </div>

      <div 
        className="flex-1 overflow-auto relative" 
      >
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMNS.map(col => (
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
            {paginatedCourses.length > 0 ? (
              paginatedCourses.map((course, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors group">
                  {COLUMNS.map(col => (
                    <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center group/cell">
                        <span className={`${col === 'Comments' ? 'block max-w-[150px] truncate' : ''}`} title={col === 'Comments' ? String(course[col] || '') : undefined}>
                          {typeof course[col] === 'object' && course[col] !== null 
                            ? JSON.stringify(course[col]) 
                            : String(course[col] || '')}
                        </span>
                        
                        {(col === 'Status' || col === 'Deadline') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStatusModal(course);
                            }}
                            className="ml-2 text-gray-400 hover:text-blue-600 transition-colors p-1"
                            title={`Edit ${col}`}
                          >
                            <SafeIcon icon={FiEdit2} className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {(col === 'SESSIONS' || col === 'Course ID') && course[col] && (
                          <CopyButton text={String(course[col])} />
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white group-hover:bg-gray-50/50 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.05)]">
                    {(isSuperuser() || isCM()) && (
                      <button
                        onClick={() => handleEdit(course)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                        title="Edit Course"
                      >
                        <SafeIcon icon={FiEdit2} className="h-4 w-4" />
                      </button>
                    )}
                    {(isSuperuser() || isCM()) && onDuplicateCourse && (
                      <button
                        onClick={() => onDuplicateCourse(course)}
                        className="ml-2 text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors"
                        title="Duplicate Course"
                      >
                        <SafeIcon icon={FiCopy} className="h-4 w-4" />
                      </button>
                    )}
                    {isSuperuser() && (
                      <button
                        onClick={() => handleDeleteClick(course)}
                        className="ml-2 text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete Course"
                      >
                        <SafeIcon icon={FiTrash2} className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                      <SafeIcon icon={FiBook} className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="font-medium">No courses found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredCourses.length)}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredCourses.length)}</span> of <span className="font-medium">{filteredCourses.length}</span> results
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                <SafeIcon icon={FiTrash2} className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Confirm Deletion</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Are you sure you want to delete this course entry? This action cannot be undone.
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
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Confirmation Modal */}
      {backupModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
                <SafeIcon icon={FiSave} className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Confirm Backup</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Are you sure you want to overwrite the "Courses Backup" table with the current "Courses" data? This action cannot be undone.
              </p>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Type <span className="font-bold text-blue-600">BACKUP</span> to confirm
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="BACKUP"
                  value={backupConfirmationText}
                  onChange={(e) => setBackupConfirmationText(e.target.value)}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setBackupModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBackup}
                  disabled={backupConfirmationText !== 'BACKUP'}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Backup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      <StatusModal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setSelectedCourseForStatus(null);
        }}
        onSave={handleSaveStatus}
        initialStatus={selectedCourseForStatus?.['Status']}
        initialDeadline={selectedCourseForStatus?.['Deadline']}
        initialActualEnrolments={selectedCourseForStatus?.['Actual Enrolments']}
        initialActualCompletions={selectedCourseForStatus?.['Actual Completions']}
        initialComments={selectedCourseForStatus?.['Comments']}
        initialPublishedOnWebenrol={selectedCourseForStatus?.['Published on webenrol']}
        courseId={selectedCourseForStatus?.id}
        courseName={selectedCourseForStatus?.['Course Name']}
      />
    </div>
  );
};

export default CourseView;
