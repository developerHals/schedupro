// Thin client for the Learner Track read/override endpoints
// (functions/api/learnertrack/courses.js and sessions.js).
const API_ROOT = '/api/learnertrack';

async function request(path, { method = 'GET', params, body } = {}) {
  let url = `${API_ROOT}/${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') qs.set(key, value);
    });
    const qsString = qs.toString();
    if (qsString) url += `?${qsString}`;
  }

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = { data: null, error: `Invalid response (${res.status})` };
  }

  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json.data;
}

export const learnerTrackService = {
  getCourses: (params) => request('courses', { params }),
  patchCourseOverride: (body) => request('courses', { method: 'PATCH', body }),
  getSessions: (params) => request('sessions', { params }),
  patchSessionOverride: (body) => request('sessions', { method: 'PATCH', body }),
  // Manually triggers the same sync logic the cron worker runs on a schedule.
  triggerSync: (academicYear) =>
    request(`sync${academicYear ? `?academicYear=${academicYear}` : ''}`, { method: 'POST', body: {} }),
};
