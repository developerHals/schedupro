import React, { useState } from 'react';
import { FiYoutube } from 'react-icons/fi';

const YouTubeEmbed = () => {
  const [urlInput, setUrlInput] = useState('');
  const [videoId, setVideoId] = useState(null);

  const extractVideoId = (input) => {
    if (!input) return null;
    
    // Regular expressions for common YouTube URL formats
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/, // Standard URL
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,             // Shortened URL
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,    // Embed URL
      /^([a-zA-Z0-9_-]{11})$/                                      // Raw Video ID
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const handleInputChange = (e) => {
    const input = e.target.value;
    setUrlInput(input);
    const id = extractVideoId(input);
    setVideoId(id);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <FiYoutube className="text-red-600 w-6 h-6" />
        <h3 className="text-xl font-bold text-gray-800">YouTube</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="youtube-input" className="sr-only">Paste YouTube URL or Video ID</label>
          <input
            id="youtube-input"
            type="text"
            value={urlInput}
            onChange={handleInputChange}
            placeholder="Paste URL or Video ID"
            className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
            aria-label="YouTube URL input"
          />
        </div>

        {videoId && (
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-sm">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&playsinline=1&autoplay=0`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            ></iframe>
          </div>
        )}
        
        {!videoId && urlInput && (
          <p className="text-xs text-red-500 font-medium px-1">
            Invalid YouTube URL or ID
          </p>
        )}
      </div>
    </div>
  );
};

export default YouTubeEmbed;
