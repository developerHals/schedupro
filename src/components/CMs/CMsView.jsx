import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { FiSearch, FiDownload, FiUpload, FiPlus, FiTrash2, FiRefreshCw, FiEdit2 } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import AddRowModal from '../Modals/AddRowModal';
import DeleteConfirmationModal from '../Modals/DeleteConfirmationModal';

const ADMIN_EMAIL = 'development@haringeylearns.ac.uk';

const CMsView = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data: tableData, error } = await dataService
        .from('CMs')
        .select('*');

      if (error) {
        throw error;
      }

      if (tableData && tableData.length > 0) {
        const firstRow = tableData[0];
        const cols = Object.keys(firstRow).filter(k => k !== 'id' && k !== 'created_at');
        setColumns(cols);
        setData(tableData);
      } else {
        // Default columns matching Backend table structure
        setColumns(['CM name', 'Curriculum area']);
        setData([]);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      const details = err.message ? ` (${err.message})` : '';
      const hint = err.code === '42P01' ? ' The table "CMs" might not exist.' : '';
      setError(`Failed to load data from "CMs"${details}.${hint}`);
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

    const headers = columns.length > 0 ? columns : Object.keys(filteredData[0]).filter(k => k !== 'id' && k !== 'created_at');
    
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        headers.map(header => {
          const cell = row[header] === null || row[header] === undefined ? '' : row[header];
          const stringCell = String(cell).replace(/"/g, '""');
          return `"${stringCell}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `cms_export_${new Date().toISOString().split('T')[0]}.csv`);
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
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        
        if (rows.length < 2) {
          alert('CSV file is empty or missing headers');
          return;
        }

        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const newItems = rows.slice(1).map(row => {
          const values = row.split(',').map(val => val.trim().replace(/^"|"$/g, ''));
          const item = {};
          headers.forEach((header, index) => {
            if (header) {
               item[header] = values[index] || null;
            }
          });
          return item;
        });

        const { error } = await dataService
          .from('CMs')
          .insert(newItems);

        if (error) throw error;

        fetchData(); // Refresh data
        alert(`Successfully imported ${newItems.length} CMs.`);
      } catch (err) {
        console.error('Error importing CSV:', err);
        alert('Failed to import CSV: ' + err.message);
      }
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleAddCM = async (formData) => {
    try {
      const { error } = await dataService
        .from('CMs')
        .insert([formData]);

      if (error) throw error;

      setIsAddModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error adding CM:', err);
      alert('Failed to add CM: ' + err.message);
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setEditFormData({ ...item });
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    setEditSaving(true);
    try {
      const { error } = await dataService
        .from('CMs')
        .update(editFormData)
        .eq('id', editingItem.id);
      if (error) throw error;
      setEditingItem(null);
      fetchData();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await dataService
        .from('CMs')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      fetchData();
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting CM:', err);
      alert('Failed to delete CM: ' + err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-white flex flex-col xl:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">CMs</h2>
          <p className="text-sm text-gray-500 mt-1">Manage Course Managers (CMs)</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Add Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <SafeIcon icon={FiPlus} className="w-4 h-4" />
            <span className="hidden sm:inline">Add CM</span>
          </button>

          {/* Import CSV Button */}
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
            >
              <SafeIcon icon={FiUpload} className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredData.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
              filteredData.length === 0 
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200'
            }`}
          >
            <SafeIcon icon={FiDownload} className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
          </button>
          
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-sm flex items-center">
          <span className="font-bold mr-2">Error:</span> {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              {columns.length > 0 ? (
                columns.map(col => (
                  <th key={col} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))
              ) : (
                 <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">No Columns</th>
              )}
              {user?.email === ADMIN_EMAIL && (
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-20">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length || 1} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    Loading data...
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 1} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <p className="font-medium mb-1">
                      {searchQuery ? 'No matching records found' : 'No CMs found'}
                    </p>
                    {!searchQuery && (
                      <p className="text-xs text-gray-400 max-w-xs text-center">
                        Add a CM manually or import a CSV file to get started.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={`${item.id}-${col}`} className="px-6 py-4 text-sm text-gray-700">
                      {typeof item[col] === 'object' ? JSON.stringify(item[col]) : item[col]}
                    </td>
                  ))}
                  {user?.email === ADMIN_EMAIL && (
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditClick(item)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit CM"
                        >
                          <SafeIcon icon={FiEdit2} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete CM"
                        >
                          <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddRowModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddCM}
        columns={columns}
        title="Add New CM"
      />

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Edit CM</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                ✕
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {columns.map(col => (
                <div key={col}>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                    {col.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="text"
                    value={editFormData[col] ?? ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, [col]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
              >
                {editSaving && <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this CM? This action cannot be undone."
        itemName="CM"
        itemIdentifier={itemToDelete?.['CM name'] || itemToDelete?.id}
      />
    </div>
  );
};

export default CMsView;
