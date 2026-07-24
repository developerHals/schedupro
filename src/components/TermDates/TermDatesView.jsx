import React, { useEffect, useMemo, useState } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiAlertCircle, FiCheck, FiCopy, FiLoader, FiRefreshCw, FiPlus } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { format, isValid, parse, parseISO } from 'date-fns';
import AddNewYearModal from './AddNewYearModal';

const pickKey = (row, candidates) => {
  if (!row) return null;
  const keys = Object.keys(row);
  const byLower = new Map(keys.map(k => [k.toLowerCase(), k]));
  for (const candidate of candidates) {
    const hit = byLower.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return null;
};

const parseDateSafe = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value !== 'string') return null;

  const iso = parseISO(value);
  if (isValid(iso)) return iso;

  const formats = ['dd/MM/yyyy', 'd/M/yyyy', 'dd/MM/yy', 'd/M/yy'];
  for (const fmt of formats) {
    const d = parse(value, fmt, new Date());
    if (isValid(d)) return d;
  }

  return null;
};

const normalizeDateYMD = (value) => {
  const d = parseDateSafe(value);
  return d ? format(d, 'yyyy-MM-dd') : '';
};

const formatDateDMY = (value) => {
  const d = parseDateSafe(value);
  if (d) return format(d, 'dd/MM/yyyy');
  return value ? String(value) : '';
};

const TermDatesView = () => {
  const { isSuperuser } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedTable, setResolvedTable] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [filters, setFilters] = useState({
    academicYear: '',
    term: '',
    description: '',
    day: '',
    date: ''
  });

  const [fieldKeys, setFieldKeys] = useState({
    academicYear: null,
    term: null,
    description: null,
    day: null,
    date: null
  });

  const fetchTermDates = async () => {
    setLoading(true);
    setError('');

    const { data, error: qError } = await dataService
      .from('holidays')
      .select('*')
      .limit(5000);

    if (qError) {
      setRows([]);
      setResolvedTable('');
      setFieldKeys({ academicYear: null, term: null, description: null, day: null, date: null });
      if (qError.code === '42P01') {
        setError('Could not find the table "public.holidays" in Backend.');
      } else {
        setError(qError.message || 'Failed to load term dates.');
      }
      setLoading(false);
      return;
    }

    const firstRow = (data || [])[0] || null;
    const resolvedKeys = {
      academicYear: pickKey(firstRow, ['Academic Year', 'academic_year', 'AcademicYear']) || 'Academic Year',
      term: pickKey(firstRow, ['Term', 'term']) || 'Term',
      description: pickKey(firstRow, ['Description', 'description']) || 'Description',
      day: pickKey(firstRow, ['Day', 'day', 'Day of week', 'DayOfWeek']) || 'Day',
      date: pickKey(firstRow, ['Date', 'date', 'Term Date', 'TermDate']) || 'Date'
    };

    setResolvedTable('holidays');
    setFieldKeys(resolvedKeys);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTermDates();
  }, []);

  const filteredRows = useMemo(() => {
    const get = (row, key) => (key ? row?.[key] : undefined);
    const contains = (val, q) => {
      if (!q) return true;
      return String(val ?? '').toLowerCase().includes(q.toLowerCase());
    };

    const normalizedFilterDate = filters.date ? normalizeDateYMD(filters.date) : '';

    return (rows || [])
      .filter(row => {
        return (
          contains(get(row, fieldKeys.academicYear), filters.academicYear) &&
          contains(get(row, fieldKeys.term), filters.term) &&
          contains(get(row, fieldKeys.description), filters.description) &&
          contains(get(row, fieldKeys.day), filters.day) &&
          (!normalizedFilterDate || normalizeDateYMD(get(row, fieldKeys.date)) === normalizedFilterDate)
        );
      })
      .sort((a, b) => {
        const da = normalizeDateYMD(get(a, fieldKeys.date));
        const db = normalizeDateYMD(get(b, fieldKeys.date));
        if (da && db) return da.localeCompare(db);
        if (da) return -1;
        if (db) return 1;
        return 0;
      });
  }, [rows, filters, fieldKeys]);

  const copyToClipboard = (value, key) => {
    if (!value) return;
    navigator.clipboard.writeText(String(value));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center p-6 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Term dates</h1>
          <p className="text-sm text-gray-500 mt-1">
            {resolvedTable ? `Source: ${resolvedTable}` : 'School term dates'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperuser() && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-sm"
            >
              <SafeIcon icon={FiPlus} className="h-5 w-5 mr-2" />
              Add New Year
            </button>
          )}
          <button
            onClick={fetchTermDates}
            className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold transition-colors shadow-sm"
            title="Refresh"
          >
            <SafeIcon icon={FiRefreshCw} className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 bg-white border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Academic Year</label>
            <input
              type="text"
              value={filters.academicYear}
              onChange={(e) => setFilters(prev => ({ ...prev, academicYear: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 2025/26"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Term</label>
            <input
              type="text"
              value={filters.term}
              onChange={(e) => setFilters(prev => ({ ...prev, term: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Spring"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
            <input
              type="text"
              value={filters.description}
              onChange={(e) => setFilters(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Half-term"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Day</label>
            <input
              type="text"
              value={filters.day}
              onChange={(e) => setFilters(prev => ({ ...prev, day: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Monday"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <SafeIcon icon={FiLoader} className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center">
            <SafeIcon icon={FiAlertCircle} className="h-5 w-5 mr-2" />
            {error}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Academic Year</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No matching term dates found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => {
                      const id = row.id || row.created_at || `${idx}`;
                      const ay = fieldKeys.academicYear ? row[fieldKeys.academicYear] : '';
                      const term = fieldKeys.term ? row[fieldKeys.term] : '';
                      const desc = fieldKeys.description ? row[fieldKeys.description] : '';
                      const day = fieldKeys.day ? row[fieldKeys.day] : '';
                      const dateVal = fieldKeys.date ? row[fieldKeys.date] : '';
                      const displayDate = formatDateDMY(dateVal);
                      const copyKey = `date_${id}`;

                      return (
                        <tr key={id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{ay}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{term}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{desc}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{day}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="flex items-center gap-2 group">
                              <span>{displayDate}</span>
                              <button
                                onClick={() => copyToClipboard(displayDate, copyKey)}
                                className={`p-1 transition-all duration-200 ${
                                  copiedKey === copyKey
                                    ? 'text-green-600 opacity-100'
                                    : 'text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-blue-600'
                                }`}
                                title="Copy date"
                              >
                                <SafeIcon icon={copiedKey === copyKey ? FiCheck : FiCopy} className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {showAddModal && (
        <AddNewYearModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchTermDates(); }}
        />
      )}
    </div>
  );
};

export default TermDatesView;
