import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../../lib/dataService';
import { FiSearch, FiDownload, FiCopy, FiCheck, FiUpload, FiRefreshCw } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const LearningAimsView = () => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [awardingBodyFilter, setAwardingBodyFilter] = useState('');
  const [fullAimFilter, setFullAimFilter] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const [inputPage, setInputPage] = useState('1');
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Debounce search to prevent excessive requests
    const timer = setTimeout(() => {
      setPage(1); // Reset to page 1 on search change
      setInputPage('1');
      fetchData(1, searchQuery, awardingBodyFilter, fullAimFilter);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, awardingBodyFilter, fullAimFilter]);

  useEffect(() => {
    fetchData(page, searchQuery, awardingBodyFilter, fullAimFilter);
    setInputPage(page.toString());
  }, [page]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    // Allow only numbers
    if (value === '' || /^\d+$/.test(value)) {
      setInputPage(value);
    }
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    }
  };

  const handlePageInputBlur = () => {
    handlePageInputSubmit();
  };

  const handlePageInputSubmit = () => {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
    let newPage = parseInt(inputPage, 10);

    if (isNaN(newPage)) {
      newPage = 1;
    } else {
      // Clamp value between 1 and totalPages
      newPage = Math.max(1, Math.min(newPage, totalPages));
    }

    // Update input to reflect clamped value if different
    setInputPage(newPage.toString());
    
    // Only update page state if different to trigger fetch
    if (newPage !== page) {
      setPage(newPage);
    }
  };

  const fetchData = async (currentPage, search, awardingBody, fullAim) => {
    try {
      setLoading(true);
      setError('');
      
      let query = dataService
        .from('Learning Aims')
        .select('*', { count: 'exact' });

      if (search) {
        // Construct search query for multiple columns
        // Assuming columns are consistent, we search relevant text fields
        query = query.or(`"Aim Ref".ilike.%${search}%,"Aim Title".ilike.%${search}%,"Awarding Body".ilike.%${search}%`);
      }

      if (awardingBody) {
        query = query.ilike('"Awarding Body"', `%${awardingBody}%`);
      }

      if (fullAim) {
        query = query.ilike('"Full Aim"', `%${fullAim}%`);
      }

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: learningData, error, count } = await query
        .order('Aim Ref', { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

      setTotalCount(count || 0);

      if (learningData && learningData.length > 0) {
        // Define fixed columns to ensure consistent order and layout
        const cols = ['Aim Ref', 'Aim Title', 'Awarding Body', 'GLH', 'Base Rate', 'Weighted Rate', 'Full Aim'];
        setColumns(cols);
        setData(learningData);
      } else {
        setData([]);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      const details = err.message ? ` (${err.message})` : '';
      setError(`Failed to load data${details}`);
    } finally {
      setLoading(false);
    }
  };

  // filteredData is now just data since filtering happens server-side
  const filteredData = data;

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    // Use columns state for headers or keys from first item if columns empty
    const headers = columns.length > 0 ? columns : Object.keys(filteredData[0]).filter(k => k !== 'id' && k !== 'created_at');
    
    // Create CSV content
    const csvContent = [
      headers.join(','), // Header row
      ...filteredData.map(row => 
        headers.map(header => {
          const cell = row[header] === null || row[header] === undefined ? '' : row[header];
          // Escape quotes and wrap in quotes if contains comma
          const stringCell = String(cell).replace(/"/g, '""');
          return `"${stringCell}"`;
        }).join(',')
      )
    ].join('\n');

    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `learning_aims_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        
        // Helper to parse CSV (handling quoted values with commas)
        const parseCsv = (input) => {
          const rows = [];
          let row = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < input.length; i++) {
            const ch = input[i];
            if (ch === '"') {
              if (inQuotes && input[i + 1] === '"') {
                cur += '"';
                i++; // skip escaped quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              row.push(cur);
              cur = '';
            } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
              if (ch === '\r' && input[i + 1] === '\n') i++;
              row.push(cur);
              rows.push(row);
              row = [];
              cur = '';
            } else {
              cur += ch;
            }
          }
          if (cur.length > 0 || row.length > 0) {
            row.push(cur);
            rows.push(row);
          }
          return rows.map(r => r.map(c => (c ?? '').trim()));
        };

        const rows = parseCsv(text).filter(r => r.length && r.some(v => v !== ''));
        if (rows.length === 0) {
          alert('CSV file is empty.');
          return;
        }

        const expectedHeaders = ['Aim Ref', 'Aim Title', 'Awarding Body', 'GLH', 'Base Rate', 'Weighted Rate', 'Full Aim'];
        
        // Header mapping
        let headers = rows[0];
        const isHeaderRow = headers.some(h => expectedHeaders.includes(h));
        
        let startIndex = 0;
        if (isHeaderRow) {
          startIndex = 1;
        } else {
          // If no headers found, assume column order matches default expectation
          headers = expectedHeaders;
        }

        const newItems = [];
        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || row.every(c => !c)) continue;

          const item = {};
          // Map by index if headers match expected length, otherwise try best effort
          expectedHeaders.forEach((key, idx) => {
             // If we have a header row, find index of this key
             let val = null;
             if (isHeaderRow) {
               const headerIdx = rows[0].findIndex(h => h === key);
               if (headerIdx !== -1) val = row[headerIdx];
               else val = row[idx]; // fallback
             } else {
               val = row[idx];
             }
             item[key] = val || null;
          });
          newItems.push(item);
        }

        if (newItems.length === 0) {
          alert('No valid data found in CSV.');
          return;
        }

        setLoading(true);
        // Use upsert to handle duplicates (update if exists, insert if new)
        const { error } = await dataService
          .from('Learning Aims')
          .upsert(newItems, { onConflict: 'Aim Ref' });

        if (error) throw error;

        alert(`Successfully imported ${newItems.length} learning aims.`);
        fetchData(1, searchQuery, awardingBodyFilter, fullAimFilter);
        setPage(1);

      } catch (err) {
        console.error('Error importing CSV:', err);
        alert('Failed to import CSV: ' + err.message);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleImportCSV}
        className="hidden"
      />
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-white flex flex-col xl:flex-row items-start xl:items-center gap-4">
        <div className="min-w-max">
          <h2 className="text-xl font-bold text-gray-800">Learning Aims</h2>
          <p className="text-sm text-gray-500 mt-1">Manage learning aims and codes</p>
        </div>

        {/* Filters Container */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full xl:w-auto xl:ml-8">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
                type="text"
                placeholder="Search Learning Aims..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            </div>

            {/* Awarding Body Filter */}
            <div className="relative flex-1 min-w-[180px]">
                <input
                    type="text"
                    placeholder="Filter Awarding Body..."
                    value={awardingBodyFilter}
                    onChange={(e) => setAwardingBodyFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
            </div>

            {/* Full Aim Filter */}
            <div className="relative flex-1 min-w-[180px]">
                <input
                    type="text"
                    placeholder="Filter Full Aim..."
                    value={fullAimFilter}
                    onChange={(e) => setFullAimFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
            </div>
        </div>

        <div className="flex items-center gap-3 xl:ml-auto min-w-max">
          {/* Refresh Button */}
          <button 
            onClick={() => fetchData(page, searchQuery, awardingBodyFilter, fullAimFilter)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <SafeIcon icon={FiRefreshCw} className="h-4 w-4" />
          </button>

          {/* Import CSV Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
            title="Import from CSV"
          >
            <FiUpload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredData.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
              filteredData.length === 0 
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200'
            }`}
            title="Export to CSV"
          >
            <FiDownload className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-sm flex items-center">
          <span className="font-bold mr-2">Error:</span> {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.length > 0 ? (
                columns.map((col, index) => {
                  // Apply specific widths to match spacers
                  let widthClass = 'px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100';
                  if (col === 'Aim Ref') widthClass += ' w-32 min-w-[120px]';
                  if (col === 'Aim Title') widthClass += ' w-96 max-w-md min-w-[300px]';
                  if (col === 'Awarding Body') widthClass += ' w-64 min-w-[200px]';
                  if (col === 'Full Aim') widthClass += ' w-96 min-w-[300px]';
                  
                  return (
                    <th key={col} className={widthClass}>
                      {col.replace(/_/g, ' ')}
                    </th>
                  );
                })
              ) : (
                 // Default headers
                 <>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Aim Ref</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-96">Aim Title</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Awarding Body</th>
                 </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length || 3} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    Loading data...
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 3} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <p className="font-medium mb-1">
                      {searchQuery ? 'No matching records found' : 'No learning aims data available'}
                    </p>
                    {!searchQuery && (
                      <p className="text-xs text-gray-400 max-w-xs text-center">
                        If you have added data to the "Learning Aims" table in Backend, 
                        please ensure Row Level Security (RLS) policies allow read access.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={`${item.id}-${col}`} className={`px-6 py-4 text-sm text-gray-700 ${col === 'Aim Title' ? 'truncate max-w-md' : ''}`}>
                      {col === 'Aim Ref' ? (
                        <div className="flex items-center gap-2 group">
                          <span>{item[col]}</span>
                          <button
                            onClick={() => handleCopy(item[col], item.id || index)}
                            className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy to clipboard"
                          >
                            {copiedId === (item.id || index) ? <FiCheck className="text-green-500" /> : <FiCopy />}
                          </button>
                        </div>
                      ) : (
                        typeof item[col] === 'object' ? JSON.stringify(item[col]) : item[col]
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="border-t border-gray-100 p-4 bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{filteredData.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}</span> to <span className="font-medium">{Math.min(page * PAGE_SIZE, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span>Page</span>
            <input
              type="text"
              value={inputPage}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={handlePageInputBlur}
              className="w-12 px-1 py-0.5 text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <span>of {Math.ceil(totalCount / PAGE_SIZE) || 1}</span>
          </div>

          <button
            onClick={() => setPage(p => Math.min(Math.ceil(totalCount / PAGE_SIZE), p + 1))}
            disabled={page >= Math.ceil(totalCount / PAGE_SIZE) || loading}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningAimsView;