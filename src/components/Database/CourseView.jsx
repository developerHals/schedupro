import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { learnerTrackService } from '../../lib/learnerTrackService';
import { FiSearch, FiBook, FiRefreshCw, FiDownload, FiCopy, FiCheck, FiClock, FiBell } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../common/SafeIcon';
import { format } from 'date-fns';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
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

// Editable inline text cell for local override fields (local_notes / local_status).
// Saves on blur; shows a brief "Saved" indicator.
const OverrideCell = ({ value, placeholder, onSave }) => {
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
      className="w-full min-w-[140px] px-2 py-1 text-sm border border-transparent rounded-md hover:border-gray-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 bg-transparent disabled:opacity-50"
    />
  );
};

const COLUMNS = [
  { key: 'CourseCode', label: 'Course Code' },
  { key: 'CourseTitle', label: 'Course Title' },
  { key: 'CatLabel', label: 'Category' },
  { key: 'ProviderLabel', label: 'Provider' },
  { key: 'LocationLabel', label: 'Location' },
  { key: 'Tutor', label: 'Tutor' },
  { key: 'AcademicYear', label: 'Academic Year' },
  { key: 'StartTerm', label: 'Term' },
  { key: 'Times', label: 'Times' },
  { key: 'Weeks', label: 'Weeks' },
  { key: 'AvailablePlaces', label: 'Places' },
  { key: 'Level', label: 'Level' },
  { key: 'OptionGroup', label: 'Option Group' },
];

const CourseView = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [tutorInput, setTutorInput] = useState('');
  const [academicYearInput, setAcademicYearInput] = useState('');

  const [searchFilter, setSearchFilter] = useState('');
  const [tutorFilter, setTutorFilter] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const fetchCourses = useCallback(async () => {
    if (courses.length === 0) setLoading(true);
    try {
      const data = await learnerTrackService.getCourses({
        search: searchFilter || undefined,
        tutor: tutorFilter || undefined,
        academicYear: academicYearFilter || undefined,
      });
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching Learner Track courses:', error);
      toast.error(`Failed to load courses: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [searchFilter, tutorFilter, academicYearFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, tutorFilter, academicYearFilter]);

  const handleKeyDown = (e, filterType) => {
    if (e.key !== 'Enter') return;
    if (filterType === 'search') setSearchFilter(searchInput);
    if (filterType === 'tutor') setTutorFilter(tutorInput);
    if (filterType === 'academicYear') setAcademicYearFilter(academicYearInput);
  };

  const totalCoursesCount = courses.length;

  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return courses.slice(startIndex, startIndex + itemsPerPage);
  }, [courses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(courses.length / itemsPerPage);

  const handleSaveOverride = async (course, field, value) => {
    const updated = await learnerTrackService.patchCourseOverride({
      course_instance_id: course.ID,
      [field]: value,
    });
    setCourses((prev) =>
      prev.map((c) => (c.ID === course.ID ? { ...c, [field]: updated[field] } : c))
    );
  };

  const handleExportCSV = () => {
    if (courses.length === 0) return;
    const headers = COLUMNS.map((c) => c.label).concat(['Local Notes']);
    const csvContent = [
      headers.join(','),
      ...courses.map((course) =>
        COLUMNS.map((c) => {
          const val = course[c.key];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : (val ?? '');
        })
          .concat([course.local_notes || ''])
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lt_courses_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-gray-900">Courses</h2>
            <span className="text-xs text-gray-400">Synced from Learner Track</span>
          </div>

          <div className="flex items-center space-x-3">
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

        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto flex-wrap">
            <div className="relative w-full sm:w-64">
              <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search title/code... (Enter)"
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
            <div className="relative w-full sm:w-40">
              <input
                type="text"
                placeholder="Academic Year..."
                value={academicYearInput}
                onChange={(e) => setAcademicYearInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'academicYear')}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-blue-700">Total: {totalCoursesCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100">
                  {col.label}
                </th>
              ))}
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100">
                Local Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedCourses.length > 0 ? (
              paginatedCourses.map((course) => (
                <tr key={course.ID} className="hover:bg-gray-50/50 transition-colors group">
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center group/cell">
                        <span>{String(course[col.key] ?? '')}</span>
                        {col.key === 'CourseCode' && course[col.key] && <CopyButton text={String(course[col.key])} />}
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-2 text-sm">
                    <OverrideCell
                      value={course.local_notes}
                      placeholder="Add note..."
                      onSave={(val) => handleSaveOverride(course, 'local_notes', val)}
                    />
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

      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, courses.length)}</span> to{' '}
          <span className="font-medium">{Math.min(currentPage * itemsPerPage, courses.length)}</span> of{' '}
          <span className="font-medium">{courses.length}</span> results
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

export default CourseView;
