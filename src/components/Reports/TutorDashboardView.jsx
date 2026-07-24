import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { FiRefreshCw, FiTrendingUp, FiTrendingDown, FiUsers, FiClock, FiDollarSign, FiAward } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const formatCurrency = (v) =>
  '£' + Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatPct = (v) => `${Number(v || 0).toFixed(1)}%`;

const GP_COLOR = (pct) => {
  if (pct >= 50) return '#10b981';
  if (pct >= 30) return '#f59e0b';
  return '#ef4444';
};

const GP_CLASS = (pct) => {
  if (pct >= 50) return 'text-green-600 font-bold';
  if (pct >= 30) return 'text-amber-600 font-bold';
  return 'text-red-600 font-bold';
};

const SORT_FIELDS = [
  { key: 'totalIncome',   label: 'Total Income' },
  { key: 'totalHours',    label: 'Total Hours' },
  { key: 'avgGP',         label: 'GP%' },
  { key: 'incomePerHour', label: 'Income / Hour' },
  { key: 'costPerHour',   label: 'Cost / Hour' },
  { key: 'totalCourses',  label: 'Courses' },
  { key: 'totalStudents', label: 'Students' },
];

const KPICard = ({ icon: Icon, label, value, sub, color = 'blue' }) => {
  const colors = {
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
    green:  'bg-green-50  border-green-200  text-green-700',
    amber:  'bg-amber-50  border-amber-200  text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${colors[color]}`}>
      <div className="mt-1 opacity-70"><Icon size={20} /></div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-2xl font-black leading-tight">{value}</p>
        {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
      </div>
    </div>
  );
};

const CustomTooltipIncome = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-bold text-gray-800 mb-1">{d.tutor}</p>
      <p className="text-blue-600">Learning: {formatCurrency(d.learning)}</p>
      <p className="text-purple-600">Tailored: {formatCurrency(d.tailored)}</p>
      <p className="text-green-700 font-semibold">Total: {formatCurrency(d.totalIncome)}</p>
    </div>
  );
};

const CustomTooltipGP = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-bold text-gray-800 mb-1">{d.tutor}</p>
      <p style={{ color: GP_COLOR(d.avgGP) }}>GP%: {formatPct(d.avgGP)}</p>
      <p className="text-gray-600">Courses: {d.totalCourses}</p>
    </div>
  );
};

const CustomTooltipScatter = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-bold text-gray-800 mb-1">{d.tutor}</p>
      <p className="text-gray-600">Hours: {d.totalHours.toFixed(1)}</p>
      <p style={{ color: GP_COLOR(d.avgGP) }}>GP%: {formatPct(d.avgGP)}</p>
      <p className="text-green-700">Income: {formatCurrency(d.totalIncome)}</p>
    </div>
  );
};

export default function TutorDashboardView() {
  const { user } = useAuth();

  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState('totalIncome');
  const [sortDir, setSortDir] = useState('desc');
  const [tutors, setTutors] = useState([]);

  const TERMS = ['All', '1-Autumn Term', '2-Spring Term', '3-Summer Term'];
  const STATUSES = ['All', 'Live', 'Planned', 'Pending', 'Not started', 'Ended', 'Completed', 'Cancelled'];

  // ── Fetch academic years ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchYears = async () => {
      const { data } = await dataService.from('terms').select('"Academic Year"');
      const years = [...new Set((data || []).map(t => t['Academic Year']))].filter(Boolean).sort((a, b) => b.localeCompare(a));
      setAcademicYears(years);
      if (years.length > 0) setSelectedYear(years[0]);
    };
    fetchYears();
  }, []);

  // ── Fetch & aggregate courses ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    try {
      let query = dataService
        .from('Courses')
        .select('"Course ID", "Tutor", "Term", "Status", "Planned numbers of hours", "No of Hours per Week", learning_incomes, tailered_incomes, total_incomes, "Tutors Cost", gp_pct, "AIMs", "Tailored learning aims"')
        .eq('Academic Year', selectedYear);

      if (selectedTerm !== 'All') query = query.eq('Term', selectedTerm);
      if (selectedStatus !== 'All') query = query.ilike('Status', `${selectedStatus.toLowerCase()}%`);

      const { data, error } = await query;
      if (error) throw error;

      // De-duplicate courses by Course ID first
      const seen = new Set();
      const deduped = [];
      (data || []).forEach(row => {
        const id = row['Course ID'];
        if (!id || seen.has(id)) return;
        seen.add(id);
        deduped.push(row);
      });

      // Group by Tutor
      const map = new Map();
      deduped.forEach(c => {
        const tutor = (c['Tutor'] || '').trim() || '(Unassigned)';
        if (!map.has(tutor)) {
          map.set(tutor, {
            tutor,
            courses: [],
          });
        }
        map.get(tutor).courses.push(c);
      });

      // Fetch contracted hours from Tutors table
      const { data: tutorsTableData } = await dataService
        .from('Tutors')
        .select('"Tutor name", contracted_hours');
      const contractedMap = new Map();
      (tutorsTableData || []).forEach(t => {
        if (t['Tutor name']) contractedMap.set(t['Tutor name'].trim(), parseFloat(t['contracted_hours']) || 0);
      });

      // Fetch weeks per term for this academic year
      const { data: weeksData } = await dataService
        .from('weeks')
        .select('term_number, num_weeks')
        .eq('academic_year', selectedYear);
      // Build lookup: full term string (e.g. "1-Autumn Term") → num_weeks
      const weeksMap = new Map();
      (weeksData || []).forEach(w => {
        weeksMap.set(String(w.term_number).trim(), parseFloat(w.num_weeks) || 0);
      });
      // Total weeks across all terms (used when viewing all terms together)
      const totalWeeksAllTerms = [...weeksMap.values()].reduce((s, v) => s + v, 0);

      // Aggregate per tutor
      const rows = [];
      map.forEach(({ tutor, courses }) => {
        const totalCourses    = courses.length;
        const totalStudents   = totalCourses * 12;
        const totalHours      = courses.reduce((s, c) => s + (parseFloat(c['Planned numbers of hours']) || 0), 0);
        const learning        = courses.reduce((s, c) => s + (parseFloat(c['learning_incomes'])         || 0), 0);
        const tailored        = courses.reduce((s, c) => s + (parseFloat(c['tailered_incomes'])         || 0), 0);
        const totalIncome     = courses.reduce((s, c) => s + (parseFloat(c['total_incomes'])            || 0), 0);
        const totalCost       = courses.reduce((s, c) => s + (parseFloat(c['Tutors Cost'])              || 0), 0);
        const gpValues        = courses.map(c => parseFloat(c['gp_pct'])).filter(v => !isNaN(v) && v !== 0);
        const avgGP           = gpValues.length > 0 ? gpValues.reduce((s, v) => s + v, 0) / gpValues.length : 0;
        const incomePerHour   = totalHours > 0 ? totalIncome / totalHours : 0;
        const costPerHour     = totalHours > 0 ? totalCost   / totalHours : 0;
        const learningCount   = courses.filter(c => c['AIMs'] && !c['Tailored learning aims']).length;
        const tailoredCount   = courses.filter(c => c['Tailored learning aims']).length;

        // avgWeeklyHours:
        // - If a single term is selected: totalHours ÷ num_weeks for that term
        // - If all terms: totalHours ÷ sum of weeks across all terms in the year
        let avgWeeklyHours = 0;
        if (selectedTerm !== 'All') {
          const numWeeks = weeksMap.get(selectedTerm) || 0;
          avgWeeklyHours = numWeeks > 0 ? totalHours / numWeeks : 0;
        } else if (totalWeeksAllTerms > 0) {
          avgWeeklyHours = totalHours / totalWeeksAllTerms;
        }

        const contractedHours = contractedMap.get(tutor) || 0;
        const hoursDelta      = contractedHours > 0 ? avgWeeklyHours - contractedHours : null;

        rows.push({
          tutor, totalCourses, totalStudents, totalHours,
          learning, tailored, totalIncome, totalCost,
          avgGP, incomePerHour, costPerHour,
          learningCount, tailoredCount,
          avgWeeklyHours, contractedHours, hoursDelta,
        });
      });

      setTutors(rows);
    } catch (err) {
      console.error('TutorDashboard fetch error:', err);
      toast.error('Failed to load tutor data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedTerm, selectedStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Sort ─────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...tutors].sort((a, b) => {
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [tutors, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIndicator = ({ field }) => {
    if (sortField !== field) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!tutors.length) return {};
    const totalGPs = tutors.filter(t => t.avgGP > 0);
    const avgGP = totalGPs.length ? totalGPs.reduce((s, t) => s + t.avgGP, 0) / totalGPs.length : 0;
    const topEarner = [...tutors].sort((a, b) => b.totalIncome - a.totalIncome)[0];
    const topHours  = [...tutors].sort((a, b) => b.totalHours - a.totalHours)[0];
    return { total: tutors.length, avgGP, topEarner, topHours };
  }, [tutors]);

  // ── Top 5 / Bottom 5 ────────────────────────────────────────────────────
  const top5       = useMemo(() => [...tutors].sort((a, b) => b.totalIncome   - a.totalIncome).slice(0, 5),   [tutors]);
  const bottom5    = useMemo(() => [...tutors].sort((a, b) => a.totalIncome   - b.totalIncome).slice(0, 5),   [tutors]);
  const top5iph    = useMemo(() => [...tutors].sort((a, b) => b.incomePerHour - a.incomePerHour).slice(0, 5), [tutors]);
  const bottom5iph = useMemo(() => [...tutors].sort((a, b) => a.incomePerHour - b.incomePerHour).slice(0, 5), [tutors]);
  const top5hrs    = useMemo(() => [...tutors].sort((a, b) => b.totalHours    - a.totalHours).slice(0, 5),    [tutors]);
  const bottom5hrs = useMemo(() => [...tutors].sort((a, b) => a.totalHours    - b.totalHours).slice(0, 5),    [tutors]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const incomeChartData = useMemo(() =>
    [...sorted].reverse().map(t => ({ ...t, name: t.tutor })), [sorted]);

  const gpChartData = useMemo(() =>
    [...tutors].sort((a, b) => b.avgGP - a.avgGP).map(t => ({ ...t, name: t.tutor })), [tutors]);

  const barHeight = Math.max(320, tutors.length * 36);

  if (!user) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Please log in to access this report.</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tutor Dashboard</h1>
        <p className="text-gray-500 mt-1">Profitability and performance by tutor</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500"
        >
          {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={selectedTerm}
          onChange={e => setSelectedTerm(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500"
        >
          {TERMS.map(t => <option key={t} value={t}>{t === 'All' ? 'All Terms' : t}</option>)}
        </select>

        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50 flex items-center gap-2"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : tutors.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No data for the selected filters.</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPICard icon={FiUsers}    label="Total Tutors"       value={kpis.total}                color="blue" />
            <KPICard icon={FiAward}    label="Avg GP%"            value={formatPct(kpis.avgGP)}     color="green" />
            <KPICard icon={FiDollarSign} label="Highest Earner"   value={kpis.topEarner?.tutor}     sub={formatCurrency(kpis.topEarner?.totalIncome)} color="purple" />
            <KPICard icon={FiClock}    label="Most Hours"         value={kpis.topHours?.tutor}      sub={`${(kpis.topHours?.totalHours || 0).toFixed(1)} hrs`} color="amber" />
          </div>

          {/* Top 5 / Bottom 5 by Income/Hour */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiTrendingUp className="text-blue-600" />
                <h3 className="font-bold text-blue-800">Top 5 by Income / Hour</h3>
              </div>
              <div className="space-y-2">
                {top5iph.map((t, i) => (
                  <div key={t.tutor} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-blue-600 w-5">#{i + 1}</span>
                      <span className="font-semibold text-gray-800 text-sm">{t.tutor}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <span className="text-blue-700 font-bold">{formatCurrency(t.incomePerHour)}/h</span>
                      <span className={GP_CLASS(t.avgGP)}>{formatPct(t.avgGP)}</span>
                      <span className="text-gray-500">{t.totalHours.toFixed(0)}h total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiTrendingDown className="text-orange-600" />
                <h3 className="font-bold text-orange-800">Bottom 5 by Income / Hour</h3>
              </div>
              <div className="space-y-2">
                {bottom5iph.map((t, i) => (
                  <div key={t.tutor} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-orange-500 w-5">#{i + 1}</span>
                      <span className="font-semibold text-gray-800 text-sm">{t.tutor}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <span className="text-orange-600 font-bold">{formatCurrency(t.incomePerHour)}/h</span>
                      <span className={GP_CLASS(t.avgGP)}>{formatPct(t.avgGP)}</span>
                      <span className="text-gray-500">{t.totalHours.toFixed(0)}h total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top 5 / Bottom 5 by Total Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiTrendingUp className="text-teal-600" />
                <h3 className="font-bold text-teal-800">Top 5 by Total Hours</h3>
              </div>
              <div className="space-y-2">
                {top5hrs.map((t, i) => (
                  <div key={t.tutor} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-teal-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-teal-600 w-5">#{i + 1}</span>
                      <span className="font-semibold text-gray-800 text-sm">{t.tutor}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <span className="text-teal-700 font-bold">{t.totalHours.toFixed(1)}h</span>
                      <span className={GP_CLASS(t.avgGP)}>{formatPct(t.avgGP)}</span>
                      <span className="text-gray-500">{t.totalCourses} courses</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiTrendingDown className="text-slate-500" />
                <h3 className="font-bold text-slate-700">Bottom 5 by Total Hours</h3>
              </div>
              <div className="space-y-2">
                {bottom5hrs.map((t, i) => (
                  <div key={t.tutor} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-400 w-5">#{i + 1}</span>
                      <span className="font-semibold text-gray-800 text-sm">{t.tutor}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <span className="text-slate-600 font-bold">{t.totalHours.toFixed(1)}h</span>
                      <span className={GP_CLASS(t.avgGP)}>{formatPct(t.avgGP)}</span>
                      <span className="text-gray-500">{t.totalCourses} courses</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top 5 / Bottom 5 by Income */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Top 5 */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiTrendingUp className="text-green-600" />
                <h3 className="font-bold text-green-800">Top 5 by Income</h3>
              </div>
              <div className="space-y-2">
                {top5.map((t, i) => (
                  <div key={t.tutor} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-green-600 w-5">#{i + 1}</span>
                      <span className="font-semibold text-gray-800 text-sm">{t.tutor}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <span className="text-green-700 font-bold">{formatCurrency(t.totalIncome)}</span>
                      <span className={GP_CLASS(t.avgGP)}>{formatPct(t.avgGP)}</span>
                      <span className="text-gray-500">{t.totalHours.toFixed(0)}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom 5 */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiTrendingDown className="text-red-600" />
                <h3 className="font-bold text-red-800">Bottom 5 by Income</h3>
              </div>
              <div className="space-y-2">
                {bottom5.map((t, i) => (
                  <div key={t.tutor} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-red-500 w-5">#{i + 1}</span>
                      <span className="font-semibold text-gray-800 text-sm">{t.tutor}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <span className="text-red-600 font-bold">{formatCurrency(t.totalIncome)}</span>
                      <span className={GP_CLASS(t.avgGP)}>{formatPct(t.avgGP)}</span>
                      <span className="text-gray-500">{t.totalHours.toFixed(0)}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 1: Income stacked + GP% */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            {/* Stacked Income */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-4">Income by Tutor (Learning vs Tailored)</h3>
              <ResponsiveContainer width="100%" height={barHeight}>
                <BarChart data={incomeChartData} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `£${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltipIncome />} />
                  <Legend />
                  <Bar dataKey="learning" name="Learning" stackId="a" fill="#2563eb" />
                  <Bar dataKey="tailored" name="Tailored" stackId="a" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* GP% */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-4">Average GP% by Tutor</h3>
              <ResponsiveContainer width="100%" height={barHeight}>
                <BarChart data={gpChartData} layout="vertical" margin={{ left: 10, right: 50, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltipGP />} />
                  <Bar dataKey="avgGP" name="GP%" radius={[0, 4, 4, 0]}>
                    {gpChartData.map((entry, i) => (
                      <Cell key={i} fill={GP_COLOR(entry.avgGP)} />
                    ))}
                    <LabelList dataKey="avgGP" position="right" formatter={v => `${v.toFixed(1)}%`} style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Scatter Plot: Hours vs GP% */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-8">
            <h3 className="font-bold text-gray-800 mb-1">Hours vs GP% (bubble = total income)</h3>
            <p className="text-xs text-gray-500 mb-4">Top-right = high hours & high GP% (ideal). Top-left = few hours but efficient.</p>
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number" dataKey="totalHours" name="Hours"
                  label={{ value: 'Total Planned Hours', position: 'insideBottom', offset: -10, fontSize: 12 }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="number" dataKey="avgGP" name="GP%"
                  label={{ value: 'Avg GP%', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  tick={{ fontSize: 11 }}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltipScatter />} />
                <Scatter data={tutors} name="Tutors">
                  {tutors.map((t, i) => (
                    <Cell key={i} fill={GP_COLOR(t.avgGP)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Full Tutor Breakdown</h3>
              <p className="text-xs text-gray-500 mt-0.5">Click column headers to sort · Sorted by {SORT_FIELDS.find(f => f.key === sortField)?.label} {sortDir === 'desc' ? '↓' : '↑'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">#</th>
                    {[
                      { key: 'tutor',        label: 'Tutor' },
                      { key: 'totalCourses', label: 'Courses' },
                      { key: 'totalStudents',label: 'Students' },
                      { key: 'totalHours',      label: 'Total Hours' },
                      { key: 'avgWeeklyHours',  label: 'Avg Wkly Hrs' },
                      { key: 'contractedHours', label: 'Contracted Hrs' },
                      { key: 'hoursDelta',      label: '± vs Contract' },
                      { key: 'learning',        label: 'LA Income' },
                      { key: 'tailored',     label: 'TL Income' },
                      { key: 'totalIncome',  label: 'Total Income' },
                      { key: 'totalCost',    label: 'Tutor Cost' },
                      { key: 'avgGP',        label: 'Avg GP%' },
                      { key: 'incomePerHour',label: '£/Hour' },
                      { key: 'costPerHour',  label: 'Cost/Hour' },
                      { key: 'learningCount',label: 'LA Courses' },
                      { key: 'tailoredCount',label: 'TL Courses' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none"
                      >
                        {col.label}<SortIndicator field={col.key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((t, i) => (
                    <tr key={t.tutor} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 font-semibold">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{t.tutor}</td>
                      <td className="px-4 py-3 text-gray-600">{t.totalCourses}</td>
                      <td className="px-4 py-3 text-gray-600">{t.totalStudents}</td>
                      <td className="px-4 py-3 text-gray-600">{t.totalHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-gray-600">{t.avgWeeklyHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-gray-600">{t.contractedHours > 0 ? t.contractedHours.toFixed(1) : '—'}</td>
                      <td className="px-4 py-3 font-semibold">
                        {t.hoursDelta === null
                          ? <span className="text-gray-400">—</span>
                          : t.hoursDelta >= 0
                            ? <span className="text-green-600">+{t.hoursDelta.toFixed(1)}</span>
                            : <span className="text-red-600">{t.hoursDelta.toFixed(1)}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-blue-600">{formatCurrency(t.learning)}</td>
                      <td className="px-4 py-3 text-purple-600">{formatCurrency(t.tailored)}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{formatCurrency(t.totalIncome)}</td>
                      <td className="px-4 py-3 text-red-500">{formatCurrency(t.totalCost)}</td>
                      <td className={`px-4 py-3 ${GP_CLASS(t.avgGP)}`}>{formatPct(t.avgGP)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCurrency(t.incomePerHour)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCurrency(t.costPerHour)}</td>
                      <td className="px-4 py-3 text-blue-500">{t.learningCount}</td>
                      <td className="px-4 py-3 text-purple-500">{t.tailoredCount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-black text-gray-900">Totals</td>
                    <td className="px-4 py-3 font-bold">{tutors.reduce((s, t) => s + t.totalCourses, 0)}</td>
                    <td className="px-4 py-3 font-bold">{tutors.reduce((s, t) => s + t.totalStudents, 0)}</td>
                    <td className="px-4 py-3 font-bold">{tutors.reduce((s, t) => s + t.totalHours, 0).toFixed(1)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-bold text-blue-600">{formatCurrency(tutors.reduce((s, t) => s + t.learning, 0))}</td>
                    <td className="px-4 py-3 font-bold text-purple-600">{formatCurrency(tutors.reduce((s, t) => s + t.tailored, 0))}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(tutors.reduce((s, t) => s + t.totalIncome, 0))}</td>
                    <td className="px-4 py-3 font-bold text-red-500">{formatCurrency(tutors.reduce((s, t) => s + t.totalCost, 0))}</td>
                    <td className="px-4 py-3 font-bold">{formatPct(kpis.avgGP)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
