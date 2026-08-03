import React from 'react';
import { FiX, FiDownload, FiShare2, FiCopy } from 'react-icons/fi';
import QRCode from 'qrcode.react';

const QRCodeModal = ({ isOpen, onClose }) => {
  const currentUrl = 'https://schedupro.pages.dev/';

  const downloadQR = () => {
    const canvas = document.getElementById('qr-code');
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'room-booking-qr.png';
    a.click();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Room Booking System',
          text: 'Access the room booking system',
          url: currentUrl
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(currentUrl);
      alert('Link copied to clipboard!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">QR Code</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-gray-600 mb-6">
            Scan this QR code to access the room booking system
          </p>
          
          <div className="flex justify-center mb-6">
            <QRCode 
              id="qr-code" 
              value={currentUrl} 
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>

          <div className="text-sm text-gray-500 mb-6 break-all">
            {currentUrl}
          </div>

          <div className="flex items-center justify-center space-x-3">
            <button 
              onClick={downloadQR}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiDownload className="h-4 w-4 mr-2" />
              Download
            </button>
            <button 
              onClick={copyLink}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiCopy className="h-4 w-4 mr-2" />
              Copy
            </button>
            <button 
              onClick={shareQR}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiShare2 className="h-4 w-4 mr-2" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;