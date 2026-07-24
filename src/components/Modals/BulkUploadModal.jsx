import React, { useState } from 'react';
import { FiX, FiUpload, FiDownload, FiAlertCircle, FiCheckCircle, FiFileText } from 'react-icons/fi';
import { dataService } from '../../lib/dataService';

const BulkUploadModal = ({ isOpen, onClose, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);

  const downloadTemplate = () => {
    const headers = ['course_code', 'room_number', 'date', 'session_type', 'start_time', 'end_time', 'notes', 'schedule_string'];
    const sampleData = [
      'CS101,Room 1,2024-01-15,morning,09:00,11:00,Introduction to Computer Science,Weekly lecture',
      'MATH201,Room 2,2024-01-15,afternoon,14:00,16:00,Advanced Calculus,Lab session',
      'ENG301,Room 3,2024-01-16,evening,18:00,20:00,Creative Writing Workshop,Evening class'
    ];
    const csvContent = [headers.join(','), ...sampleData].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booking_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim().replace(/^"|"$/g, ''); // Remove quotes
        });
        data.push(row);
      }
    }
    return data;
  };

  const validateRow = (row, index) => {
    const errors = [];
    if (!row.course_code) errors.push(`Row ${index + 2}: Course code is required`);
    if (!row.room_number) errors.push(`Row ${index + 2}: Room number is required`);
    if (!row.date) errors.push(`Row ${index + 2}: Date is required`);
    if (!row.session_type || !['morning', 'afternoon', 'evening'].includes(row.session_type)) {
      errors.push(`Row ${index + 2}: Session type must be 'morning', 'afternoon', or 'evening'`);
    }
    if (!row.start_time) errors.push(`Row ${index + 2}: Start time is required`);
    if (!row.end_time) errors.push(`Row ${index + 2}: End time is required`);
    if (!row.notes) errors.push(`Row ${index + 2}: Notes are mandatory`);
    
    // Validate date format
    if (row.date && isNaN(Date.parse(row.date))) {
      errors.push(`Row ${index + 2}: Invalid date format (use YYYY-MM-DD)`);
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (row.start_time && !timeRegex.test(row.start_time)) {
      errors.push(`Row ${index + 2}: Invalid start time format (use HH:MM)`);
    }
    if (row.end_time && !timeRegex.test(row.end_time)) {
      errors.push(`Row ${index + 2}: Invalid end time format (use HH:MM)`);
    }

    return errors;
  };

  const handleFileUpload = async () => {
    if (!file) return;

    setLoading(true);
    setErrors([]);
    setResults(null);

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        setErrors(['No data found in the file']);
        return;
      }

      // Validate all rows
      const validationErrors = [];
      data.forEach((row, index) => {
        const rowErrors = validateRow(row, index);
        validationErrors.push(...rowErrors);
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      // Load rooms to map room numbers to IDs
      const { data: rooms, error: roomsError } = await dataService
        .from('rooms')
        .select('id, room_number');
      
      if (roomsError) throw roomsError;

      const roomMap = {};
      rooms.forEach(room => {
        roomMap[room.room_number] = room.id;
      });

      // Process bookings
      const bookings = [];
      const processingErrors = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const roomId = roomMap[row.room_number];
        
        if (!roomId) {
          processingErrors.push(`Row ${i + 2}: Room '${row.room_number}' not found`);
          continue;
        }

        bookings.push({
          course_code: row.course_code,
          room_id: roomId,
          date: row.date,
          session_type: row.session_type,
          start_time: row.start_time,
          end_time: row.end_time,
          notes: row.notes,
          schedule_string: row.schedule_string || 'Bulk upload'
        });
      }

      if (processingErrors.length > 0) {
        setErrors(processingErrors);
        return;
      }

      // Insert bookings
      const { data: insertedData, error: insertError } = await dataService
        .from('bookings')
        .insert(bookings)
        .select();

      if (insertError) throw insertError;

      setResults({
        total: data.length,
        successful: insertedData.length,
        failed: data.length - insertedData.length
      });

      if (insertedData.length === data.length) {
        setTimeout(() => {
          onUploadComplete();
        }, 2000);
      }

    } catch (error) {
      setErrors([error.message || 'Failed to process file']);
    } finally {
      setLoading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setResults(null);
    setErrors([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <FiUpload className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Bulk Upload Bookings</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Download the CSV template below</li>
              <li>Fill in your booking data following the format</li>
              <li>Upload the completed CSV file</li>
              <li>Review and confirm the import</li>
            </ol>
          </div>

          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center">
              <FiFileText className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">CSV Template</h4>
                <p className="text-sm text-gray-500">Download the template with sample data</p>
              </div>
            </div>
            <button 
              onClick={downloadTemplate}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiDownload className="h-4 w-4 mr-2" />
              Download
            </button>
          </div>

          {/* File Upload */}
          {!results && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                  id="csv-upload"
                />
                <label 
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <FiUpload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-900">
                    {file ? file.name : 'Click to upload CSV file'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    CSV files only, max 10MB
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <FiAlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <h4 className="font-medium text-red-900">Validation Errors</h4>
              </div>
              <div className="text-sm text-red-800 max-h-40 overflow-y-auto">
                {errors.map((error, index) => (
                  <div key={index} className="mb-1">{error}</div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <FiCheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <h4 className="font-medium text-green-900">Upload Complete</h4>
              </div>
              <div className="text-sm text-green-800">
                <p>Total records: {results.total}</p>
                <p>Successfully imported: {results.successful}</p>
                {results.failed > 0 && <p>Failed: {results.failed}</p>}
              </div>
            </div>
          )}

          {/* CSV Format Reference */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">CSV Format Reference:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>course_code:</strong> Text (required) - e.g., "CS101", "MATH201"</p>
              <p><strong>room_number:</strong> Text (required) - e.g., "Room 1", "Lab A"</p>
              <p><strong>date:</strong> Date (required) - Format: YYYY-MM-DD</p>
              <p><strong>session_type:</strong> Text (required) - "morning", "afternoon", or "evening"</p>
              <p><strong>start_time:</strong> Time (required) - Format: HH:MM (24-hour)</p>
              <p><strong>end_time:</strong> Time (required) - Format: HH:MM (24-hour)</p>
              <p><strong>notes:</strong> Text (required) - Description of the session</p>
              <p><strong>schedule_string:</strong> Text (optional) - Additional scheduling info</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          {results ? (
            <>
              <button 
                onClick={resetUpload}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Upload Another
              </button>
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleFileUpload}
                disabled={!file || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Processing...' : 'Upload & Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;