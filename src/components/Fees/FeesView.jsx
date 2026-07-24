import React, { useState, useEffect } from 'react';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import NewFeeModal from './NewFeeModal';
import { FiPlus, FiLoader, FiAlertCircle, FiCopy, FiCheck } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const CopyableCell = ({ value, displayValue, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (value === undefined || value === null) return;
    navigator.clipboard.writeText(value.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex items-center space-x-2 group ${className}`}>
      <span>{displayValue}</span>
      <button
        onClick={handleCopy}
        className={`p-1 transition-all duration-200 ${
          copied ? 'text-green-600 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-blue-600'
        }`}
        title="Copy value"
      >
        <SafeIcon icon={copied ? FiCheck : FiCopy} className="h-4 w-4" />
      </button>
    </div>
  );
};

const FeesView = () => {
  const { isCM } = useAuth();
  const [feesGroups, setFeesGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  const fetchFees = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await dataService
        .from('fees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by submission_group_id
      const groups = {};
      data.forEach(row => {
        if (!groups[row.submission_group_id]) {
          groups[row.submission_group_id] = {
            summary: row, // First row contains all course-level totals
            aims: []
          };
        }
        groups[row.submission_group_id].aims.push(row);
      });

      setFeesGroups(Object.values(groups));
    } catch (err) {
      console.error('Error fetching fees:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  if (!isCM()) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <SafeIcon icon={FiAlertCircle} className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <p className="text-xl font-semibold">Access Denied</p>
          <p className="mt-2">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center p-6 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fees Management</h1>
          <p className="text-sm text-gray-500 mt-1">Calculate and track course fees</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-sm"
        >
          <SafeIcon icon={FiPlus} className="h-5 w-5 mr-2" />
          New Fee
        </button>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Other Costs</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutors Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Costs</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">A. Full Fee pp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">A. Concession Fee pp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Total Fees</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Total Funding</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feesGroups.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                        No fee calculations found. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    feesGroups.map((group) => {
                      const { summary } = group;
                      return (
                        <tr key={summary.submission_group_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <CopyableCell 
                              value={summary.course_id} 
                              displayValue={summary.course_id} 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <CopyableCell 
                              value={summary.other_costs} 
                              displayValue={`£${parseFloat(summary.other_costs || 0).toFixed(2)}`} 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <CopyableCell 
                              value={summary.tutors_cost} 
                              displayValue={`£${parseFloat(summary.tutors_cost || 0).toFixed(2)}`} 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <CopyableCell 
                              value={summary.total_costs} 
                              displayValue={`£${parseFloat(summary.total_costs || 0).toFixed(2)}`} 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <CopyableCell 
                              value={summary.a_full_fee_pp} 
                              displayValue={`£${parseFloat(summary.a_full_fee_pp || 0).toFixed(2)}`} 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <CopyableCell 
                              value={summary.a_concession_fee_pp} 
                              displayValue={`£${parseFloat(summary.a_concession_fee_pp || 0).toFixed(2)}`} 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                            <CopyableCell 
                              value={summary.course_total_fees} 
                              displayValue={`£${parseFloat(summary.course_total_fees || 0).toFixed(2)}`}
                              className="font-bold text-blue-600" 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                            <CopyableCell 
                              value={summary.course_total_funding} 
                              displayValue={`£${parseFloat(summary.course_total_funding || 0).toFixed(2)}`}
                              className="font-bold text-green-600" 
                            />
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

      {showModal && (
        <NewFeeModal 
          onClose={() => setShowModal(false)} 
          onSave={fetchFees} 
        />
      )}
    </div>
  );
};

export default FeesView;
