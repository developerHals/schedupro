import React, { useState, useEffect, useCallback } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { toast } from 'react-hot-toast';

// Term column values stored in Courses table
const TERM_NAMES  = ['1-Autumn Term', '2-Spring Term', '3-Summer Term'];
const TERM_LABELS = ['Term 1 (Autumn)', 'Term 2 (Spring)', 'Term 3 (Summer)'];
const PIE_COLORS_LA = ['#3b82f6', '#e5e7eb'];
const PIE_COLORS_TL = ['#10b981', '#e5e7eb'];


const formatCurrency = (value) => {
  if (!value && value !== 0) return '£0';
  return '£' + Number(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const StatCard = ({ label, value, color = 'blue', subtitle }) => {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black">{formatCurrency(value)}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  );
};

export default function IncomeReportView() {
  const { user, isSuperuser } = useAuth();
  const superuser = isSuperuser();

  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(false);
  // uniqueCourses: one entry per Course ID (de-duplicated)
  const [uniqueCourses, setUniqueCourses] = useState([]);

  // Budgets from Backend — same source as Dashboard
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);

  // ── Fetch budgets (mirrors Dashboard fetchBudgets) ────────────────────────
  const fetchBudgets = useCallback(async () => {
    setBudgetsLoading(true);
    try {
      const { data, error } = await dataService.from('budgets').select('*').order('created_at');
      if (error) throw error;
      const rows = data || [];
      rows.sort((a, b) => {
        const order = ['ASF funding', 'TL funding'];
        const ai = order.indexOf(a.type), bi = order.indexOf(b.type);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return 0;
      });
      setBudgets(rows.map(r => ({ ...r, tempValue: r.value ?? 0 })));
    } catch (err) {
      console.error('Error fetching budgets:', err);
    } finally {
      setBudgetsLoading(false);
    }
  }, []);

  const saveBudget = async (budget) => {
    const val = parseFloat(budget.tempValue);
    if (isNaN(val)) { toast.error('Invalid value'); return; }
    try {
      const { error } = await dataService.from('budgets').update({ value: val }).eq('id', budget.id);
      if (error) throw error;
      setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, value: val, tempValue: val } : b));
      toast.success('Budget saved');
    } catch (err) {
      toast.error('Failed to save budget');
    }
  };

  // ── Fetch academic years from Terms table ─────────────────────────────────
  useEffect(() => {
    const fetchYears = async () => {
      const { data } = await dataService.from('terms').select('"Academic Year"');
      const termsData = data || [];
      if (termsData.length > 0) {
        const years = [...new Set(termsData.map(t => t['Academic Year']))].filter(Boolean).sort((a, b) => b.localeCompare(a));
        setAcademicYears(years);
        if (years.length > 0) setSelectedYear(years[0]);
      }
    };
    fetchYears();
    fetchBudgets();
  }, [fetchBudgets]);

  // ── Fetch courses for selected year, de-duplicate by Course ID ────────────
  const fetchCourses = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    try {
      const { data, error } = await dataService
        .from('Courses')
        .select('"Course ID", "Course Name", "Term", "Actual Enrolments", learning_incomes, tailered_incomes, total_incomes')
        .eq('Academic Year', selectedYear);
      if (error) throw error;

      // De-duplicate: keep first row per Course ID
      const seen = new Set();
      const deduped = [];
      (data || []).forEach(c => {
        const id = c['Course ID'];
        if (!id || seen.has(id)) return;
        seen.add(id);
        deduped.push({
          courseId:   id,
          courseName: c['Course Name'],
          term:       c['Term'] || '',
          students:   parseFloat(c['Actual Enrolments']) || 12,
          learning:   parseFloat(c['learning_incomes'])  || 0,
          tailored:   parseFloat(c['tailered_incomes'])  || 0,
          total:      parseFloat(c['total_incomes'])     || 0,
        });
      });
      setUniqueCourses(deduped);
    } catch (err) {
      console.error('Error fetching courses:', err);
      toast.error('Failed to load course data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedYear) fetchCourses();
  }, [selectedYear, fetchCourses]);

  // Auth guard — after all hooks
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 font-medium">Please log in to access this report.</p>
      </div>
    );
  }

  // ── Group unique courses by Term column ───────────────────────────────────
  const coursesByTerm = TERM_NAMES.map(termName =>
    uniqueCourses.filter(c => c.term === termName)
  );

  // ── Aggregate per term ────────────────────────────────────────────────────
  const termIncomes = coursesByTerm.map(termCourses => ({
    count:    termCourses.length,
    students: termCourses.length * 12,
    learning: termCourses.reduce((s, c) => s + c.learning, 0),
    tailored: termCourses.reduce((s, c) => s + c.tailored, 0),
    total:    termCourses.reduce((s, c) => s + c.total,    0),
  }));

  // ── Overall totals ────────────────────────────────────────────────────────
  const overallLearning = termIncomes.reduce((s, t) => s + t.learning, 0);
  const overallTailored = termIncomes.reduce((s, t) => s + t.tailored, 0);
  const overallTotal    = termIncomes.reduce((s, t) => s + t.total,    0);
  const overallStudents = uniqueCourses.length * 12;

  // ── Budget values from Backend budgets table ─────────────────────────────
  const totalBudgetLA   = parseFloat(budgets.find(b => b.type === 'ASF funding')?.value) || 0;
  const totalBudgetTL   = parseFloat(budgets.find(b => b.type === 'TL funding')?.value)  || 0;
  const budgetPerTermLA = totalBudgetLA / 3;
  const budgetPerTermTL = totalBudgetTL / 3;

  // Charts data
  const columnChartData = TERM_LABELS.map((label, i) => ({
    name: label,
    'LA Forecast': Math.round(termIncomes[i].learning),
    'TL Forecast': Math.round(termIncomes[i].tailored),
    'Total Forecast': Math.round(termIncomes[i].total),
    'LA Budget': Math.round(budgetPerTermLA),
    'TL Budget': Math.round(budgetPerTermTL),
    'Total Budget': Math.round((totalBudgetLA + totalBudgetTL) / 3),
  }));

  const overallBarData = [
    {
      name: 'Learning Aims',
      Forecast: Math.round(overallLearning),
      Budget: Math.round(totalBudgetLA),
    },
    {
      name: 'Tailored Learning',
      Forecast: Math.round(overallTailored),
      Budget: Math.round(totalBudgetTL),
    },
    {
      name: 'Total',
      Forecast: Math.round(overallTotal),
      Budget: Math.round(totalBudgetLA + totalBudgetTL),
    },
  ];

  // Pie chart data
  const laPercent = totalBudgetLA > 0 ? Math.min(100, (overallLearning / totalBudgetLA) * 100) : 0;
  const tlPercent = totalBudgetTL > 0 ? Math.min(100, (overallTailored / totalBudgetTL) * 100) : 0;

  const laPieData = [
    { name: 'Achieved', value: Math.round(laPercent) },
    { name: 'Remaining', value: Math.max(0, Math.round(100 - laPercent)) },
  ];
  const tlPieData = [
    { name: 'Achieved', value: Math.round(tlPercent) },
    { name: 'Remaining', value: Math.max(0, Math.round(100 - tlPercent)) },
  ];

  const PieLabel = ({ cx, cy, percent, value }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="text-2xl font-black" style={{ fontSize: 22, fontWeight: 900 }}>
      {`${Math.round(value)}%`}
    </text>
  );

  // Prepare data for term pie charts
  const getTermPieData = (termIndex) => {
    const totalTermBudget = budgetPerTermLA + budgetPerTermTL;
    const termTotal = termIncomes[termIndex]?.total || 0;
    const percent = totalTermBudget > 0 ? Math.min(100, (termTotal / totalTermBudget) * 100) : 0;
    return [
      { name: 'Achieved', value: Math.round(percent) },
      { name: 'Remaining', value: Math.max(0, Math.round(100 - percent)) }
    ];
  };

  const overallTotalBudget = totalBudgetLA + totalBudgetTL;
  const overallPercent = overallTotalBudget > 0 ? Math.min(100, (overallTotal / overallTotalBudget) * 100) : 0;
  const overallPieData = [
    { name: 'Achieved', value: Math.round(overallPercent) },
    { name: 'Remaining', value: Math.max(0, Math.round(100 - overallPercent)) }
  ];

  const PieCard = ({ title, subtitle, data, percent, actual, budget, colors }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <h3 className="text-sm font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">{subtitle}</p>
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              dataKey="value"
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index]} />
              ))}
              <PieLabel cx="50%" cy="50%" value={Math.round(percent)} />
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-1">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[0] }}></span>
            {Math.round(percent)}%
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-gray-200 inline-block"></span>
            Rem
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {formatCurrency(actual)} of {formatCurrency(budget)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="w-full px-4 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Forecasts Report</h1>
            <p className="text-sm text-gray-500 mt-1">Forecasted income analysis by academic year and term</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {academicYears.length === 0 && <option value="">No years found</option>}
              {academicYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={fetchCourses}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <SafeIcon icon={FiRefreshCw} className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Column - Main Content */}
        <div className="xl:col-span-3 space-y-6">
          {/* Budget Panel — same style as Dashboard */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">Budgets</h2>
            {budgetsLoading ? (
              <p className="text-sm text-gray-400">Loading budgets…</p>
            ) : budgets.length === 0 ? (
              <p className="text-sm text-gray-400">No budgets defined yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {budgets.map(budget => (
                  <div key={budget.id} className="flex items-center gap-3">
                    <span className="w-44 px-3 py-1.5 text-sm font-medium text-gray-600">{budget.type}</span>
                    <span className="text-gray-400 text-sm">£</span>
                    {superuser ? (
                      <input
                        type="number"
                        value={budget.tempValue}
                        onChange={e => setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, tempValue: e.target.value } : b))}
                        className="w-40 border rounded px-3 py-1.5 text-right text-sm"
                      />
                    ) : (
                      <span className="w-40 px-3 py-1.5 text-sm text-right text-gray-800 font-mono">
                        {parseFloat(budget.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {superuser && (
                      <button onClick={() => saveBudget(budget)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Save">
                        <SafeIcon icon={FiSave} className="h-4 w-4" />
                      </button>
                    )}
                    {totalBudgetLA > 0 && budget.type === 'ASF funding' && (
                      <span className="text-xs text-gray-400">Per term: {formatCurrency(budgetPerTermLA)}</span>
                    )}
                    {totalBudgetTL > 0 && budget.type === 'TL funding' && (
                      <span className="text-xs text-gray-400">Per term: {formatCurrency(budgetPerTermTL)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Forecast" value={overallTotal} color="blue" subtitle={`vs ${formatCurrency(totalBudgetLA + totalBudgetTL)} budget`} />
            <StatCard label="Learning Aims" value={overallLearning} color="purple" subtitle={`vs ${formatCurrency(totalBudgetLA)} budget`} />
            <StatCard label="Tailored Learning" value={overallTailored} color="green" subtitle={`vs ${formatCurrency(totalBudgetTL)} budget`} />
            <div className="rounded-xl border p-4 bg-amber-50 border-amber-200 text-amber-700">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Total Students</p>
              <p className="text-2xl font-black">{overallStudents}</p>
              <p className="text-xs mt-1 opacity-60">{uniqueCourses.length} courses</p>
            </div>
          </div>

          {/* Term Summary Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">Term Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 rounded-lg">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Term</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Courses</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Students</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">LA Forecast</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">LA Budget</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">TL Forecast</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">TL Budget</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Forecast</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {TERM_LABELS.map((label, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800">{label}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{termIncomes[i].count}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{termIncomes[i].students}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(termIncomes[i].learning)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(budgetPerTermLA)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(termIncomes[i].tailored)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(budgetPerTermTL)}</td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">{formatCurrency(termIncomes[i].total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-4 py-3 font-black text-gray-900">Overall</td>
                    <td className="px-4 py-3 text-right text-gray-700">{uniqueCourses.length}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{overallStudents}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(overallLearning)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(totalBudgetLA)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatCurrency(overallTailored)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(totalBudgetTL)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(overallTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Column Chart - Forecast vs Budget per Term */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">Forecast vs Budget per Term</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={columnChartData} barCategoryGap="20%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="LA Forecast" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="LA Budget" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="TL Forecast" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="TL Budget" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Overall Bar Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">Overall Forecast vs Budget</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={overallBarData} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} width={120} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="Forecast" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Budget" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Charts - Now in sidebar, but keeping original LA/TL pies below */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-800 mb-1">Learning Aims</h2>
              <p className="text-xs text-gray-400 mb-4">Forecast as % of budget</p>
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={laPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" labelLine={false}>
                      {laPieData.map((entry, index) => (<Cell key={`cell-la-${index}`} fill={PIE_COLORS_LA[index]} />))}
                      <PieLabel cx="50%" cy="50%" value={Math.round(laPercent)} />
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-500 mt-3">{formatCurrency(overallLearning)} of {formatCurrency(totalBudgetLA)}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-800 mb-1">Tailored Learning</h2>
              <p className="text-xs text-gray-400 mb-4">Forecast as % of budget</p>
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={tlPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" labelLine={false}>
                      {tlPieData.map((entry, index) => (<Cell key={`cell-tl-${index}`} fill={PIE_COLORS_TL[index]} />))}
                      <PieLabel cx="50%" cy="50%" value={Math.round(tlPercent)} />
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-500 mt-3">{formatCurrency(overallTailored)} of {formatCurrency(totalBudgetTL)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Pie Charts */}
        <div className="xl:col-span-1">
          <div className="sticky top-4 space-y-4">
            {/* Overall Income Pie */}
            <PieCard
              title="Overall Income"
              subtitle="Total forecast vs total budget"
              data={overallPieData}
              percent={overallPercent}
              actual={overallTotal}
              budget={overallTotalBudget}
              colors={['#8b5cf6', '#e5e7eb']}
            />

            {/* Term 1 Pie */}
            <PieCard
              title="Term 1 (Autumn)"
              subtitle="Term 1 forecast vs budget"
              data={getTermPieData(0)}
              percent={overallTotalBudget > 0 ? Math.min(100, (termIncomes[0]?.total || 0) / overallTotalBudget * 100) : 0}
              actual={termIncomes[0]?.total || 0}
              budget={budgetPerTermLA + budgetPerTermTL}
              colors={['#3b82f6', '#e5e7eb']}
            />

            {/* Term 2 Pie */}
            <PieCard
              title="Term 2 (Spring)"
              subtitle="Term 2 forecast vs budget"
              data={getTermPieData(1)}
              percent={overallTotalBudget > 0 ? Math.min(100, (termIncomes[1]?.total || 0) / overallTotalBudget * 100) : 0}
              actual={termIncomes[1]?.total || 0}
              budget={budgetPerTermLA + budgetPerTermTL}
              colors={['#10b981', '#e5e7eb']}
            />

            {/* Term 3 Pie */}
            <PieCard
              title="Term 3 (Summer)"
              subtitle="Term 3 forecast vs budget"
              data={getTermPieData(2)}
              percent={overallTotalBudget > 0 ? Math.min(100, (termIncomes[2]?.total || 0) / overallTotalBudget * 100) : 0}
              actual={termIncomes[2]?.total || 0}
              budget={budgetPerTermLA + budgetPerTermTL}
              colors={['#f59e0b', '#e5e7eb']}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm font-semibold text-gray-700">Loading data...</span>
          </div>
        </div>
      )}
    </div>
  );
}
