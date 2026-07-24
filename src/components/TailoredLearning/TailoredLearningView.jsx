import React, { useState, useEffect } from 'react';
import { dataService } from '../../lib/dataService';
import { FiSearch, FiDownload, FiCopy, FiCheck, FiRefreshCw } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const TailoredLearningView = () => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Using the table name provided by user: 'Tailored learning Aims'
      const { data: learningData, error } = await dataService
        .from('Tailored learning Aims')
        .select('*');

      if (error) {
        throw error;
      }

      if (learningData && learningData.length > 0) {
        // Define fixed columns for consistent layout
        const cols = ['Code', 'Tailored Learning Aims'];
        
        setColumns(cols);
        setData(learningData);
      } else {
        setData([]);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      // Improve error message to show detailed code/message
      const details = err.message ? ` (${err.message})` : '';
      const hint = err.code === '42P01' ? ' The table name might be incorrect or missing quotes.' : '';
      setError(`Failed to load data from "Tailored learning Aims"${details}.${hint}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    if (!searchQuery) return true;
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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
    link.setAttribute('download', `tailored_learning_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-white flex flex-col sm:flex-row items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tailored Learning</h2>
          <p className="text-sm text-gray-500 mt-1">Manage learning aims and codes</p>
        </div>

        {/* Search Box */}
        <div className="relative w-96 max-w-full sm:ml-8">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search Tailored Learning Aims..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center gap-3 sm:ml-auto">
          {/* Refresh Button */}
          <button 
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <SafeIcon icon={FiRefreshCw} className="h-4 w-4" />
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
                columns.map(col => {
                  let widthClass = 'px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100';
                  if (col === 'Code') widthClass += ' w-32';
                  
                  return (
                    <th key={col} className={widthClass}>
                      {col === 'Code' ? 'Aim Ref' : col.replace(/_/g, ' ')}
                    </th>
                  );
                })
              ) : (
                 // Default headers
                 <>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Aim Ref</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tailored Learning Aim</th>
                 </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length || 2} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    Loading data...
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 2} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? 'No matching records found' : 'No tailored learning data available in the table.'}
                </td>
              </tr>
            ) : (
              filteredData.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={`${item.id}-${col}`} className="px-6 py-4 text-sm text-gray-700">
                      {col === 'Code' ? (
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
    </div>
  );
};

export default TailoredLearningView;
