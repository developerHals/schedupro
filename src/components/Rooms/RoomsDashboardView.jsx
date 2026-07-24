import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { dataService } from '../../lib/dataService';
import { FiRefreshCw, FiAlertCircle, FiSettings } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n, decimals = 1) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(decimals));
const fmtPct = (n) => (n == null || isNaN(n) ? '—' : `${fmt(n, 1)}%`);
const fmtGbp = (n) => (n == null || isNaN(n) ? '—' : `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const parseHours = (start, end) => {
  if (!start || !end) return 0;
  const toMins = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const diff = toMins(end) - toMins(start);
  return diff > 0 ? diff / 60 : 0;
};

const EXCLUDED_ROOMS = ['ON (Online 1)', 'ON (Online 2)', 'IN (Ingues)'];
const ALL_TERMS = 'All Terms';
const TERM_OPTIONS = [ALL_TERMS, '1-Autumn Term', '2-Spring Term', '3-Summer Term'];

const CURRENT_YEAR = (() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const yy = String(y).slice(-2);
  const yyNext = String(y + 1).slice(-2);
  const yyPrev = String(y - 1).slice(-2);
  return m >= 8 ? `${yy}-${yyNext}` : `${yyPrev}-${yy}`;
})();

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KPICard = ({ label, value, sub, color = 'blue' }) => {
  const colors = {
    blue:   'bg-blue-50  border-blue-200  text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`border rounded-xl px-4 py-3 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
      {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
    </div>
  );
};

// ── Variables modal ───────────────────────────────────────────────────────────

const VariablesModal = ({ variables, academicYear, onClose, onSaved }) => {
  const existing = variables.find(v => v.academic_year === academicYear);
  const [form, setForm] = useState({
    company_name:   existing?.company_name   ?? '',
    address:        existing?.address        ?? '',
    num_weeks:      existing?.num_weeks      ?? '',
    weekly_hours:   existing?.weekly_hours   ?? '',
    academic_year:  academicYear,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (existing?.id) {
        const { error } = await dataService.from('variables').update(form).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await dataService.from('variables').insert([form]);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Dashboard Variables — {academicYear}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {[
            { key: 'company_name',  label: 'Company Name',           type: 'text'   },
            { key: 'address',       label: 'Address',                type: 'text'   },
            { key: 'num_weeks',     label: 'Number of Open Weeks',   type: 'number' },
            { key: 'weekly_hours',  label: 'Weekly Opening Hours',   type: 'number' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
            {saving && <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export default function RoomsDashboardView() {
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [courses, setCourses]       = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [rooms, setRooms]           = useState([]);
  const [variables, setVariables]   = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear]   = useState('');
  const [selectedTerm, setSelectedTerm]   = useState(ALL_TERMS);
  const [showVarsModal, setShowVarsModal] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        { data: cData, error: cErr },
        { data: bData, error: bErr },
        { data: rData, error: rErr },
        { data: vData, error: vErr },
      ] = await Promise.all([
        dataService.from('Courses').select('"Academic Year", "Term", "Room", "Start time", "End time", "Planned numbers of hours"'),
        dataService.from('bookings').select('"Room", "Course ID", "Start time", "End time", "Start date", fees').range(0, 9999),
        dataService.from('rooms').select('id, room_number'),
        dataService.from('variables').select('*'),
      ]);
      if (cErr) throw cErr;
      if (bErr) throw bErr;
      if (rErr) throw rErr;
      if (vErr) throw vErr;

      setCourses(cData || []);
      setBookings(bData || []);
      setRooms(rData || []);
      setVariables(vData || []);

      const years = [...new Set((cData || []).map(c => c['Academic Year']).filter(Boolean))].sort().reverse();
      setAcademicYears(years);
      if (!selectedYear && years.length > 0) {
        setSelectedYear(years.includes(CURRENT_YEAR) ? CURRENT_YEAR : years[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { fetchAll(); }, []);

  // ── Derived config ────────────────────────────────────────────────────────

  const vars = useMemo(() => variables.find(v => v.academic_year === selectedYear) || {}, [variables, selectedYear]);
  const numWeeks    = parseFloat(vars.num_weeks)   || 0;
  const weeklyHours = parseFloat(vars.weekly_hours) || 0;
  const totalAvailableHours = numWeeks * weeklyHours;

  // room UUID → room_number map
  const roomMap = useMemo(() => {
    const m = new Map();
    rooms.forEach(r => m.set(r.id, r.room_number));
    return m;
  }, [rooms]);

  // Physical room names (exclude online/external)
  const physicalRooms = useMemo(() =>
    rooms.map(r => r.room_number).filter(n => !EXCLUDED_ROOMS.some(ex => n?.toLowerCase().includes(ex.toLowerCase()))).sort()
  , [rooms]);

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (c['Academic Year'] !== selectedYear) return false;
      if (c['Room'] === 'EMPTY' || !c['Room']) return false;
      if (EXCLUDED_ROOMS.some(ex => c['Room']?.toLowerCase().includes(ex.toLowerCase()))) return false;
      if (selectedTerm !== ALL_TERMS && c['Term'] !== selectedTerm) return false;
      return true;
    });
  }, [courses, selectedYear, selectedTerm]);

  // Normal bookings = no Course ID, has a room UUID
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b['Course ID']) return false; // course-linked booking
      if (!b['Room']) return false;
      const roomName = roomMap.get(b['Room']);
      if (!roomName || EXCLUDED_ROOMS.some(ex => roomName.toLowerCase().includes(ex.toLowerCase()))) return false;
      return true;
    });
  }, [bookings, roomMap]);

  // ── Per-room aggregation ──────────────────────────────────────────────────

  const roomStats = useMemo(() => {
    const stats = {};
    physicalRooms.forEach(name => {
      stats[name] = { courseHours: 0, bookingHours: 0, bookingRevenue: 0, bookingCount: 0 };
    });

    // Course hours
    filteredCourses.forEach(c => {
      const name = c['Room'];
      if (!stats[name]) return;
      const h = parseFloat(c['Planned numbers of hours']) || parseHours(c['Start time'], c['End time']);
      stats[name].courseHours += h;
    });

    // Booking hours + revenue
    filteredBookings.forEach(b => {
      const name = roomMap.get(b['Room']);
      if (!name || !stats[name]) return;
      const h = parseHours(b['Start time'], b['End time']);
      stats[name].bookingHours    += h;
      stats[name].bookingRevenue  += parseFloat(b.fees) || 0;
      stats[name].bookingCount    += 1;
    });

    return stats;
  }, [filteredCourses, filteredBookings, physicalRooms, roomMap]);

  // ── KPI totals ────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const t = { courseHours: 0, bookingHours: 0, bookingRevenue: 0 };
    Object.values(roomStats).forEach(s => {
      t.courseHours    += s.courseHours;
      t.bookingHours   += s.bookingHours;
      t.bookingRevenue += s.bookingRevenue;
    });
    return t;
  }, [roomStats]);

  const totalCourseOccPct  = totalAvailableHours > 0 ? (totals.courseHours  / totalAvailableHours) * 100 : 0;
  const totalBookingOccPct = totalAvailableHours > 0 ? (totals.bookingHours / totalAvailableHours) * 100 : 0;
  const totalFreeHours     = totalAvailableHours > 0 ? totalAvailableHours - totals.courseHours - totals.bookingHours : null;

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(() =>
    physicalRooms
      .filter(name => {
        const s = roomStats[name];
        return s && (s.courseHours > 0 || s.bookingHours > 0);
      })
      .map(name => {
        const s = roomStats[name];
        const avail = totalAvailableHours;
        return {
          name,
          'Course Hrs':   parseFloat(s.courseHours.toFixed(1)),
          'Booking Hrs':  parseFloat(s.bookingHours.toFixed(1)),
          'Free Hrs':     avail > 0 ? parseFloat(Math.max(0, avail - s.courseHours - s.bookingHours).toFixed(1)) : 0,
        };
      })
  , [physicalRooms, roomStats, totalAvailableHours]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vars.company_name || ''}{vars.address ? ` · ${vars.address}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVarsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FiSettings size={15} /> Variables
          </button>
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-white border-b border-gray-100">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Academic Year</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Term</label>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {(numWeeks > 0 || weeklyHours > 0) && (
          <div className="ml-auto text-xs text-gray-400">
            {numWeeks}w × {weeklyHours}h = <strong>{totalAvailableHours}h</strong> available per room
          </div>
        )}
        {(numWeeks === 0 || weeklyHours === 0) && (
          <div className="ml-auto flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <FiAlertCircle size={13} /> Set Variables to enable occupancy % calculations
          </div>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <KPICard label="Course Hours"          value={fmt(totals.courseHours)}   color="blue"   />
            <KPICard label="Course Occ. %"         value={fmtPct(totalCourseOccPct)} color="blue"   sub={totalAvailableHours > 0 ? `of ${totalAvailableHours}h avail.` : 'Set variables'} />
            <KPICard label="Booking Hours"         value={fmt(totals.bookingHours)}  color="purple" />
            <KPICard label="Booking Occ. %"        value={fmtPct(totalBookingOccPct)} color="purple" sub={totalAvailableHours > 0 ? `of ${totalAvailableHours}h avail.` : 'Set variables'} />
            <KPICard label="Combined Occ. %"       value={fmtPct(totalCourseOccPct + totalBookingOccPct)} color="orange" />
            <KPICard label="Free Hours / Room"     value={totalFreeHours != null ? fmt(totalFreeHours) : '—'} color="green" sub="per room" />
            <KPICard label="Booking Revenue"       value={fmtGbp(totals.bookingRevenue)} color="green" />
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Hours by Room</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n) => [`${v}h`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Course Hrs"  stackId="a" fill="#3b82f6" />
                  <Bar dataKey="Booking Hrs" stackId="a" fill="#a855f7" />
                  <Bar dataKey="Free Hrs"    stackId="a" fill="#e5e7eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-room table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    'Room',
                    'Course Hrs',
                    'Course Occ. %',
                    'Booking Hrs',
                    'Booking Occ. %',
                    'Combined Occ. %',
                    'Free Hrs',
                    'Bookings',
                    'Revenue',
                    'Rev / Hr',
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {physicalRooms.map(name => {
                  const s = roomStats[name];
                  if (!s) return null;
                  const courseOcc   = totalAvailableHours > 0 ? (s.courseHours  / totalAvailableHours) * 100 : null;
                  const bookingOcc  = totalAvailableHours > 0 ? (s.bookingHours / totalAvailableHours) * 100 : null;
                  const combinedOcc = courseOcc != null && bookingOcc != null ? courseOcc + bookingOcc : null;
                  const freeHrs     = totalAvailableHours > 0 ? Math.max(0, totalAvailableHours - s.courseHours - s.bookingHours) : null;
                  const revPerHr    = s.bookingHours > 0 ? s.bookingRevenue / s.bookingHours : null;
                  return (
                    <tr key={name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">{name}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(s.courseHours)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${courseOcc != null && courseOcc >= 70 ? 'text-green-600' : courseOcc != null && courseOcc >= 40 ? 'text-orange-500' : 'text-gray-500'}`}>
                          {fmtPct(courseOcc)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmt(s.bookingHours)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${bookingOcc != null && bookingOcc >= 30 ? 'text-green-600' : 'text-gray-500'}`}>
                          {fmtPct(bookingOcc)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${combinedOcc != null && combinedOcc >= 80 ? 'text-green-600' : combinedOcc != null && combinedOcc >= 50 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {fmtPct(combinedOcc)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{freeHrs != null ? fmt(freeHrs) : '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{s.bookingCount || 0}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{s.bookingRevenue > 0 ? fmtGbp(s.bookingRevenue) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{revPerHr != null ? fmtGbp(revPerHr) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr className="font-bold">
                  <td className="px-4 py-3 text-gray-800">TOTAL</td>
                  <td className="px-4 py-3 text-blue-700">{fmt(totals.courseHours)}</td>
                  <td className="px-4 py-3 text-blue-700">{fmtPct(totalCourseOccPct)}</td>
                  <td className="px-4 py-3 text-purple-700">{fmt(totals.bookingHours)}</td>
                  <td className="px-4 py-3 text-purple-700">{fmtPct(totalBookingOccPct)}</td>
                  <td className="px-4 py-3 text-orange-600">{fmtPct(totalCourseOccPct + totalBookingOccPct)}</td>
                  <td className="px-4 py-3 text-gray-500">{totalFreeHours != null ? fmt(totalFreeHours) : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{filteredBookings.length}</td>
                  <td className="px-4 py-3 text-green-700">{totals.bookingRevenue > 0 ? fmtGbp(totals.bookingRevenue) : '—'}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showVarsModal && (
        <VariablesModal
          variables={variables}
          academicYear={selectedYear}
          onClose={() => setShowVarsModal(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
