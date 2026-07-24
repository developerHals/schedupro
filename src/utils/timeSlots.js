/**
 * timeSlots.js
 * Utilities for 30-minute slot ("brick") based time calculations.
 * Grid runs 09:00 – 21:00 → 24 slots.
 */

export const GRID_START_HOUR = 9;   // 09:00
export const GRID_END_HOUR   = 21;  // 21:00 (last slot ends here)
export const SLOT_MINUTES    = 30;
export const SLOT_HEIGHT_PX  = 48;  // pixel height of one 30-min row in the grid

/**
 * All slot start times for the grid as "HH:MM" strings.
 * ["09:00", "09:30", "10:00", ..., "20:30"]  (24 entries)
 */
export const ALL_SLOTS = (() => {
  const slots = [];
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
})();

/**
 * Convert a time string to total minutes from midnight.
 * Handles "9:00", "09:00", "9:30" etc.
 */
export const toMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Returns the ordered list of 30-min slot start-time strings
 * that a booking from startTime to endTime occupies.
 *
 * slotsBetween("09:00", "12:00")
 *   → ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]
 *
 * slotsBetween("08:00", "12:00")
 *   → clips to grid start: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]
 */
export const slotsBetween = (startTime, endTime) => {
  const startMin = Math.max(toMinutes(startTime), GRID_START_HOUR * 60);
  const endMin   = Math.min(toMinutes(endTime),   GRID_END_HOUR   * 60);
  const result   = [];

  for (let m = startMin; m < endMin; m += SLOT_MINUTES) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    result.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return result;
};

/**
 * Returns the grid row index (0-based) for a given slot time string.
 * "09:00" → 0,  "09:30" → 1,  "10:00" → 2, ...
 * Returns -1 if the slot is outside the grid range.
 */
export const slotIndex = (slotTime) => {
  return ALL_SLOTS.indexOf(slotTime);
};
