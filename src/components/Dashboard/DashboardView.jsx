import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiRefreshCw, FiSave, FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiX } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { toast } from 'react-hot-toast';

const DashboardView = () => {
  const { isSuperuser } = useAuth();
  const superuser = isSuperuser();

  const [courseData, setCourseData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Budgets ──────────────────────────────────────────────────────────────
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);

  // ── Add budget modal ──────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBudgetType, setNewBudgetType] = useState('');
  const [newBudgetValue, setNewBudgetValue] = useState('');

  // ── Table UI state ────────────────────────────────────────────────────────
  const [courseIdFilter, setCourseIdFilter] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    fetchBudgets();
  }, []);

  // ── Fetch course financial data ───────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: courses, error: cErr } = await dataService
        .from('Courses')
        .select(`"Course ID", "Course Name", learning_incomes, tailered_incomes, total_incomes, gp_pct, "Tutors Cost", "Planned Costs"`);

      if (cErr) throw cErr;

      // De-duplicate by Course ID (Courses table has one row per session; we only want one financial row per course)
      const seen = new Set();
      const processed = [];
      (courses || []).forEach(course => {
        const cid = course['Course ID'];
        if (!cid || seen.has(cid)) return;
        seen.add(cid);

        const asfFunding   = parseFloat(course['learning_incomes'])  || 0;
        const tlFunding    = parseFloat(course['tailered_incomes'])   || 0;
        const totalIncomes = parseFloat(course['total_incomes'])      || 0;
        const tutorsCost   = parseFloat(course['Tutors Cost'])        || 0;
        const totalCosts   = parseFloat(course['Planned Costs'])      || 0;
        const gpPercent    = parseFloat(course['gp_pct'])             || 0;

        processed.push({
          'Course ID':     cid,
          'Course Name':   course['Course Name'],
          'ASF Funding':   asfFunding,
          'TL Funding':    tlFunding,
          'Total incomes': totalIncomes,
          'Tutors Cost':   tutorsCost,
          'Total costs':   totalCosts,
          'GP%':           gpPercent,
        });
      });

      setCourseData(processed);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch budgets from Backend ───────────────────────────────────────────
  const fetchBudgets = async () => {
    setBudgetsLoading(true);
    try {
      const { data, error } = await dataService.from('budgets').select('*').order('created_at');
      if (error) throw error;

      const rows = data || [];

      // Sort: ASF first, TL second, then rest in created order
      rows.sort((a, b) => {
        const order = ['ASF funding', 'TL funding'];
        const ai = order.indexOf(a.type);
        const bi = order.indexOf(b.type);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return 0;
      });

      setBudgets(rows.map(r => ({ ...r, tempValue: r.value ?? 0, tempType: r.type ?? '' })));
    } catch (err) {
      console.error('Error fetching budgets:', err);
    } finally {
      setBudgetsLoading(false);
    }
  };

  const saveBudget = async (budget) => {
    try {
      const val  = parseFloat(budget.tempValue);
      const type = budget.tempType?.trim();
      if (isNaN(val) || !type) { toast.error('Invalid budget value or name'); return; }
      const { error } = await dataService.from('budgets').update({ value: val, type }).eq('id', budget.id);
      if (error) throw error;
      setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, value: val, type, tempValue: val, tempType: type } : b));
      toast.success('Budget saved');
    } catch (err) {
      toast.error('Failed to save budget');
    }
  };

  const confirmAddBudget = async () => {
    const type = newBudgetType.trim();
    const val  = parseFloat(newBudgetValue);
    if (!type) { toast.error('Please enter a budget name'); return; }
    if (isNaN(val)) { toast.error('Please enter a valid value'); return; }
    try {
      const { data, error } = await dataService.from('budgets').insert({ type, value: val }).select().single();
      if (error) throw error;
      setBudgets(prev => [...prev, { ...data, tempValue: val, tempType: type }]);
      toast.success('Budget added');
      setShowAddModal(false);
      setNewBudgetType('');
      setNewBudgetValue('');
    } catch (err) {
      toast.error('Failed to add budget');
    }
  };

  const deleteBudget = async (id, type) => {
    if (type === 'ASF funding' || type === 'TL funding') { toast.error('Cannot delete core budgets'); return; }
    try {
      const { error } = await dataService.from('budgets').delete().eq('id', id);
      if (error) throw error;
      setBudgets(prev => prev.filter(b => b.id !== id));
      toast.success('Budget removed');
    } catch (err) {
      toast.error('Failed to delete budget');
    }
  };

  // ── Aggregated totals ─────────────────────────────────────────────────────
  const totalTLFunding   = useMemo(() => courseData.reduce((s, r) => s + (r['TL Funding']    || 0), 0), [courseData]);
  const totalAllFunding  = useMemo(() => courseData.reduce((s, r) => s + (r['Total incomes'] || 0), 0), [courseData]);
  const totalASFFunding  = useMemo(() => courseData.reduce((s, r) => s + (r['ASF Funding']   || 0), 0), [courseData]);

  const asfBudget    = useMemo(() => parseFloat(budgets.find(b => b.type === 'ASF funding')?.value) || 0, [budgets]);
  const tlBudget     = useMemo(() => parseFloat(budgets.find(b => b.type === 'TL funding')?.value)  || 0, [budgets]);
  const totalBudget  = useMemo(() => budgets.reduce((s, b) => s + (parseFloat(b.value) || 0), 0), [budgets]);
  const extraBudgets = useMemo(() => budgets.filter(b => b.type !== 'ASF funding' && b.type !== 'TL funding'), [budgets]);

  // ── Pie chart helpers ─────────────────────────────────────────────────────
  const buildUtilisationPie = (title, utilized, available, usedColor) => {
    const noBudgetSet = available <= 0;
    const remaining    = Math.max(0, available - utilized);
    const isOverBudget = !noBudgetSet && utilized > available;
    let data;
    if (noBudgetSet) {
      data = [{ value: 1, name: 'No budget set', itemStyle: { color: '#e5e7eb' }, label: { show: true, formatter: 'No budget set' } }];
    } else if (isOverBudget) {
      data = [{ value: parseFloat(utilized.toFixed(2)), name: 'Over Budget', itemStyle: { color: '#f59e0b' } }];
    } else {
      data = [
        { value: parseFloat(utilized.toFixed(2)),  name: 'Utilised',  itemStyle: { color: usedColor } },
        { value: parseFloat(remaining.toFixed(2)), name: 'Remaining', itemStyle: { color: '#e5e7eb' } },
      ];
    }
    return {
      title: { text: title, left: 'center', textStyle: { fontSize: 13, fontWeight: 'bold' } },
      tooltip: { trigger: 'item', formatter: noBudgetSet ? '{b}' : '{b}: £{c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['38%', '65%'],
        avoidLabelOverlap: true,
        label: { show: true, formatter: noBudgetSet ? '{b}' : '{b}\n£{c}', fontSize: 11 },
        data,
      }],
    };
  };

  const totalPieOption = buildUtilisationPie('Total Funding Utilisation', totalAllFunding, totalBudget, '#10b981');
  const asfPieOption   = buildUtilisationPie('ASF Funding Utilisation',   totalASFFunding, asfBudget,   '#3b82f6');
  const tlPieOption    = buildUtilisationPie('TL Funding Utilisation',    totalTLFunding,  tlBudget,    '#8b5cf6');

  // ── Table filtering & sorting ─────────────────────────────────────────────
  const displayData = useMemo(() => {
    let rows = courseData.filter(r =>
      !courseIdFilter || String(r['Course ID'] || '').toLowerCase().includes(courseIdFilter.toLowerCase())
    );
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = parseFloat(a[sortField]) || 0;
        const bv = parseFloat(b[sortField]) || 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return rows;
  }, [courseData, courseIdFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <SafeIcon icon={FiChevronDown} className="w-3 h-3 ml-1 text-gray-300" />;
    return sortDir === 'asc'
      ? <SafeIcon icon={FiChevronUp}   className="w-3 h-3 ml-1 text-blue-500" />
      : <SafeIcon icon={FiChevronDown} className="w-3 h-3 ml-1 text-blue-500" />;
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? '-' : `£${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? '-' : `${num.toFixed(2)}%`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-8">
      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center shadow-sm">
          <div className="flex-1">
            <p className="font-medium">Connection Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={fetchData} className="ml-4 px-3 py-1 bg-white text-red-600 text-sm font-medium rounded border border-red-200 hover:bg-red-50">
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Financial Dashboard</h1>
        <button onClick={() => { fetchData(); fetchBudgets(); }}
          className="p-2 text-gray-600 hover:text-blue-600 bg-white rounded-lg border shadow-sm transition-colors"
          title="Refresh">
          <SafeIcon icon={FiRefreshCw} className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Budget panel ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">Budgets</h2>
          {superuser && (
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <SafeIcon icon={FiPlus} className="h-4 w-4" />
              Add budget
            </button>
          )}
        </div>
        {budgetsLoading ? (
          <p className="text-sm text-gray-400">Loading budgets…</p>
        ) : budgets.length === 0 ? (
          <p className="text-sm text-gray-400">No budgets defined yet.{superuser ? ' Click "Add budget" to create one.' : ''}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {budgets.map(budget => {
              const isCore = budget.type === 'ASF funding' || budget.type === 'TL funding';
              return (
                <div key={budget.id} className="flex items-center gap-3">
                  {/* Label */}
                  {superuser && !isCore ? (
                    <input
                      type="text"
                      value={budget.tempType}
                      onChange={e => setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, tempType: e.target.value } : b))}
                      className="w-44 border rounded px-3 py-1.5 text-sm font-medium text-gray-700"
                    />
                  ) : (
                    <span className="w-44 px-3 py-1.5 text-sm font-medium text-gray-600">{budget.type}</span>
                  )}
                  <span className="text-gray-400 text-sm">£</span>
                  {/* Value */}
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
                  {/* Save (superuser only) */}
                  {superuser && (
                    <button onClick={() => saveBudget(budget)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      title="Save">
                      <SafeIcon icon={FiSave} className="h-4 w-4" />
                    </button>
                  )}
                  {/* Delete custom budgets (superuser only) */}
                  {superuser && !isCore && (
                    <button onClick={() => deleteBudget(budget.id, budget.type)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete">
                      <SafeIcon icon={FiTrash2} className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Budget Modal (superuser only) ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">Add New Budget</h3>
              <button onClick={() => { setShowAddModal(false); setNewBudgetType(''); setNewBudgetValue(''); }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <SafeIcon icon={FiX} className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Budget Name</label>
                <input
                  type="text"
                  placeholder="e.g. Capital budget"
                  value={newBudgetType}
                  onChange={e => setNewBudgetType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Value (£)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newBudgetValue}
                  onChange={e => setNewBudgetValue(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button onClick={() => { setShowAddModal(false); setNewBudgetType(''); setNewBudgetValue(''); }}
                  className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={confirmAddBudget}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pie charts: Total + ASF + TL + any custom budgets ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-80">
          <ReactECharts option={totalPieOption} style={{ height: '100%', width: '100%' }} />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-80">
          <ReactECharts option={asfPieOption} style={{ height: '100%', width: '100%' }} />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-80">
          <ReactECharts option={tlPieOption} style={{ height: '100%', width: '100%' }} />
        </div>
        {extraBudgets.map(b => (
          <div key={b.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-80">
            <ReactECharts
              option={buildUtilisationPie(b.type, 0, parseFloat(b.value) || 0, '#f97316')}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        ))}
      </div>

      {/* ── Course Financial Details table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Course Financial Details</h2>
          <input
            type="text"
            placeholder="Filter by Course ID…"
            value={courseIdFilter}
            onChange={e => setCourseIdFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Course ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Course Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">ASF Funding</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">TL Funding</th>
                {/* Sortable columns */}
                {[
                  { label: 'Total Incomes', field: 'Total incomes' },
                  { label: 'Tutors Cost',   field: 'Tutors Cost'   },
                  { label: 'Total Costs',   field: 'Total costs'   },
                  { label: 'GP%',           field: 'GP%'           },
                ].map(({ label, field }) => (
                  <th key={field}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort(field)}>
                    <span className="flex items-center">
                      {label}
                      <SortIcon field={field} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-400 text-sm">Loading…</td>
                </tr>
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-400 text-sm">No data found.</td>
                </tr>
              ) : displayData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{row['Course ID']}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={row['Course Name']}>{row['Course Name']}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatCurrency(row['ASF Funding'])}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatCurrency(row['TL Funding'])}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600">{formatCurrency(row['Total incomes'])}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-red-500">{formatCurrency(row['Tutors Cost'])}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-600">{formatCurrency(row['Total costs'])}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-800">{formatPercent(row['GP%'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
