import React, { useState, useEffect, useRef } from 'react';
import { FiPlay, FiPause, FiRefreshCw, FiCoffee, FiMonitor, FiBell } from 'react-icons/fi';
import { format } from 'date-fns';
import PomodoroChat from './PomodoroChat';
import Calculator from './Calculator';
import YouTubeEmbed from './YouTubeEmbed';

const PomodoroTimer = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('work'); // 'work', 'short', 'meal'
  const [mealTime, setMealTime] = useState('13:00');
  const [mealBreakDuration, setMealBreakDuration] = useState(60); // minutes
  const audioRef = useRef(null);

  // Sound effect
  useEffect(() => {
    try {
      audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    } catch (e) {
      console.warn('Audio not initialized', e);
    }
  }, []);

  const playAlarm = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error('Audio play failed:', e));
    }
    // Also show browser notification if permitted
    try {
      if (Notification.permission === 'granted') {
        new Notification('Timer Finished!', { body: 'Time to take a break!' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch (e) {
      console.warn('Notification failed', e);
    }
  };

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft => timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      playAlarm();
      if (mode === 'work') switchMode('short');
      else switchMode('work');
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  // Check for meal time
  useEffect(() => {
    const checkMealTime = setInterval(() => {
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      if (currentTime === mealTime && mode !== 'meal') {
        alert('It is time for your meal break!');
        switchMode('meal');
        playAlarm();
      }
    }, 60000); // Check every minute
    return () => clearInterval(checkMealTime);
  }, [mealTime, mode]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setIsActive(false);
    if (newMode === 'work') setTimeLeft(25 * 60);
    else if (newMode === 'short') setTimeLeft(5 * 60);
    else if (newMode === 'meal') setTimeLeft(mealBreakDuration * 60);
  };

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    if (mode === 'work') setTimeLeft(25 * 60);
    else if (mode === 'short') setTimeLeft(5 * 60);
    else if (mode === 'meal') setTimeLeft(mealBreakDuration * 60);
  };

  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (() => {
    const total = mode === 'work' ? 25 * 60 : mode === 'short' ? 5 * 60 : mealBreakDuration * 60;
    return ((total - timeLeft) / total) * 100;
  })();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
        {/* Left Column: Widgets */}
        <div className="flex flex-col w-full">
          <Calculator />
          <YouTubeEmbed />
        </div>

        {/* Middle Column: Timer Section */}
        <div className="w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full border border-gray-100">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-gray-800 mb-2">Focus Timer</h1>
              <p className="text-gray-500 font-medium">Stay productive and healthy</p>
            </div>

            {/* Mode Selector */}
            <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
              <button
                onClick={() => switchMode('work')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'work' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Work
              </button>
              <button
                onClick={() => switchMode('short')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'short' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Break
              </button>
              <button
                onClick={() => switchMode('meal')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'meal' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Meal
              </button>
            </div>

            {/* Timer Display */}
            <div className="relative w-64 h-64 mx-auto mb-8">
              {/* Circular Progress Background */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-gray-100"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 120}
                  strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
                  className={`transition-all duration-1000 ease-linear ${
                    mode === 'work' ? 'text-blue-500' : mode === 'short' ? 'text-green-500' : 'text-orange-500'
                  }`}
                  strokeLinecap="round"
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-black text-gray-800 tabular-nums tracking-tight">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">
                  {isActive ? 'Running' : 'Paused'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={toggleTimer}
                className={`p-4 rounded-2xl shadow-lg transition-transform active:scale-95 ${
                  isActive 
                    ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                }`}
              >
                {isActive ? <FiPause className="w-8 h-8" /> : <FiPlay className="w-8 h-8 ml-1" />}
              </button>
              <button
                onClick={resetTimer}
                className="p-4 rounded-2xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors active:scale-95"
              >
                <FiRefreshCw className="w-8 h-8" />
              </button>
            </div>

            {/* Meal Settings */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold">
                <FiCoffee className="text-orange-500" />
                <h3>Meal Break Settings</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Time</label>
                  <input
                    type="time"
                    value={mealTime}
                    onChange={(e) => setMealTime(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={mealBreakDuration}
                    onChange={(e) => setMealBreakDuration(parseInt(e.target.value) || 60)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Chat Section */}
        <div className="w-full h-[600px] md:h-[750px]">
          <PomodoroChat />
        </div>
      </div>
    </div>
  );
};

export default PomodoroTimer;
