
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiSearch, FiBook, FiRefreshCw, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { format } from 'date-fns';

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
];

const BackupCoursesView = () => {
  const { isSuperuser } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tutorFilter, setTutorFilter] = useState('');

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await dataService
        .from('Courses Backup')
        .select('*')
        .order('Start date', { ascending: true });

      if (error) throw error;

      if (data) {
        setCourses(data);
      } else {
        setCourses([]);
      }
    } catch (error) {
      console.error('Error fetching backup courses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();

    // Subscribe to real-time changes
    const channel = dataService
      .channel('course-backup-view-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Courses Backup' }, (payload) => {
        // console.log('Real-time update in BackupCoursesView:', payload);
        fetchCourses();
      })
      .subscribe();

    return () => {
      dataService.removeChannel(channel);
    };
  }, [fetchCourses]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
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
  }, [courses, searchTerm, tutorFilter]);

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
    link.setAttribute('download', `courses_backup_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isSuperuser()) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Access Denied. Only Superusers can view backups.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 flex flex-col xl:flex-row justify-between items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-blue-50 p-2 rounded-lg">
              <SafeIcon icon={FiBook} className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Course Backup List</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search backups..."
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
              {COLUMNS.map(col => (
                <th key={col} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((course, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors group">
                  {COLUMNS.map(col => (
                    <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center group/cell">
                        <span>
                          {typeof course[col] === 'object' && course[col] !== null 
                            ? JSON.stringify(course[col]) 
                            : String(course[col] || '')}
                        </span>
                        {(col === 'SESSIONS' || col === 'Course ID') && course[col] && (
                          <CopyButton text={String(course[col])} />
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                      <SafeIcon icon={FiBook} className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="font-medium">No backup courses found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BackupCoursesView;
