import React, { useState, useCallback } from 'react';
import { format, parseISO, isValid, eachWeekOfInterval, eachDayOfInterval, addDays } from 'date-fns';
import { dataService } from '../../lib/dataService';
import { FiX, FiPlus, FiTrash2, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseDateField = (str) => {
  if (!str) return null;
  const d = parseISO(str); // input[type=date] gives yyyy-MM-dd
  return isValid(d) ? d : null;
};

const toDisplayDate = (str) => {
  const d = parseDateField(str);
  return d ? format(d, 'dd/MM/yyyy') : '';
};

const toHolidayKey = (str) => {
  // yymmdd as int4
  const d = parseDateField(str);
  if (!d) return null;
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return parseInt(`${yy}${mm}${dd}`, 10);
};

const getDayName = (str) => {
  const d = parseDateField(str);
  return d ? DAY_NAMES[d.getDay()] : '';
};

// Count full weeks between two dates (inclusive), minus non-lesson days
// We count distinct ISO weeks (Mon–Sun) that have at least one lesson day
const countWeeks = (startStr, endStr, nonLessonDates) => {
  const start = parseDateField(startStr);
  const end   = parseDateField(endStr);
  if (!start || !end || end < start) return 0;

  const excludedSet = new Set(nonLessonDates.map(d => d.date).filter(Boolean));

  // Get all Mon-start weeks that overlap
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  let count = 0;
  weeks.forEach(weekStart => {
    // Check if any day in this week (within term bounds) is a lesson day
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      if (day < start || day > end) continue;
      const iso = format(day, 'yyyy-MM-dd');
      if (!excludedSet.has(iso)) {
        count++;
        break; // this week has at least one lesson day
      }
    }
  });
  return count;
};

const TERM_NAMES = ['1-Autumn Term', '2-Spring Term', '3-Summer Term'];

// nonLessonDates entries: { mode: 'single'|'range', date, dateEnd, description }
const emptyTerm = (name) => ({
  name,
  startDate: '',
  endDate: '',
  nonLessonDates: [],
});

// Expand a non-lesson entry into individual { date, description } rows
const expandNonLesson = (nl) => {
  if (nl.mode === 'range' && nl.date && nl.dateEnd && nl.dateEnd >= nl.date) {
    const start = parseDateField(nl.date);
    const end   = parseDateField(nl.dateEnd);
    if (!start || !end) return [];
    return eachDayOfInterval({ start, end }).map(d => ({
      date: format(d, 'yyyy-MM-dd'),
      description: nl.description,
    }));
  }
  if (nl.date) return [{ date: nl.date, description: nl.description }];
  return [];
};

// Build all preview rows from current form state (imperative — avoids stale closure)
const buildRows = (academicYear, terms) => {
  const rows = [];
  terms.forEach(t => {
    if (t.startDate) {
      rows.push({
        _id: `start_${t.name}`,
        academicYear,
        term: t.name,
        description: 'Term Start Date',
        day: getDayName(t.startDate),
        date: t.startDate,
      });
    }
    const expanded = t.nonLessonDates.flatMap(expandNonLesson);
    expanded.sort((a, b) => a.date.localeCompare(b.date)).forEach((nl, idx) => {
      rows.push({
        _id: `nl_${t.name}_${idx}_${nl.date}`,
        academicYear,
        term: t.name,
        description: nl.description,
        day: getDayName(nl.date),
        date: nl.date,
      });
    });
    if (t.endDate) {
      rows.push({
        _id: `end_${t.name}`,
        academicYear,
        term: t.name,
        description: 'Term End Date',
        day: getDayName(t.endDate),
        date: t.endDate,
      });
    }
  });
  return rows;
};

// ── component ─────────────────────────────────────────────────────────────────

export default function AddNewYearModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [academicYear, setAcademicYear] = useState('');
  const [yearError, setYearError] = useState('');
  const [terms, setTerms] = useState(TERM_NAMES.map(emptyTerm));
  const [saving, setSaving] = useState(false);

  // ── Step 1 helpers ──────────────────────────────────────────────────────────

  const updateTerm = useCallback((idx, field, value) => {
    setTerms(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  }, []);

  const addNonLessonDate = useCallback((termIdx, mode = 'single') => {
    setTerms(prev => prev.map((t, i) =>
      i === termIdx
        ? { ...t, nonLessonDates: [...t.nonLessonDates, { mode, date: '', dateEnd: '', description: '' }] }
        : t
    ));
  }, []);

  const updateNonLessonDate = useCallback((termIdx, dateIdx, field, value) => {
    setTerms(prev => prev.map((t, i) => {
      if (i !== termIdx) return t;
      const updated = t.nonLessonDates.map((d, j) =>
        j === dateIdx ? { ...d, [field]: value } : d
      );
      return { ...t, nonLessonDates: updated };
    }));
  }, []);

  const removeNonLessonDate = useCallback((termIdx, dateIdx) => {
    setTerms(prev => prev.map((t, i) => {
      if (i !== termIdx) return t;
      return { ...t, nonLessonDates: t.nonLessonDates.filter((_, j) => j !== dateIdx) };
    }));
  }, []);

  // ── Validate Step 1 → build rows imperatively → go to Step 2 ────────────────

  const validateAndPreview = () => {
    setYearError('');
    const yearPattern = /^\d{2}-\d{2}$/;
    if (!yearPattern.test(academicYear)) {
      setYearError('Format must be yy-yy (e.g. 25-26)');
      return;
    }
    for (const t of terms) {
      if (!t.startDate || !t.endDate) {
        toast.error(`${t.name}: start and end dates are required`);
        return;
      }
      const s = parseDateField(t.startDate);
      const e = parseDateField(t.endDate);
      if (!s || !e || e <= s) {
        toast.error(`${t.name}: end date must be after start date`);
        return;
      }
      for (const nl of t.nonLessonDates) {
        if (!nl.date || !nl.description) {
          toast.error(`${t.name}: all non-lesson dates need a date and description`);
          return;
        }
        if (nl.mode === 'range' && nl.dateEnd && nl.dateEnd < nl.date) {
          toast.error(`${t.name}: range end date must be on or after start date`);
          return;
        }
      }
    }
    // Build rows imperatively from current state — avoids stale closure / timing bugs
    const rows = buildRows(academicYear, terms);
    setEditableRows(rows);
    setStep(2);
  };

  const [editableRows, setEditableRows] = useState([]);

  const removeRow = (id) => setEditableRows(prev => prev.filter(r => r._id !== id));

  const addExtraRow = (termName) => {
    const id = `extra_${termName}_${Date.now()}`;
    setEditableRows(prev => {
      // Insert after last row of this term
      const lastIdx = prev.map((r, i) => ({ r, i })).filter(x => x.r.term === termName).slice(-1)[0]?.i ?? prev.length - 1;
      const next = [...prev];
      next.splice(lastIdx + 1, 0, {
        _id: id,
        academicYear,
        term: termName,
        description: '',
        day: '',
        date: '',
        _removable: true,
        _extra: true,
      });
      return next;
    });
  };

  const updateEditableRow = (id, field, value) => {
    setEditableRows(prev => prev.map(r => {
      if (r._id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'date') updated.day = getDayName(value);
      return updated;
    }));
  };

  // ── Week counts per term (from editable rows) ───────────────────────────────

  const weekCounts = React.useMemo(() => {
    return terms.map(t => {
      const nonLessonInTerm = editableRows.filter(r =>
        r.term === t.name &&
        r.description !== 'Term Start Date' &&
        r.description !== 'Term End Date'
      );
      return {
        term: t.name,
        weeks: countWeeks(t.startDate, t.endDate, nonLessonInTerm),
      };
    });
  }, [editableRows, terms]);

  // ── Confirm & Save ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Validate editable rows
    for (const r of editableRows) {
      if (!r.date || !r.description) {
        toast.error('All rows must have a date and description before saving');
        return;
      }
    }

    setSaving(true);
    try {
      // Build holidays rows (Date as text dd/MM/yyyy)
      const holidayRows = editableRows.map(r => ({
        'Academic Year': r.academicYear,
        'Term': r.term,
        'Description': r.description,
        'Day': r.day,
        'Date': toDisplayDate(r.date),
        holiday_key: toHolidayKey(r.date),
      }));

      // Build terms rows (Date as date yyyy-MM-dd)
      const termsRows = editableRows.map(r => ({
        'Academic Year': r.academicYear,
        'Term': r.term,
        'Description': r.description,
        'Day': r.day,
        'Date': r.date,
        holiday_key: toHolidayKey(r.date),
      }));

      // Build weeks rows
      const weeksRows = weekCounts.map(wc => ({
        academic_year: academicYear,
        term_number: wc.term,
        num_weeks: wc.weeks,
      }));

      // Insert into holidays
      const { error: hErr } = await dataService.from('holidays').insert(holidayRows);
      if (hErr) throw new Error(`holidays: ${hErr.message}`);

      // Insert into terms
      const { error: tErr } = await dataService.from('terms').insert(termsRows);
      if (tErr) throw new Error(`terms: ${tErr.message}`);

      // Upsert weeks (in case year already partially exists)
      const { error: wErr } = await dataService
        .from('weeks')
        .upsert(weeksRows, { onConflict: 'academic_year,term_number' });
      if (wErr) throw new Error(`weeks: ${wErr.message}`);

      toast.success(`Academic year ${academicYear} created successfully`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add New Academic Year</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === 1 ? 'Step 1 of 2 — Enter term dates' : 'Step 2 of 2 — Review & confirm'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <FiX size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 px-6 pt-4">
          {[1, 2].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Academic Year */}
              <div className="max-w-xs">
                <label className="block text-sm font-bold text-gray-700 mb-1">Academic Year <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={e => { setAcademicYear(e.target.value); setYearError(''); }}
                  placeholder="e.g. 25-26"
                  maxLength={5}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${yearError ? 'border-red-400' : 'border-gray-300'}`}
                />
                {yearError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><FiAlertCircle size={12} />{yearError}</p>}
              </div>

              {/* Terms */}
              {terms.map((term, termIdx) => (
                <div key={term.name} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-gray-800">{term.name}</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={term.startDate}
                        onChange={e => updateTerm(termIdx, 'startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      {term.startDate && <p className="text-xs text-gray-400 mt-0.5">{getDayName(term.startDate)} {toDisplayDate(term.startDate)}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">End Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={term.endDate}
                        onChange={e => updateTerm(termIdx, 'endDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      {term.endDate && <p className="text-xs text-gray-400 mt-0.5">{getDayName(term.endDate)} {toDisplayDate(term.endDate)}</p>}
                    </div>
                  </div>

                  {/* Non-lesson dates */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600">Non-Lesson Dates</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => addNonLessonDate(termIdx, 'single')}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 rounded px-2 py-1 hover:bg-blue-50"
                        >
                          <FiPlus size={12} /> Single date
                        </button>
                        <button
                          onClick={() => addNonLessonDate(termIdx, 'range')}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold border border-purple-200 rounded px-2 py-1 hover:bg-purple-50"
                        >
                          <FiPlus size={12} /> Date range
                        </button>
                      </div>
                    </div>

                    {term.nonLessonDates.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No non-lesson dates added yet.</p>
                    )}

                    <div className="space-y-2">
                      {term.nonLessonDates.map((nl, dateIdx) => (
                        <div key={dateIdx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                          {/* Mode badge */}
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            nl.mode === 'range' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {nl.mode === 'range' ? 'Range' : 'Day'}
                          </span>
                          {/* Date(s) */}
                          <input
                            type="date"
                            value={nl.date}
                            onChange={e => updateNonLessonDate(termIdx, dateIdx, 'date', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 w-36"
                          />
                          {nl.mode === 'range' && (
                            <>
                              <span className="text-xs text-gray-400">to</span>
                              <input
                                type="date"
                                value={nl.dateEnd}
                                min={nl.date}
                                onChange={e => updateNonLessonDate(termIdx, dateIdx, 'dateEnd', e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 w-36"
                              />
                              {nl.date && nl.dateEnd && nl.dateEnd >= nl.date && (
                                <span className="text-xs text-purple-600 font-semibold shrink-0">
                                  {eachDayOfInterval({ start: parseDateField(nl.date), end: parseDateField(nl.dateEnd) }).length}d
                                </span>
                              )}
                            </>
                          )}
                          {nl.mode === 'single' && nl.date && (
                            <span className="text-xs text-gray-400 w-20 shrink-0">{getDayName(nl.date)}</span>
                          )}
                          <input
                            type="text"
                            value={nl.description}
                            onChange={e => updateNonLessonDate(termIdx, dateIdx, 'description', e.target.value)}
                            placeholder="e.g. Half Term Holiday"
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => removeNonLessonDate(termIdx, dateIdx)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                <FiAlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>Review all dates below. You can remove rows, edit descriptions, or add extra rows per term. Week counts update automatically.</span>
              </div>

              {/* Week counts summary */}
              <div className="grid grid-cols-3 gap-3">
                {weekCounts.map(wc => (
                  <div key={wc.term} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{wc.term}</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">{wc.weeks}</p>
                    <p className="text-xs text-gray-400">weeks</p>
                  </div>
                ))}
              </div>

              {/* Editable table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Acad. Year</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Term</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Day</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Key</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editableRows.map(r => (
                      <tr key={r._id} className={`hover:bg-gray-50 ${r._extra ? 'bg-yellow-50' : ''}`}>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.academicYear}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{r.term}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={r.description}
                            onChange={e => updateEditableRow(r._id, 'description', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.day}</td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={r.date}
                            onChange={e => updateEditableRow(r._id, 'date', e.target.value)}
                            className="px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-xs font-mono">{toHolidayKey(r.date) ?? '—'}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeRow(r._id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add row buttons per term */}
              <div className="flex gap-3">
                {TERM_NAMES.map(tn => (
                  <button
                    key={tn}
                    onClick={() => addExtraRow(tn)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50"
                  >
                    <FiPlus size={13} /> Row in {tn}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step === 1 ? (
            <button
              onClick={validateAndPreview}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm"
            >
              Preview →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || editableRows.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm"
            >
              {saving ? (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <FiCheck size={16} />
              )}
              {saving ? 'Saving…' : 'Confirm & Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
