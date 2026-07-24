import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiSearch, FiCopy, FiCheck, FiInfo, FiArrowLeft, FiCalendar, FiClock, FiMapPin, FiUser, FiPlus, FiTrash, FiSave, FiRefreshCw, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { format, parseISO, isValid } from 'date-fns';

// Helper to check if a course is urgent (Pending with start date <= today)
const isCourseUrgent = (course) => {
  if (!course || course['Status'] !== 'Pending') return false;
  const startDateStr = course['Start date'];
  if (!startDateStr) return false;
  
  try {
    const startDate = parseISO(startDateStr);
    if (!isValid(startDate)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return startDate <= today;
  } catch {
    return false;
  }
};

const OurCoursesView = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState(null);
  const [newComments, setNewComments] = useState(['']);
  const [savingComments, setSavingComments] = useState(false);
  const [globalCounts, setGlobalCounts] = useState({ total: 0, live: 0 });
  const [courseIdInput, setCourseIdInput] = useState('');
  const [additionalAimsRefs, setAdditionalAimsRefs] = useState([]);
  const [roomsData, setRoomsData] = useState([]);  // rooms lookup for location

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  useEffect(() => {
    // Fetch rooms for location lookup
    dataService.from('rooms').select('room_number, location').then(({ data }) => {
      if (data) setRoomsData(data);
    });

    // Check for URL parameters
    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get('search');
    const urlFilter = params.get('filter');

    if (urlSearch || urlFilter) {
      if (urlSearch) setSearchTerm(urlSearch);
      if (urlFilter) setStatusFilter(urlFilter);
      fetchCourses(urlSearch || '', urlFilter || 'Pending');
    } else {
      fetchCourses();
    }
    fetchGlobalCounts();
  }, []);

  const fetchGlobalCounts = async () => {
    try {
      let data;
      let error;
      ({ data, error } = await dataService
        .from('Courses_FirstWeek')
        .select('"Course ID", Status'));
      if (error && String(error.message || '').toLowerCase().includes('courses_firstweek')) {
        ({ data, error } = await dataService
          .from('Courses')
          .select('"Course ID", Status'));
      }

      if (error) throw error;

      if (data) {
        const uniqueCourses = new Set(data.map(c => c['Course ID']));
        const liveCourses = new Set(data.filter(c => c.Status === 'Live').map(c => c['Course ID']));
        
        setGlobalCounts({
          total: uniqueCourses.size,
          live: liveCourses.size
        });
      }
    } catch (err) {
      console.error('Error fetching global counts:', err);
    }
  };

  useEffect(() => {
    // Refresh counts when courses change (e.g. status update)
  }, []);

  useEffect(() => {
    if (selectedCourse) {
        setNewComments(['']);
        setCourseIdInput(selectedCourse['Course ID'] || '');
        fetchAdditionalAims(selectedCourse['Course ID']);
    }
  }, [selectedCourse]);

  const fetchAdditionalAims = async (courseId) => {
    if (!courseId) { setAdditionalAimsRefs([]); return; }
    try {
      const { data, error } = await dataService
        .from('Courses Additional Aims')
        .select('"Additional Aim Ref", "Additional Aim Type"')
        .eq('Course ID', courseId)
        .order('Additional Aim Type')
        .order('Additional Aim Ref');
      if (error) throw error;
      setAdditionalAimsRefs((data || []).map(r => r['Additional Aim Ref']).filter(Boolean));
    } catch (err) {
      console.error('Error fetching additional aims:', err);
      setAdditionalAimsRefs([]);
    }
  };

  const fetchCourses = async (term = searchTerm, status = statusFilter) => {
    setLoading(true);
    setError('');
    
    try {
      const applyStatusFilter = (q) => {
        if (status && status !== 'All') {
          if (status === 'Pending') {
            return q.or('Status.ilike.pending%,Status.is.null,Status.eq.');
          }
          return q.ilike('Status', `${status.toLowerCase()}%`);
        }
        return q;
      };

      const cleanTerm = term && term.trim() ? term.trim().replace(/"/g, '') : '';

      let data = [];
      if (cleanTerm) {
        let idQuery = dataService.from('Courses_FirstWeek').select('"Course ID"');
        idQuery = applyStatusFilter(idQuery);
        idQuery = idQuery.or(`"Course ID".ilike.%${cleanTerm}%,"Course Name".ilike.%${cleanTerm}%,"Tutor".ilike.%${cleanTerm}%`);
        idQuery = idQuery.limit(5000);

        let idRows;
        let idError;
        ({ data: idRows, error: idError } = await idQuery);
        if (idError && String(idError.message || '').toLowerCase().includes('courses_firstweek')) {
          let fallbackIdQuery = dataService.from('Courses').select('"Course ID"');
          fallbackIdQuery = applyStatusFilter(fallbackIdQuery);
          fallbackIdQuery = fallbackIdQuery.or(`"Course ID".ilike.%${cleanTerm}%,"Course Name".ilike.%${cleanTerm}%,"Tutor".ilike.%${cleanTerm}%`);
          fallbackIdQuery = fallbackIdQuery.limit(5000);
          ({ data: idRows, error: idError } = await fallbackIdQuery);
        }
        if (idError) throw idError;

        const matchedCourseIds = Array.from(new Set((idRows || []).map(r => r['Course ID']).filter(Boolean)));
        if (matchedCourseIds.length === 0) {
          setCourses([]);
          setCurrentPage(1);
          return;
        }

        const maxIds = 500;
        const limitedCourseIds = matchedCourseIds.slice(0, maxIds);
        if (matchedCourseIds.length > maxIds) {
          toast.error('Too many matching courses. Please refine your search.');
        }

        let rowsQuery = dataService.from('Courses_FirstWeek').select('*').in('Course ID', limitedCourseIds);
        rowsQuery = applyStatusFilter(rowsQuery);
        rowsQuery = rowsQuery.order('Start date', { ascending: true }).limit(5000);

        let rowsData;
        let rowsError;
        ({ data: rowsData, error: rowsError } = await rowsQuery);
        if (rowsError && String(rowsError.message || '').toLowerCase().includes('courses_firstweek')) {
          let fallbackRowsQuery = dataService.from('Courses').select('*').in('Course ID', limitedCourseIds);
          fallbackRowsQuery = applyStatusFilter(fallbackRowsQuery);
          fallbackRowsQuery = fallbackRowsQuery.order('Start date', { ascending: true }).limit(5000);
          ({ data: rowsData, error: rowsError } = await fallbackRowsQuery);
        }
        if (rowsError) throw rowsError;
        data = rowsData || [];
      } else {
        let q = dataService.from('Courses_FirstWeek').select('*');
        q = applyStatusFilter(q);
        q = q.order('Start date', { ascending: true }).limit(5000);
        let rowsData;
        let rowsError;
        ({ data: rowsData, error: rowsError } = await q);
        if (rowsError && String(rowsError.message || '').toLowerCase().includes('courses_firstweek')) {
          let fallbackQ = dataService.from('Courses').select('*');
          fallbackQ = applyStatusFilter(fallbackQ);
          fallbackQ = fallbackQ.order('Start date', { ascending: true }).limit(5000);
          ({ data: rowsData, error: rowsError } = await fallbackQ);
        }
        if (rowsError) throw rowsError;
        data = rowsData || [];
      }

      // Reset to page 1 on new fetch
      setCurrentPage(1);

      // Grouping Logic
      const groupedMap = new Map();
      
      const dayOrder = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 7
      };

      (data || []).forEach(row => {
          const courseId = row['Course ID'];
          if (!groupedMap.has(courseId)) {
              groupedMap.set(courseId, {
                  ...row,
                  allSessions: [],
                  allAims: [],
                  allTailoredAims: [],
                  allTutors: [],
                  allRooms: [],
                  allAwardingBodies: [],
                  allAdditionalAims: [],
                  allRowIds: []
              });
          }
          const group = groupedMap.get(courseId);
          if (!group.allRowIds.includes(row.id)) {
              group.allRowIds.push(row.id);
          }

          // Add Tutor if unique
          if (row['Tutor'] && !group.allTutors.includes(row['Tutor'])) {
              group.allTutors.push(row['Tutor']);
          }

          // Add Room if unique
          if (row['Room'] && !group.allRooms.includes(row['Room'])) {
              group.allRooms.push(row['Room']);
          }

          // Add Awarding Body if unique
          if (row['Awarding Body'] && !group.allAwardingBodies.includes(row['Awarding Body'])) {
              group.allAwardingBodies.push(row['Awarding Body']);
          }

          if (row['Additional Aims'] && !group.allAdditionalAims.includes(row['Additional Aims'])) {
              group.allAdditionalAims.push(row['Additional Aims']);
          }

          // Add Session
          // We use a key to dedup sessions (Day + Time)
          const sessionKey = `${row['Day Details']}-${row['Start time']}-${row['End time']}`;
          if (!group.allSessions.some(s => `${s.day}-${s.start}-${s.end}` === sessionKey)) {
              const primaryAims = row['AIMs'] || row['Tailored learning aims'] || '';
              const additionalAims = String(row['Additional Aims'] || '').trim();
              const sessionAims = additionalAims ? (primaryAims ? `${primaryAims} ${additionalAims}` : additionalAims) : primaryAims;
              group.allSessions.push({
                  day: row['Day Details'],
                  start: row['Start time'],
                  end: row['End time'],
                  sessionName: row['SESSIONS'],
                  aims: sessionAims,
                  startDate: row['Start date'],
                  endDate: row['End date'],
                  tutor: row['Tutor'],
                  room: row['Room']
              });
              
              // Sort sessions by Day order then Start time
              group.allSessions.sort((a, b) => {
                  const dayA = dayOrder[a.day] || 8;
                  const dayB = dayOrder[b.day] || 8;
                  if (dayA !== dayB) return dayA - dayB;
                  return a.start.localeCompare(b.start);
              });
          }

          // Add Aim
          if (row['AIMs'] && !group.allAims.some(a => a.ref === row['AIMs'])) {
              group.allAims.push({
                  ref: row['AIMs'],
                  title: row['Related Aim Title']
              });
          }

          // Add Tailored Aim
          if (row['Tailored learning aims'] && !group.allTailoredAims.some(a => a.code === row['Tailored learning aims'])) {
              group.allTailoredAims.push({
                  code: row['Tailored learning aims'],
                  title: row['Related Tailored Aim Title']
              });
          }
      });

      setCourses(Array.from(groupedMap.values()));
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('An error occurred while fetching courses.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSelectedCourse(null);
    fetchCourses(searchTerm);
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleNewCommentChange = (index, value) => {
    const updatedComments = [...newComments];
    updatedComments[index] = value;
    setNewComments(updatedComments);
  };

  const addNewCommentBox = () => {
    setNewComments([...newComments, '']);
  };

  const removeNewCommentBox = (index) => {
    const updatedComments = newComments.filter((_, i) => i !== index);
    setNewComments(updatedComments);
  };

  const handleUpdatePublishedOnWebenrol = (newValue) => {
    if (!selectedCourse) return;

    // Update local state
    setSelectedCourse({
        ...selectedCourse,
        'Published on webenrol': newValue
    });

    // Update the course in the main list as well
    setCourses(courses.map(c => c['Course ID'] === selectedCourse['Course ID'] ? { ...c, 'Published on webenrol': newValue } : c));
  };

  const handleUpdateStatus = (newStatus) => {
    if (!selectedCourse) return;

    setSelectedCourse({
        ...selectedCourse,
        'Status': newStatus
    });

    setCourses(courses.map(c => c['Course ID'] === selectedCourse['Course ID'] ? { ...c, 'Status': newStatus } : c));
  };

  const handleUpdateDeadline = async (newDeadline) => {
    if (!selectedCourse) return;

    try {
      const { error } = await dataService
        .from('Courses')
        .update({ 'Deadline': newDeadline })
        .eq('Course ID', selectedCourse['Course ID']);

      if (error) throw error;

      setSelectedCourse({
          ...selectedCourse,
          'Deadline': newDeadline
      });

      setCourses(courses.map(c => c['Course ID'] === selectedCourse['Course ID'] ? { ...c, 'Deadline': newDeadline } : c));

    } catch (err) {
      console.error('Error updating deadline:', err);
      alert('Failed to update deadline. Please try again.');
    }
  };

  const handleUpdateCourseID = async () => {
    if (!selectedCourse) return;
    const newCourseId = (courseIdInput || '').trim();
    if (!newCourseId) {
      alert('Course ID cannot be empty.');
      return;
    }
    const oldCourseId = selectedCourse['Course ID'];
    if (newCourseId === oldCourseId) {
      alert('The new Course ID is the same as the current one.');
      return;
    }

    // Update a single Courses row by its UUID — the DB trigger (trg_propagate_course_id)
    // cascades the rename to all sibling rows and child tables automatically.
    // Using .eq('id', ...) avoids the "tuple already modified" conflict that occurs
    // when updating multiple rows with .eq('Course ID', ...) triggers simultaneous updates.
    const targetId = selectedCourse.allRowIds?.[0] ?? selectedCourse.id;
    if (!targetId) {
      alert('Cannot update Course ID: row identifier not found.');
      return;
    }
    const { error: coursesError } = await dataService
      .from('Courses')
      .update({ 'Course ID': newCourseId })
      .eq('id', targetId);

    if (coursesError) {
      console.error('Error updating Course ID:', coursesError);
      alert(`Failed to update Course ID: ${coursesError.message}`);
      return;
    }

    // Update local React state
    setSelectedCourse({ ...selectedCourse, 'Course ID': newCourseId });
    setCourses(courses.map(c =>
      c['Course ID'] === oldCourseId ? { ...c, 'Course ID': newCourseId } : c
    ));
    toast.success(`Course ID renamed to "${newCourseId}"`);
  };

  const getStatusColorClass = (status) => {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'pending') return 'bg-red-100 text-red-800';
    if (s === 'live') return 'bg-blue-100 text-blue-800';
    if (s === 'closed' || s === 'completed' || s === 'ended') return 'bg-green-100 text-green-800';
    if (s === 'planned') return 'bg-yellow-100 text-yellow-800';
    if (s === 'incomplete') return 'bg-orange-100 text-orange-800';
    if (s === 'cancelled' || s === 'not started') return 'bg-gray-100 text-gray-800';
    if (s === 'errors') return 'bg-red-200 text-red-900';
    return 'bg-gray-100 text-gray-800';
  };

  const handleSaveAll = async () => {
    if (!selectedCourse) return;
    setSavingComments(true);

    try {
      // Get current user initials
      const { data: { user } } = await dataService.auth.getUser();
      let initials = 'SYS';
      if (user && user.email) {
          if (user.email === 'development@haringeylearns.ac.uk') initials = 'GJ';
          else if (user.email.includes('iona.oakley')) initials = 'IO';
          else {
              const parts = user.email.split('@')[0].split('.');
              if (parts.length >= 2) {
                  initials = (parts[0][0] + parts[1][0]).toUpperCase();
              } else {
                  initials = parts[0].substring(0, 2).toUpperCase();
              }
          }
      }

      const updates = {
          'Published on webenrol': selectedCourse['Published on webenrol'],
          'Status': selectedCourse['Status']
      };

      // Handle Comments
      const validComments = newComments.filter(c => c.trim() !== '');
      if (validComments.length > 0) {
          const timestamp = format(new Date(), 'dd/MM/yy, HH:mm');
          const formattedComments = validComments.map(c => `(${timestamp}, ${initials}) ${c}`).join('\n');
          
          const previousComments = selectedCourse['Comments'] || '';
          const updatedComments = previousComments 
              ? `${previousComments}\n${formattedComments}`
              : formattedComments;
          
          updates['Comments'] = updatedComments;

          // Insert Notification
          try {
             const userEmail = user?.email || 'System';
             const { error: notifError } = await dataService
               .from('notifications')
               .insert([{
                  email: userEmail,
                  comments: formattedComments,
                  "Course ID": selectedCourse['Course ID']
               }]);
               
             if (notifError) {
                console.error('Backend Notification Insert Error (OurCourses):', notifError);
                throw notifError;
             }
          } catch (err) {
             console.error('Error creating notification:', err);
             // Non-blocking
          }
          
          // Optimistic update for comments
          setSelectedCourse(prev => ({ ...prev, 'Comments': updatedComments }));
          setNewComments(['']);
      }

      const { error } = await dataService
        .from('Courses')
        .update(updates)
        .eq('Course ID', selectedCourse['Course ID']);

      if (error) throw error;

      // Update main list
      setCourses(courses.map(c => c['Course ID'] === selectedCourse['Course ID'] ? { ...c, ...updates } : c));
      
      fetchGlobalCounts();
      
      toast.success('All changes saved successfully');

    } catch (err) {
      console.error('Error saving changes:', err);
      toast.error('Failed to save changes.');
    } finally {
      setSavingComments(false);
    }
  };

  const InfoBox = ({ title, content, fieldName }) => {
    // Content can be empty, we still show the box

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 px-1">{title}</h3>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 relative hover:shadow-md transition-shadow min-h-[100px]">
          <div className="flex justify-between items-start h-full">
            <div className="text-gray-600 whitespace-pre-wrap flex-grow pr-4">{content || ''}</div>
            <button
              onClick={() => copyToClipboard(content, fieldName)}
              className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                copiedField === fieldName
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Copy content"
            >
              {copiedField === fieldName ? <FiCheck size={16} /> : <FiCopy size={16} />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ListWithCopy = ({ label, items, fieldPrefix, fullWidth = false }) => {
    // Filter out empty/null/undefined items
    const validItems = items ? items.filter(Boolean) : [];
    
    // If no items, don't render anything (similar to DetailItem behavior)
    if (validItems.length === 0) return null;

    return (
        <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${fullWidth ? 'col-span-full' : ''}`}>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</div>
            <div className="flex flex-col gap-2">
                {validItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-2 border-b border-gray-50 last:border-0 pb-1 last:pb-0">
                        <span className="text-gray-900 font-medium break-words">{item}</span>
                        <button
                            onClick={() => copyToClipboard(item, `${fieldPrefix}_${idx}`)}
                            className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                                copiedField === `${fieldPrefix}_${idx}`
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Copy"
                        >
                            {copiedField === `${fieldPrefix}_${idx}` ? <FiCheck size={14} /> : <FiCopy size={14} />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const DetailItem = ({ label, value, fieldName, fullWidth = false }) => {
    if (!value && value !== 0) return null;
    return (
        <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${fullWidth ? 'col-span-full' : ''}`}>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="flex justify-between items-start gap-2">
                <div className="text-gray-900 font-medium break-words whitespace-pre-wrap">{value}</div>
                <button
                    onClick={() => copyToClipboard(value, fieldName)}
                    className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                        copiedField === fieldName
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Copy"
                >
                    {copiedField === fieldName ? <FiCheck size={14} /> : <FiCopy size={14} />}
                </button>
            </div>
        </div>
    );
  };

  const SectionTitle = ({ title }) => (
    <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2">{title}</h3>
  );

  const formatDate = (dateStr, fmt = 'dd/MM/yyyy') => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), fmt);
    } catch (e) {
      return dateStr;
    }
  };

  const formatHeaderDate = (dateStr) => {
    return formatDate(dateStr, 'd MMM yyyy'); // e.g. 21 Jan 2026
  };

  const HeaderItem = ({ label, value, fieldName, fullWidth = false, className = '' }) => {
    if (!value) return null;
    return (
        <div className={`flex flex-col ${fullWidth ? 'col-span-full' : ''} ${className}`}>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</span>
            <div className="flex items-center gap-2 group">
                <span className="font-medium text-gray-900 whitespace-pre-wrap">{value}</span>
                <button
                    onClick={() => copyToClipboard(value, fieldName)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md ${
                        copiedField === fieldName
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Copy"
                >
                    {copiedField === fieldName ? <FiCheck size={14} /> : <FiCopy size={14} />}
                </button>
            </div>
        </div>
    );
  };

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = courses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(courses.length / itemsPerPage);

  return (
    <div className="p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Our Courses</h1>
        <p className="text-gray-600">Browse all courses or search by ID, Name or Tutor to view details.</p>
      </div>

      {/* Search Bar & Filter */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-64 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => {
                const newStatus = e.target.value;
                setStatusFilter(newStatus);
                fetchCourses(searchTerm, newStatus);
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-lg bg-white"
            >
              <option value="Pending">Pending</option>
              <option value="Not started">Not started</option>
              <option value="All">All</option>
              <option value="Planned">Planned</option>
              <option value="Live">Live</option>
              <option value="Incomplete">Incomplete</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Errors">Errors</option>
              <option value="Ended">Ended</option>
              <option value="Completed">Completed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <form onSubmit={handleSearch} className="relative flex items-center flex-grow">
            <FiSearch className="absolute left-4 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search Course ID, Name or Tutor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-lg"
            />
            <button
              type="submit"
              className="absolute right-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          <div className="flex items-center gap-3 shrink-0">
             <button
                onClick={() => { fetchCourses(); fetchGlobalCounts(); }}
                className="p-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
                title="Refresh courses"
             >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
             </button>
             <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 shadow-sm">
                <span className="text-sm font-semibold whitespace-nowrap">• Total: {globalCounts.total}</span>
             </div>
             <div className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-xl border border-green-100 shadow-sm">
                <span className="text-sm font-semibold whitespace-nowrap">• Live: {globalCounts.live}</span>
             </div>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-center">
            <FiInfo className="mr-2" />
            {error}
          </div>
        )}
      </div>

      {selectedCourse ? (
        // Detailed View
        <div className="animate-fade-in pb-10">
          <button 
            onClick={() => setSelectedCourse(null)}
            className="flex items-center text-blue-600 font-medium mb-6 hover:text-blue-800 transition-colors"
          >
            <FiArrowLeft className="mr-2" /> Back to Courses
          </button>

          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{selectedCourse['Course Name']}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <HeaderItem label="Course Code" value={selectedCourse['Course ID']} fieldName="course_code" />
                    <HeaderItem label="Places" value={selectedCourse['Room Capacity']} fieldName="places" />
                    <HeaderItem label="Start Date" value={formatHeaderDate(selectedCourse['Start date'])} fieldName="start_date" />
                    <HeaderItem label="End Date" value={formatHeaderDate(selectedCourse['End date'])} fieldName="end_date" />
                    <HeaderItem label="Weeks" value={selectedCourse['Course No of Weeks'] ? `${selectedCourse['Course No of Weeks']} weeks` : ''} fieldName="weeks" />
                    <HeaderItem 
                        label="Sessions" 
                        value={selectedCourse.allSessions?.map(s => {
                            let text = `${s.sessionName ? s.sessionName + ': ' : ''}${s.day}, ${s.start} - ${s.end}`;
                            if (s.aims) text += `, ${s.aims}`;
                            if (s.startDate && s.endDate) {
                                try {
                                    const start = format(new Date(s.startDate), 'dd/MM/yyyy');
                                    const end = format(new Date(s.endDate), 'dd/MM/yyyy');
                                    text += `, From ${start} to ${end}`;
                                } catch (e) {
                                    text += `, From ${s.startDate} to ${s.endDate}`;
                                }
                            }
                            if (s.tutor) text += `, ${s.tutor}`;
                            if (s.room) text += `, ${s.room}`;
                            return text;
                        }).join('\n') || `${selectedCourse['SESSIONS'] || ''}: ${selectedCourse['Day Details'] || ''}, ${selectedCourse['Start time']} - ${selectedCourse['End time']}`} 
                        fieldName="sessions" 
                        className="col-span-3"
                    />
                    <HeaderItem 
                        label="Where" 
                        value={(() => {
                            const rooms = selectedCourse.allRooms && selectedCourse.allRooms.length > 0
                                ? selectedCourse.allRooms
                                : (selectedCourse['Room'] ? [selectedCourse['Room']] : []);
                            const locations = rooms
                                .map(roomName => {
                                    const found = roomsData.find(r => r.room_number === roomName);
                                    return found?.location || null;
                                })
                                .filter(Boolean);
                            const uniqueLocations = [...new Set(locations)];
                            return uniqueLocations.length > 0 ? uniqueLocations.join(' | ') : 'Location not available';
                        })()} 
                        fieldName="address" 
                        fullWidth={true} 
                    />
                </div>
            </div>

            <SectionTitle title="Course Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <ListWithCopy 
                    label="Tutor" 
                    items={selectedCourse.allTutors && selectedCourse.allTutors.length > 0 ? selectedCourse.allTutors : [selectedCourse['Tutor']]} 
                    fieldPrefix="tutor" 
                 />
                 <ListWithCopy 
                    label="Room" 
                    items={selectedCourse.allRooms && selectedCourse.allRooms.length > 0 ? selectedCourse.allRooms : [selectedCourse['Room']]} 
                    fieldPrefix="room" 
                 />
                 
                 <DetailItem label="Mode of Delivery" value={selectedCourse['Mode of Delivery']} fieldName="mode" />
                 <ListWithCopy 
                    label="Awarding Body" 
                    items={selectedCourse.allAwardingBodies && selectedCourse.allAwardingBodies.length > 0 ? selectedCourse.allAwardingBodies : [selectedCourse['Awarding Body']]} 
                    fieldPrefix="awarding_body" 
                 />
                 <DetailItem label="Curriculum Area" value={selectedCourse['Curriculum Area']} fieldName="curriculum_area" />
                 <DetailItem label="Curriculum Manager" value={selectedCourse['Curriculum Manager']} fieldName="curriculum_manager" />
                 <ListWithCopy 
                    label="AIMs (Ref)" 
                    items={selectedCourse.allAims && selectedCourse.allAims.length > 0 ? selectedCourse.allAims.map(a => a.ref) : [selectedCourse['AIMs']]} 
                    fieldPrefix="aims" 
                 />
                 <ListWithCopy 
                    label="Aim Title" 
                    items={selectedCourse.allAims && selectedCourse.allAims.length > 0 ? selectedCourse.allAims.map(a => a.title) : [selectedCourse['Related Aim Title']]} 
                    fieldPrefix="aim_title" 
                 />
                 <ListWithCopy 
                    label="Tailored Aim (Code)" 
                    items={selectedCourse.allTailoredAims && selectedCourse.allTailoredAims.length > 0 ? selectedCourse.allTailoredAims.map(a => a.code) : [selectedCourse['Tailored learning aims']]} 
                    fieldPrefix="tailored_aims" 
                 />
                 <ListWithCopy 
                    label="Tailored Aim Title" 
                    items={selectedCourse.allTailoredAims && selectedCourse.allTailoredAims.length > 0 ? selectedCourse.allTailoredAims.map(a => a.title) : [selectedCourse['Related Tailored Aim Title']]} 
                    fieldPrefix="tailored_aim_title" 
                 />
                 <DetailItem label="GLH" value={selectedCourse['GLH (Awarding Body)']} fieldName="glh" />
                 <DetailItem label="Planned Hours" value={selectedCourse['Planned numbers of hours']} fieldName="planned_hours" />
                 <DetailItem label="Sessions per Week" value={selectedCourse['No. of Sessions per Week']} fieldName="sessions_per_week" />
                 <DetailItem label="Hours per Week" value={selectedCourse['No of Hours per Week']} fieldName="hours_per_week" />
                 <DetailItem label="Total Sessions" value={selectedCourse['Total number of Sessions']} fieldName="total_sessions" />
                 <DetailItem label="Total Aim's Hours" value={selectedCourse["Total Aim's Hours"]} fieldName="total_aim_hours" />
                 <DetailItem label="Actual Enrolment" value={selectedCourse['Actual Enrolment']} fieldName="actual_enrolment" />
                 
                 <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Deadline</div>
                    {user ? (
                        <input
                            type="date"
                            value={selectedCourse['Deadline'] || ''}
                            onChange={(e) => handleUpdateDeadline(e.target.value)}
                            className="w-full p-0 border-none bg-transparent font-medium text-gray-900 focus:ring-0"
                        />
                    ) : (
                        <div className="text-gray-900 font-medium">
                            {formatDate(selectedCourse['Deadline']) || '-'}
                        </div>
                    )}
                 </div>

                 <DetailItem label="BKSB Initial Assessment" value={selectedCourse['BKSB Initial Assessment']} fieldName="bksb" />
                 <ListWithCopy
                   label="Additional Aims"
                   items={additionalAimsRefs}
                   fieldPrefix="additional_aims"
                 />
            </div>

            <SectionTitle title="Tutor Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <DetailItem label="Tutor Subject" value={selectedCourse['Tutor Subject']} fieldName="tutor_subject" />
                 <DetailItem label="Tutor Availability" value={selectedCourse['Tutor availability']} fieldName="tutor_availability" />
                 <DetailItem label="Tutor Rate" value={selectedCourse['Tutor Rate']} fieldName="tutor_rate" />
            </div>

            <SectionTitle title="Course Details" />
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(num => (
                    <InfoBox 
                        key={num} 
                        title={`Learning Objective ${num}`} 
                        content={selectedCourse[`Learning objective ${num}`]} 
                        fieldName={`obj_${num}`} 
                    />
                ))}

                <InfoBox title="Single Sentence Description" content={selectedCourse['Single sentence description']} fieldName="single_desc" />
                <InfoBox title="What is the course about?" content={selectedCourse['What is the course about?']} fieldName="about" />
                <InfoBox title="Who is the course for?" content={selectedCourse['Who is the course for?'] || selectedCourse['Who is this course for?']} fieldName="who_for" />
                <InfoBox title="Are there any entry requirements?" content={selectedCourse['Are there any entry requirements?']} fieldName="entry_req" />
                <InfoBox title="Do I need to have an interview before I can enrol?" content={selectedCourse['Do I need to have an interview before I can enrol?']} fieldName="interview" />
                <InfoBox title="How will I be taught?" content={selectedCourse['How will I be taught?']} fieldName="taught" />
                <InfoBox title="What feedback will I get?" content={selectedCourse['What feedback will I get?']} fieldName="feedback" />
                <InfoBox title="How will I be able to give my views on the course?" content={selectedCourse['How will I be able to give my views on the course?']} fieldName="views" />
                <InfoBox title="What course can I do next?" content={selectedCourse['What course can I do next?']} fieldName="next" />
                <InfoBox title="Additional Information" content={selectedCourse['Additional Information']} fieldName="additional" />
                <InfoBox title="Assessment methods" content={selectedCourse['Assessment methods']} fieldName="assessment" />
                <InfoBox title="Equipment required" content={selectedCourse['Equipment required']} fieldName="equipment" />
                
                {/* Status & Comments Section - Only for logged in users */}
                {user && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2">Status & Comments</h3>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Course ID</label>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{selectedCourse['Course ID'] || '-'}</span>
                              <button
                                onClick={() => copyToClipboard(selectedCourse['Course ID'] || '', 'course_id')}
                                className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                title="Copy Course ID"
                              >
                                Copy
                              </button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Course ID</label>
                            <div className="flex gap-2">
                              <input
                                  type="text"
                                  value={courseIdInput}
                                  onChange={(e) => setCourseIdInput(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                  placeholder="Enter Course ID"
                              />
                              <button
                                  onClick={handleUpdateCourseID}
                                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm"
                                  title="Save Course ID"
                              >
                                  Save
                              </button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Published on webenrol</label>
                            <select
                                value={selectedCourse['Published on webenrol'] || 'No'}
                                onChange={(e) => handleUpdatePublishedOnWebenrol(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={selectedCourse['Status'] || 'Pending'}
                                onChange={(e) => handleUpdateStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="Pending">Pending</option>
                                <option value="Not started">Not started</option>
                                <option value="Planned">Planned</option>
                                <option value="Live">Live</option>
                                <option value="Incomplete">Incomplete</option>
                                <option value="Cancelled">Cancelled</option>
                            <option value="Errors">Errors</option>
                            <option value="Ended">Ended</option>
                                <option value="Completed">Completed</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Previous Comments</label>
                            <textarea
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 min-h-[80px]"
                                rows={3}
                                value={selectedCourse['Comments'] || ''}
                                readOnly
                                placeholder="No previous comments..."
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Add New Comments</label>
                            {newComments.map((comment, index) => (
                                <div key={index} className="flex gap-2">
                                    <textarea
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 min-h-[60px]"
                                        rows={2}
                                        value={comment}
                                        onChange={e => handleNewCommentChange(index, e.target.value)}
                                        placeholder="Enter new comment..."
                                    />
                                    {newComments.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => removeNewCommentBox(index)} 
                                            className="text-red-500 self-center hover:text-red-700 transition-colors"
                                            title="Remove comment"
                                        >
                                            <FiTrash size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            
                            <div className="flex justify-between items-center mt-2">
                                <button 
                                    type="button" 
                                    onClick={addNewCommentBox} 
                                    className="text-blue-600 text-sm flex items-center hover:text-blue-800 transition-colors"
                                >
                                    <FiPlus className="mr-1" /> Add comment
                                </button>

                                <button
                                    onClick={handleSaveAll}
                                    disabled={savingComments}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
                                >
                                    {savingComments ? 'Saving...' : <><FiSave className="mr-2" /> Save All Changes</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      ) : (
        // List View
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {currentItems.map((course) => (
                <div 
                  key={course.id || course['Course ID']} 
                  onClick={() => setSelectedCourse(course)}
                  className={`rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between ${
                    isCourseUrgent(course) 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                          {course['Course ID']}
                        </span>
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${getStatusColorClass(course['Status'])}`}>
                          {course['Status'] || 'Pending'}
                        </span>
                      </div>
                      <span className="text-gray-400 text-sm">{course['Room']}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2">
                      {course['Course Name']}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex items-start">
                        <FiCalendar className="mr-2 text-gray-400 mt-1" />
                        <div className="flex flex-col gap-1 w-full">
                          {course.allSessions && course.allSessions.length > 0 ? (
                            course.allSessions.map((s, i) => (
                               <span key={i} className="text-sm">
                                 {s.day}, {s.start} - {s.end}
                               </span>
                            ))
                          ) : (
                            <span>
                               {course['Day Details'] ? `${course['Day Details']}, ` : ''}
                               {course['Start time']} - {course['End time']}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 mt-1">
                            {formatDate(course['Start date'])} - {formatDate(course['End date'])}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <FiUser className="mr-2 text-gray-400" />
                        <span className="truncate">{course['Tutor'] || 'No Tutor Assigned'}</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-full mt-2 py-2 text-blue-600 font-medium bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    View Details
                  </button>
                </div>
              ))}
              {courses.length === 0 && !loading && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No courses found. Try a different search term.
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {courses.length > 0 && (
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-sm text-gray-600">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, courses.length)} of {courses.length} courses
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex items-center mr-4">
                            <span className="text-sm text-gray-600 mr-2">Rows:</span>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-6 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value={12}>12</option>
                                <option value={24}>24</option>
                                <option value={48}>48</option>
                                <option value={96}>96</option>
                            </select>
                        </div>

                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                            title="First Page"
                        >
                            <FiChevronsLeft />
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                            title="Previous Page"
                        >
                            <FiChevronLeft />
                        </button>
                        
                        <span className="text-sm font-medium text-gray-900 min-w-[3rem] text-center">
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                            title="Next Page"
                        >
                            <FiChevronRight />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                            title="Last Page"
                        >
                            <FiChevronsRight />
                        </button>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default OurCoursesView;
