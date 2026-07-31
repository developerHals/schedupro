import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { learnerTrackService } from '../../lib/learnerTrackService';

const isCancelled = (status) => String(status || '').trim().toLowerCase().includes('cancel');

const TodayView = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [logoSrcIndex, setLogoSrcIndex] = useState(0);

  const logoSrcs = useMemo(() => ['/Brand.png', '/haringey-learns.png'], []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const data = await learnerTrackService.getSessions({ date: todayStr });

      const enriched = (data || [])
        .filter((s) => !isCancelled(s.BookingStatus))
        .sort((a, b) => String(a.StartTime || '').localeCompare(String(b.StartTime || '')));

      setRows(enriched);
    } catch (e) {
      setError(e?.message || 'Failed to load today classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refreshId = window.setInterval(load, 5 * 60000);

    return () => {
      window.clearInterval(refreshId);
    };
  }, [load]);

  const getRoomShortLabel = (label) => {
    const str = String(label || '').trim();
    if (!str) return '';

    const numMatch = str.match(/\d+/);
    if (numMatch) return numMatch[0];

    const beforeParen = str.split('(')[0].trim();
    if (beforeParen) {
      const sanitized = beforeParen.replace(/[^a-z0-9]+/gi, '');
      if (sanitized) return sanitized.toUpperCase();
    }

    const words = str
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const acronym = words.map(w => w[0]).join('');
    return acronym.toUpperCase();
  };

  const visibleRows = useMemo(() => {
    const today = new Date();
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return (rows || []).filter(r => {
      const endTime = String(r?.EndTime || '').trim();
      const match = endTime.match(/^(\d{1,2}):(\d{2})/);
      if (!match) return true;
      const end = new Date(base);
      end.setHours(Number(match[1]), Number(match[2]), 0, 0);
      return end.getTime() > now.getTime();
    });
  }, [rows, now]);

  const formattedDate = useMemo(() => format(now, 'EEEE, MMMM d, yyyy'), [now]);

  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
        <div className="min-w-[220px]">
          <h2 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-none">Today</h2>
          <div className="mt-2 text-lg md:text-xl font-medium text-gray-600">{formattedDate}</div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {logoSrcIndex < logoSrcs.length ? (
            <img
              src={logoSrcs[logoSrcIndex]}
              alt="Haringey Learns"
              className="h-16 md:h-24 object-contain"
              onError={() => setLogoSrcIndex(i => i + 1)}
            />
          ) : (
            <div className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Haringey Learns</div>
          )}
        </div>


        <div className="min-w-[220px] flex justify-end">
          <div className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-extrabold text-lg md:text-xl shadow-blue-200 shadow-lg">
            {visibleRows.length} Classes Today
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-gray-200 rounded-3xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500 text-lg">Loading today’s classes…</div>
        ) : error ? (
          <div className="p-10 text-center text-red-600 text-lg">{error}</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-10 text-center text-gray-600 text-xl font-semibold">No more classes today</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="w-full min-w-[1100px]">
              <div className="grid grid-cols-[minmax(70px,90px)_minmax(90px,120px)_minmax(90px,120px)_minmax(140px,200px)_minmax(700px,1fr)_minmax(160px,220px)] bg-gray-50 text-gray-900 font-extrabold text-lg md:text-xl px-6 py-4 border-b border-gray-200">
                <div className="text-center">Room</div>
                <div className="text-center">Start</div>
                <div className="text-center">End</div>
                <div>Course</div>
                <div>Class Name</div>
                <div>Tutor</div>
              </div>

              {visibleRows.map((r, idx) => {
                const roomLabel = r.local_room_number || r.RoomLabel;
                const roomDisplay = getRoomShortLabel(roomLabel);
                const roomIsNumeric = Boolean(String(roomDisplay).match(/^\d+$/));

                return (
                  <div
                    key={r.ID || `${r.CourseInstanceID}-${r.StartTime}-${idx}`}
                    className={`grid grid-cols-[minmax(70px,90px)_minmax(90px,120px)_minmax(90px,120px)_minmax(140px,200px)_minmax(700px,1fr)_minmax(160px,220px)] px-6 py-3 text-lg md:text-xl border-b border-gray-100 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <div className={`text-center text-gray-900 ${roomIsNumeric ? 'font-extrabold' : 'font-medium'}`}>{roomDisplay}</div>
                    <div className="text-center font-medium text-gray-900">{r.StartTime}</div>
                    <div className="text-center font-medium text-gray-900">{r.EndTime}</div>
                    <div className="text-gray-900 whitespace-nowrap">{r.CourseShortLabel || r.CourseCode}</div>
                    <div className="text-gray-900 whitespace-nowrap truncate">{r.CourseTitle}</div>
                    <div className="text-gray-900 whitespace-nowrap truncate">{r.TutorLabel}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayView;
