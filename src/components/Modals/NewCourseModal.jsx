import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { FiX, FiPlus, FiTrash, FiSave, FiExternalLink } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { format, differenceInWeeks, parse, isValid, addDays, parseISO } from 'date-fns';
import { dataService } from '../../lib/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDetails } from '../../utils/userUtils';

const TimePicker = ({ value, onChange, className }) => {
  const [hour, minute] = (value || ':').split(':');
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '10', '15', '20', '30', '40', '45', '50'];
  
  const updateTime = (newHour, newMinute) => {
    if (!newHour && !newMinute) onChange('');
    else onChange(`${newHour || '09'}:${newMinute || '00'}`);
  };

  return (
    <div className="flex items-center space-x-1">
      <select 
        className={`${className} appearance-none`} 
        style={{ width: '45%', minWidth: '60px', paddingRight: '1.5rem', backgroundImage: 'none' }}
        value={hour || ''} 
        onChange={e => updateTime(e.target.value, minute)}
      >
        <option value="">HH</option>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="font-bold text-gray-400">:</span>
      <select 
        className={`${className} appearance-none`}
        style={{ width: '45%', minWidth: '60px', paddingRight: '1.5rem', backgroundImage: 'none' }}
        value={minute || ''} 
        onChange={e => updateTime(hour, e.target.value)}
      >
        <option value="">MM</option>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
};

const NewCourseModal = ({ isOpen, onClose, onSubmit, initialData, getAvailableRooms }) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const lastAutoDeadlineRef = useRef('');
  const [options, setOptions] = useState({
    tutors: [],
    rooms: [],
    cms: [],
    academicYears: [],
    terms: []
  });

  const [aimSearchResults, setAimSearchResults] = useState([]);
  const [tailoredAimSearchResults, setTailoredAimSearchResults] = useState([]);
  const [displayAimTitle, setDisplayAimTitle] = useState('');
  const [displayTailoredAimTitle, setDisplayTailoredAimTitle] = useState('');

  // Helper for default session
  const createDefaultSession = (courseStartDate, courseEndDate) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
    startTime: '09:00',
    endTime: '10:00',
    date: courseStartDate || today,
    endDate: courseEndDate || today,
    room: '',
    roomCapacity: '',
    tutor: '',
    tutorSubject: '',
    tutorAvailability: '',
    availableRooms: null,
    slot: 'morning 1'
    };
  };

  const parseNoSessionTokenToYmd = (token) => {
    const t = String(token ?? '').trim();
    if (!t) return '';

    const iso = parseISO(t);
    if (isValid(iso)) return format(iso, 'yyyy-MM-dd');

    const formats = ['dd/MM/yy', 'dd/MM/yyyy', 'd/M/yy', 'd/M/yyyy'];
    for (const fmt of formats) {
      const d = parse(t, fmt, new Date());
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    }

    return t;
  };

  const parseNoSessionStringToYmdList = (value) => {
    if (!value) return [];
    return String(value)
      .split(',')
      .map(s => parseNoSessionTokenToYmd(s))
      .filter(Boolean);
  };

  const normalizeAdditionalAims = (value) => {
    if (!value) return '';
    return String(value).trim().replace(/\s+/g, ' ');
  };

  const getAdditionalAimsSummaryFromLearningAims = (aims) => {
    const parts = [];
    (aims || []).forEach(a => {
      const v = normalizeAdditionalAims(a?.additionalAims);
      if (!v) return;
      v.split(' ').filter(Boolean).forEach(p => parts.push(p));
    });
    return Array.from(new Set(parts)).join(' ');
  };

  const getCombinedAdditionalAims = (...values) => {
    const parts = [];
    values.forEach(value => {
      const normalized = normalizeAdditionalAims(value);
      if (!normalized) return;
      normalized.split(' ').filter(Boolean).forEach(part => parts.push(part));
    });
    return Array.from(new Set(parts)).join(' ');
  };

  const getHoursForDateFromAims = (dateString, learningAimsList, tailoredAimsList) => {
    if (!dateString) return '';
    const date = parse(dateString, 'yyyy-MM-dd', new Date());
    if (!isValid(date)) return '';
    const dayOfWeek = format(date, 'EEE');

    let totalHours = 0;
    const processSessions = (aims) => {
      aims.forEach(aim => {
        aim.sessions.forEach(session => {
          if (session.date && session.startTime && session.endTime) {
            const sessionDate = parse(session.date, 'yyyy-MM-dd', new Date());
            if (isValid(sessionDate)) {
              const sessionDay = format(sessionDate, 'EEE');
              if (sessionDay === dayOfWeek) {
                const start = parse(session.startTime, 'HH:mm', new Date());
                const end = parse(session.endTime, 'HH:mm', new Date());
                if (isValid(start) && isValid(end)) {
                  const diff = (end - start) / (1000 * 60 * 60);
                  if (diff > 0) totalHours += diff;
                }
              }
            }
          }
        });
      });
    };

    processSessions(learningAimsList);
    processSessions(tailoredAimsList);

    return totalHours > 0 ? totalHours.toFixed(1) : '0';
  };

  // State for multiple Learning Aims and Tailored Learning Aims
  const [learningAims, setLearningAims] = useState([]);
  const [tailoredAims, setTailoredAims] = useState([]);

  // State for Additional Aims attached to main aims
  const [additionalAims, setAdditionalAims] = useState([]);

  // State for multiple dates with no sessions
  const [noSessionDates, setNoSessionDates] = useState(['']);
  const [noSessionHours, setNoSessionHours] = useState(['0']);
  const [noSessionValues, setNoSessionValues] = useState(['0']);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [selectedHolidayDates, setSelectedHolidayDates] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  const [formData, setFormData] = useState({
    'Course ID': '',
    'Course Name': '',
    'Start date': format(new Date(), 'yyyy-MM-dd'),
    'End date': format(new Date(), 'yyyy-MM-dd'),
    // These will be populated from sessions on submit
    'Date': '',
    'Start time': '',
    'End time': '',
    'Room': '',
    'Room Capacity': '',
    'Tutor': '',
    'Tutor Subject': '',
    'Tutor availability': '',
    'Curriculum Manager': '',
    'Curriculum Area': '',
    // AIMs and Tailored Aims are now handled by separate state arrays
    'AIMs': '', 
    'Tailored learning aims': '', 
    'Awarding Body': '',
    'GLH (Awarding Body)': '',
    'Planned numbers of hours': '',
    'Mode of Delivery': 'Classroom',
    'No. of Sessions per Week': '1',
    'Dates with no sessions': '',
    'No of Hours per Week': '', // Calculated
    'Course No of Weeks': '', // Calculated
    'Base (unweighted rate)': '',
    'Full (weighted rate)': '',
    'Planned Progression': '',
    'Published on webenrol': 'No',
    'BKSB Initial Assessment': 'No',
    'Learning objective 1': '', // Corrected from typo 'Learning objective 12'
    'Learning objective 2': '',
    'Learning objective 3': '',
    'Learning objective 4': '',
    'Learning objective 5': '',
    'Single sentence description': '',
    'What is the course about?': '',
    'Who is the course for?': '',
    'Are there any entry requirements?': '',
    'Do I need to have an interview before I can enrol?': '',
    'How will I be taught?': '',
    'What feedback will I get?': '',
    'How will I be able to give my views on the course?': '',
    'What course can I do next?': '',
    'Additional Information': '',
    'Assessment methods': '',
    'Equipment required': '',
    'Comments': '',
    'Total number of Sessions': 0,
    'Actual Enrolment': '12',
    'Total Base': '0',
    'Total Weighted': '',
    'Planned Costs': '', // Kept for backward compatibility, but UI uses Tutors Cost
    'TL funding': '0',
    'Full fees': '0',
    'Extra costs': '1200',
    'Tutor Rate': '35',
    'Status': 'Pending',
    'Deadline': '',
    'Academic Year': '',
    'Term': ''
  });

  const [errors, setErrors] = useState({});
  const [newComments, setNewComments] = useState(['']); // Multiple new comments

  const extractInitialCourseContext = (data) => {
    let baseData = null;
    let courseRows = [];
    let bookingRows = [];

    if (data) {
      if (data.courses) {
        courseRows = data.courses || [];
        bookingRows = data.bookings || [];
        baseData = courseRows[0] || null;
      } else if (Array.isArray(data)) {
        courseRows = data || [];
        baseData = courseRows[0] || null;
      } else {
        baseData = data;
        courseRows = [data];
      }
    }

    return { baseData, courseRows, bookingRows };
  };

  const handleNewCommentChange = (index, value) => {
    const updated = [...newComments];
    updated[index] = value;
    setNewComments(updated);
  };

  const addNewCommentBox = () => {
    setNewComments([...newComments, '']);
  };

  const removeNewCommentBox = (index) => {
    const updated = newComments.filter((_, i) => i !== index);
    setNewComments(updated);
  };
  // const [aimFilter, setAimFilter] = useState(''); // Moved to individual aim state
  // const [tailoredAimFilter, setTailoredAimFilter] = useState(''); // Moved to individual aim state

  // Initial Data Loading
  useLayoutEffect(() => {
    if (!isOpen) return;

    setShowErrorModal(false);
    setErrorMessage('');
    setAimSearchResults([]);
    setTailoredAimSearchResults([]);
    setDisplayAimTitle('');
    setDisplayTailoredAimTitle('');
    setLearningAims([]);
    setTailoredAims([]);

    const { baseData } = extractInitialCourseContext(initialData);

    if (baseData) {
      const initialNoSessionDates = parseNoSessionStringToYmdList(baseData['Dates with no sessions']);
      if (initialNoSessionDates.length > 0) {
        setNoSessionDates(initialNoSessionDates);
        setNoSessionHours(initialNoSessionDates.map(() => '0'));
        setNoSessionValues(initialNoSessionDates.map(() => '0'));
      } else {
        setNoSessionDates(['']);
        setNoSessionHours(['0']);
        setNoSessionValues(['0']);
      }

      setFormData(prev => ({
        ...prev,
        ...baseData,
        'Actual Enrolment': baseData['Actual Enrolments'] || '',
        'Status': baseData['Status'] || 'Pending',
        'Deadline': baseData['Deadline'] || ''
      }));

      try {
        const start = baseData['Start date'] ? parseISO(baseData['Start date']) : null;
        if (start && isValid(start)) {
          const suggested = format(addDays(start, 14), 'yyyy-MM-dd');
          if ((baseData['Deadline'] || '') === suggested) {
            lastAutoDeadlineRef.current = suggested;
          } else {
            lastAutoDeadlineRef.current = '';
          }
        } else {
          lastAutoDeadlineRef.current = '';
        }
      } catch {
        lastAutoDeadlineRef.current = '';
      }
      setNewComments(['']);
    } else {
      setLearningAims([]);
      setTailoredAims([]);
      lastAutoDeadlineRef.current = '';

      setFormData(prev => ({
        ...prev,
        id: undefined,
        'Course ID': '',
        'Course Name': '',
        'Start date': format(new Date(), 'yyyy-MM-dd'),
        'End date': format(new Date(), 'yyyy-MM-dd'),
        'AIMs': '',
        'Tailored learning aims': '',
        'Curriculum Manager': '',
        'Curriculum Area': '',
        'Awarding Body': '',
        'GLH (Awarding Body)': '',
        'Base (unweighted rate)': '',
        'Full (weighted rate)': '',
        'Actual Enrolment': '12',
        'Extra costs': '1200',
        'Total Base': '',
        'Total Weighted': '',
        'Status': 'Pending',
        'Deadline': ''
      }));
      setNewComments(['']);
      setNoSessionDates(['']);
      setNoSessionHours(['0']);
      setNoSessionValues(['0']);
      setAdditionalAims([]);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (isOpen) {
      fetchOptions();

      const { baseData, courseRows, bookingRows } = extractInitialCourseContext(initialData);
      if (!baseData) return;
      const initialNoSessionDates = parseNoSessionStringToYmdList(baseData['Dates with no sessions']);

      if (baseData['Course ID']) {
        dataService.from('Courses Costing').select('*').eq('Course ID', baseData['Course ID']).single()
          .then(({ data }) => {
            if (data) {
              setFormData(prev => ({
                ...prev,
                'Planned Costs': data['Planned Costs'] || ''
              }));
            }
          });
      }

      const processAims = async () => {
            const learningMap = new Map(); // Aim Ref -> { aim details, sessions: [] }
            const tailoredMap = new Map(); // Aim Code -> { aim details, sessions: [] }

            // Fetch Tutors and Rooms for lookup
            const [tutorsRes, roomsRes] = await Promise.all([
                dataService.from('Tutors').select('*'),
                dataService.from('rooms').select('*')
            ]);
            
            const tutorsMap = new Map();
            if (tutorsRes.data) {
                tutorsRes.data.forEach(t => tutorsMap.set(t['Tutor name'], t));
            }

            const roomsMap = new Map();
            if (roomsRes.data) {
                roomsRes.data.forEach(r => roomsMap.set(r.room_number, r));
            }

            // Group courses by Aim
            for (const row of courseRows) {
                const aimRef = row['AIMs'];
                const tailoredRef = row['Tailored learning aims'];

                if (aimRef) {
                    if (!learningMap.has(aimRef)) {
                        learningMap.set(aimRef, {
                            id: Date.now() + Math.random(),
                            aimRef,
                            title: row['Related Aim Title'] || '', // Load from course data if available
                            awardingBody: row['Awarding Body'] || '',
                            glh: row['GLH (Awarding Body)'] || '',
                            baseRate: row['Base (unweighted rate)'] || '',
                            weightedRate: row['Full (weighted rate)'] || '',
                            baseRateEnrolled: row['Base Rate Enrolled'] || '12',
                            weightedEnrolled: row['Weighted Enrolled'] || '12',
                            additionalAims: row['Additional Aims'] || '',
                            tutor: row['Tutor'] || '',
                            sessions: []
                        });
                    }
                    const aim = learningMap.get(aimRef);
                    aim.sessions.push(row);
                } else if (tailoredRef) {
                    if (!tailoredMap.has(tailoredRef)) {
                        tailoredMap.set(tailoredRef, {
                            id: Date.now() + Math.random(),
                            code: tailoredRef,
                            title: row['Related Tailored Aim Title'] || '', // Load from course data if available
                            tutor: row['Tutor'] || '',
                            tailoredLearningRate: row['Tailored Learning Rate'] || '10',
                            actuallyEnrolled: row['Tailored Enrolled'] || '12',
                            additionalAims: row['Additional Aims'] || '',
                            sessions: []
                        });
                    }
                    const aim = tailoredMap.get(tailoredRef);
                    aim.sessions.push(row);
                }
            }

            // Helper to deduce pattern
            const consolidateSessions = (rows) => {
                const patterns = new Map(); // "Day+Time+Room" -> session
                const sanitizeTime = (t) => t ? t.substring(0, 5) : '';
                
                rows.forEach(row => {
                    // We need to group by DayOfWeek + StartTime + EndTime + Room
                    // But row only has 'Day Details' e.g. "Mon (Morning)"
                    // We can extract "Mon".
                    const dayDetails = row['Day Details'] || '';
                    const dayMatch = dayDetails.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
                    const day = dayMatch ? dayMatch[0] : '';
                    
                    const startTime = sanitizeTime(row['Start time']);
                    const endTime = sanitizeTime(row['End time']);
                    
                    const key = `${day}|${startTime}|${endTime}|${row['Room']}`;
                    
                    if (!patterns.has(key)) {
                        const tutorName = row['Tutor'];
                        const tutorInfo = tutorsMap.get(tutorName);
                        const roomNumber = row['Room'];
                        const roomInfo = roomsMap.get(roomNumber);

                        patterns.set(key, {
                            startTime: startTime,
                            endTime: endTime,
                            room: row['Room'], // Name
                            roomCapacity: roomInfo ? roomInfo.capacity : '',
                            tutor: row['Tutor'],
                            tutorSubject: row['Tutor Subject'] || (tutorInfo ? tutorInfo['Subjects'] : ''),
                            tutorAvailability: row['Tutor availability'] || (tutorInfo ? tutorInfo['Availability'] : ''),
                            day,
                            // Fallback date: Course Start Date
                            date: baseData['Start date'] 
                        });
                    }
                });

                // Now find the EXACT date from bookings if available
                const finalSessions = Array.from(patterns.values()).map(pattern => {
                    if (bookingRows.length > 0) {
                        // Filter bookings matching time
                        const matchingBookings = bookingRows.filter(b => 
                            sanitizeTime(b['Start time']) === pattern.startTime && 
                            sanitizeTime(b['End time']) === pattern.endTime
                        );
                        
                        // Find the earliest booking that matches the Day
                        const sortedBookings = matchingBookings.sort((a, b) => new Date(a['Start date']) - new Date(b['Start date']));
                        
                        const match = sortedBookings.find(b => {
                            if (!b['Start date']) return false;
                            const bDate = new Date(b['Start date']);
                            return format(bDate, 'EEE') === pattern.day;
                        });
                        
                        if (match) {
                            return {
                                ...pattern,
                                date: match['Start date'],
                                room: pattern.room // Keep name
                            };
                        }
                    }
                    
                    // Fallback: If no booking found, calculate first occurrence from Course Start
                    if (pattern.day && baseData['Start date']) {
                        let d = new Date(baseData['Start date']);
                        // simple loop to find first 'day'
                        for (let i = 0; i < 7; i++) {
                            if (format(d, 'EEE') === pattern.day) {
                                return { ...pattern, date: format(d, 'yyyy-MM-dd') };
                            }
                            d = addDays(d, 1);
                        }
                    }
                    
                    return pattern;
                });
                
                // Add missing fields
                return finalSessions.map(s => {
                    const roomInfo = roomsMap.get(s.room);
                    const tutorInfo = tutorsMap.get(s.tutor);
                    return {
                        startTime: s.startTime || '09:00',
                        endTime: s.endTime || '10:00',
                        date: s.date,
                        room: s.room || '',
                        roomCapacity: s.roomCapacity || (roomInfo ? roomInfo.capacity : ''),
                        tutor: s.tutor || '',
                        tutorSubject: s.tutorSubject || (tutorInfo ? tutorInfo['Subjects'] : ''),
                        tutorAvailability: s.tutorAvailability || (tutorInfo ? tutorInfo['Availability'] : ''),
                        availableRooms: null
                    };
                });
            };

            // Process Learning Aims
            const finalLearningAims = [];
            for (const aim of learningMap.values()) {
                // Fetch Title if missing
                const cleanRef = aim.aimRef ? String(aim.aimRef).trim() : '';
                if (cleanRef && !aim.title) {
                     const { data } = await dataService.from('Learning Aims').select('Aim Title').eq('Aim Ref', cleanRef).maybeSingle();
                     if (data) aim.title = data['Aim Title'];
                }
                
                aim.sessions = consolidateSessions(aim.sessions);
                finalLearningAims.push(aim);
            }

            // Process Tailored Aims
            const finalTailoredAims = [];
            for (const aim of tailoredMap.values()) {
                // Fetch Title if missing
                const cleanCode = aim.code ? String(aim.code).trim() : '';
                if (cleanCode && !aim.title) {
                    const { data } = await dataService.from('Tailored learning Aims').select('Tailored Learning Aims').eq('Code', cleanCode).maybeSingle();
                    if (data) aim.title = data['Tailored Learning Aims'];
                }
                
                aim.sessions = consolidateSessions(aim.sessions);
                finalTailoredAims.push(aim);
            }
            if (initialNoSessionDates.length > 0) {
              const hours = initialNoSessionDates.map(d => getHoursForDateFromAims(d, finalLearningAims, finalTailoredAims));
              const values = hours.map(h => ((parseFloat(h) || 0) * 35).toFixed(2));
              setNoSessionHours(hours);
              setNoSessionValues(values);
            }

            setLearningAims(finalLearningAims);
            setTailoredAims(finalTailoredAims);
        };
        
        processAims();
        
        // Fetch Additional Aims for this course
        if (baseData['Course ID']) {
            (async () => {
                const { data: additionalAimsData, error: additionalAimsError } = await dataService
                    .from('Courses Additional Aims')
                    .select('*')
                    .eq('Course ID', baseData['Course ID']);
                
                if (!additionalAimsError && additionalAimsData) {
                    // Transform database records to component state format
                    // First, fetch full aim details from Learning Aims or Tailored Learning Aims tables
                    const loadedAdditionalAims = await Promise.all(additionalAimsData.map(async (record, index) => {
                        const aimType = record['Additional Aim Type'];
                        const aimRef = record['Additional Aim Ref'];
                        
                        let aimDetails = {};
                        
                        if (aimType === 'Learning') {
                            // Fetch Learning Aim details
                            const { data: aimData } = await dataService
                                .from('Learning Aims')
                                .select('*')
                                .eq('Aim Ref', aimRef)
                                .single();
                            
                            if (aimData) {
                                aimDetails = {
                                    title: aimData['Aim Title'] || '',
                                    awardingBody: aimData['Awarding Body'] || '',
                                    glh: aimData['GLH'] || '',
                                    baseRate: aimData['Base Rate'] || '0',
                                    weightedRate: aimData['Weighted Rate'] || '0'
                                };
                            }
                        } else {
                            // Fetch Tailored Learning Aim details
                            const { data: aimData } = await dataService
                                .from('Tailored learning Aims')
                                .select('*')
                                .eq('Code', aimRef)
                                .single();
                            
                            if (aimData) {
                                aimDetails = {
                                    title: aimData['Tailored Learning Aims'] || ''
                                };
                            }
                        }
                        
                        return {
                            id: Date.now() + index,
                            mainAimType: record['Main Aim Type'].toLowerCase(),
                            mainAimRef: record['Main Aim Ref'],
                            aimRef: aimType === 'Learning' ? aimRef : undefined,
                            code: aimType === 'Tailored' ? aimRef : undefined,
                            additionalAimType: aimType,
                            // Load stored raw values from database
                            baseRate: record['Base Rate']?.toString() || aimDetails.baseRate || '0',
                            weightedRate: record['Weighted Rate']?.toString() || aimDetails.weightedRate || '0',
                            baseRateEnrolled: record['Base Enrolled']?.toString() || '0',
                            weightedEnrolled: record['Weighted Enrolled']?.toString() || '0',
                            tailoredLearningRate: record['Tailored Rate']?.toString() || '10',
                            glh: record['GLH']?.toString() || aimDetails.glh || '',
                            actuallyEnrolled: record['Actually Enrolled']?.toString() || '0',
                            title: aimDetails.title || '',
                            awardingBody: aimDetails.awardingBody || ''
                        };
                    }));
                    setAdditionalAims(loadedAdditionalAims);
                }
            })();
        }
    }
  }, [isOpen, initialData]);

  // Calculate Hours and Sessions
  useEffect(() => {
    const calculateTotalStats = () => {
        const { 'Start date': startDateStr, 'End date': endDateStr } = formData;
        
        // 1. Calculate Standard Weekly Hours & Pattern Count
        let totalWeeklyHours = 0;
        let patternCount = 0;

        const calculatePattern = (aims) => {
             aims.forEach(aim => {
                 aim.sessions.forEach(session => {
                     patternCount++;
                     if (!session.startTime || !session.endTime) return;
                     const start = parse(session.startTime, 'HH:mm', new Date());
                     const end = parse(session.endTime, 'HH:mm', new Date());
                     if (isValid(start) && isValid(end)) {
                         const diff = (end - start) / (1000 * 60 * 60);
                         if (diff > 0) totalWeeklyHours += diff;
                     }
                 });
             });
        };
        calculatePattern(learningAims);
        calculatePattern(tailoredAims);

        // 2. Calculate Actual Sessions and Planned Hours (Iterating dates)
        let totalSessions = 0;
        let totalPlannedHours = 0;
        let numberOfWeeks = 0;

        if (startDateStr && endDateStr) {
            const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
            const endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());

            if (isValid(startDate) && isValid(endDate) && endDate >= startDate) {
                numberOfWeeks = differenceInWeeks(endDate, startDate);
                
                let currentDate = new Date(startDate);
                // Limit iteration to prevent infinite loops or excessive processing (e.g. max 2 years)
                const maxDate = addDays(startDate, 365 * 2);
                const effectiveEndDate = endDate > maxDate ? maxDate : endDate;

                while (currentDate <= effectiveEndDate) {
                     const dateStr = format(currentDate, 'yyyy-MM-dd');
                     
                     // Check if this date is in noSessionDates
                     if (!noSessionDates.includes(dateStr)) {
                         const dayOfWeek = format(currentDate, 'EEE'); // e.g., 'Mon'
                         
                         // Check if any session matches this day
                         const processAims = (aims) => {
                             aims.forEach(aim => {
                                 aim.sessions.forEach(session => {
                                     if (session.date && session.startTime && session.endTime) {
                                         const sessionDate = parse(session.date, 'yyyy-MM-dd', new Date());
                                         if (isValid(sessionDate)) {
                                             const sessionDay = format(sessionDate, 'EEE');
                                             if (sessionDay === dayOfWeek) {
                                                 // Match!
                                                 totalSessions++;
                                                 
                                                 const start = parse(session.startTime, 'HH:mm', new Date());
                                                 const end = parse(session.endTime, 'HH:mm', new Date());
                                                 if (isValid(start) && isValid(end)) {
                                                     const diff = (end - start) / (1000 * 60 * 60);
                                                     if (diff > 0) totalPlannedHours += diff;
                                                 }
                                             }
                                         }
                                     }
                                 });
                             });
                         };

                         processAims(learningAims);
                         processAims(tailoredAims);
                     }
                     
                     currentDate = addDays(currentDate, 1);
                }
            }
        }

        setFormData(prev => ({
            ...prev,
            'No of Hours per Week': totalWeeklyHours.toFixed(1),
            'Planned numbers of hours': totalPlannedHours.toFixed(1),
            'No. of Sessions per Week': patternCount.toString(),
            'Total number of Sessions': totalSessions,
            'Course No of Weeks': numberOfWeeks
        }));
    };

    calculateTotalStats();
  }, [learningAims, tailoredAims, formData['Start date'], formData['End date'], noSessionDates]);

  // Auto-calculate Planned Costs: Planned numbers of hours * 35
  useEffect(() => {
    const plannedHours = parseFloat(formData['Planned numbers of hours']) || 0;

    if (plannedHours > 0) {
        const suggestedCosts = (plannedHours * 35).toFixed(2);
        setFormData(prev => ({
            ...prev,
            'Planned Costs': suggestedCosts
        }));
    }
  }, [formData['Planned numbers of hours']]);

  // Auto-fill all session end dates when Course End Date changes
  useEffect(() => {
    const courseEndDateStr = formData['End date'];
    if (!courseEndDateStr) return;
    
    const courseEndDate = parse(courseEndDateStr, 'yyyy-MM-dd', new Date());
    if (!isValid(courseEndDate)) return;

    // Update all learning aim sessions
    setLearningAims(prev => prev.map(aim => ({
      ...aim,
      sessions: aim.sessions.map(session => {
        if (!session.date) return session;
        const sessionStartDate = parse(session.date, 'yyyy-MM-dd', new Date());
        if (!isValid(sessionStartDate)) return session;
        
        const dayOfWeek = format(sessionStartDate, 'EEE');
        let checkDate = new Date(courseEndDate);
        // Find the last occurrence of the same day of week before or on course end date
        for (let i = 0; i < 7; i++) {
          if (format(checkDate, 'EEE') === dayOfWeek) {
            if (checkDate >= sessionStartDate) {
              return { ...session, endDate: format(checkDate, 'yyyy-MM-dd') };
            }
            break;
          }
          checkDate = addDays(checkDate, -1);
        }
        return session;
      })
    })));

    // Update all tailored aim sessions
    setTailoredAims(prev => prev.map(aim => ({
      ...aim,
      sessions: aim.sessions.map(session => {
        if (!session.date) return session;
        const sessionStartDate = parse(session.date, 'yyyy-MM-dd', new Date());
        if (!isValid(sessionStartDate)) return session;
        
        const dayOfWeek = format(sessionStartDate, 'EEE');
        let checkDate = new Date(courseEndDate);
        for (let i = 0; i < 7; i++) {
          if (format(checkDate, 'EEE') === dayOfWeek) {
            if (checkDate >= sessionStartDate) {
              return { ...session, endDate: format(checkDate, 'yyyy-MM-dd') };
            }
            break;
          }
          checkDate = addDays(checkDate, -1);
        }
        return session;
      })
    })));
  }, [formData['End date']]);

  // Function to get default Academic Year and Term based on today's date
  // Uses hardcoded logic: Academic year starts September, ends August
  const getDefaultAcademicYearAndTerm = () => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11 (Jan=0, Sep=8)
    const currentYear = today.getFullYear();
    
    // Calculate academic year (e.g., "25-26" for 2025-2026)
    // Academic year starts in September
    let startYear, endYear;
    if (currentMonth >= 8) { // September or later
      startYear = currentYear;
      endYear = currentYear + 1;
    } else { // Before September
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    
    // Format as "YY-YY" (e.g., "25-26")
    const academicYear = `${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
    
    // Determine current term based on month
    // Autumn: Sep-Dec (months 8-11)
    // Spring: Jan-Apr (months 0-3)
    // Summer: May-Aug (months 4-7)
    let term;
    if (currentMonth >= 8 || currentMonth <= 0) {
      term = '1-Autumn Term';
    } else if (currentMonth >= 1 && currentMonth <= 3) {
      term = '2-Spring Term';
    } else {
      term = '3-Summer Term';
    }
    
    return { academicYear, term };
  };

  const fetchOptions = async () => {
    try {
      const [tutorsRes, roomsRes, cmsRes, termsRes] = await Promise.all([
        dataService.from('Tutors').select('*'),
        dataService.from('rooms').select('*'),
        dataService.from('CMs').select('*'),
        dataService.from('Terms').select('*')  // Try with capital T
      ]);

      // Check if Terms query had error, try lowercase if needed
      let termsData = termsRes.data || [];
      if (termsRes.error || termsData.length === 0) {
        const { data: lowercaseData } = await dataService.from('terms').select('*');
        if (lowercaseData && lowercaseData.length > 0) {
          termsData = lowercaseData;
        }
      }

      // Extract unique academic years from terms table
      const academicYears = [...new Set(termsData.map(t => t['Academic Year']))].filter(Boolean);
      
      // Get defaults based on today's date (synchronous now)
      const defaults = getDefaultAcademicYearAndTerm();
      
      // Ensure current academic year is in the list
      if (defaults.academicYear && !academicYears.includes(defaults.academicYear)) {
        academicYears.push(defaults.academicYear);
      }
      
      // Sort academic years descending (e.g., 25-26, 24-25, etc.)
      academicYears.sort((a, b) => b.localeCompare(a));
      
      // Fallback: if no academic years found, add current year
      if (academicYears.length === 0) {
        academicYears.push(defaults.academicYear);
      }
      
      // Hardcoded term options
      const termsList = ['1-Autumn Term', '2-Spring Term', '3-Summer Term'];

      setOptions({
        tutors: tutorsRes.data || [],
        rooms: (roomsRes.data || []).sort((a, b) => {
            const nameA = a.room_number || '';
            const nameB = b.room_number || '';
            
            const getRoomNumber = (name) => {
                const match = name.match(/^(?:Room\s+)?(\d+)$/i);
                return match ? parseInt(match[1], 10) : null;
            };

            const numA = getRoomNumber(nameA);
            const numB = getRoomNumber(nameB);

            if (numA !== null && numB !== null) return numA - numB;
            if (numA !== null && numB === null) return -1;
            if (numA === null && numB !== null) return 1;

            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        }),
        cms: cmsRes.data || [],
        academicYears,
        terms: termsList
      });

      // Set default values for new courses
      if (!initialData) {
        setFormData(prev => ({
          ...prev,
          'Academic Year': defaults.academicYear,
          'Term': defaults.term
        }));
      }
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  // Function to lookup Academic Year and Term from terms table
  const lookupAcademicYearAndTerm = async (startDateStr) => {
    if (!startDateStr) return;
    
    try {
      const startDate = parseISO(startDateStr);
      if (!isValid(startDate)) return;
      
      // Query terms table to find matching academic year and term
      // Uses the same logic as SQL: holiday_key 1=year start, 6=year end, etc.
      let { data: termData } = await dataService.from('Terms').select('*');
      if (!termData || termData.length === 0) {
        const { data: lowercaseData } = await dataService.from('terms').select('*');
        termData = lowercaseData;
      }
      
      if (!termData) return;
      
      // Find academic year (holiday_key 1 to 6)
      const yearStart = termData.find(t => t.holiday_key === 1);
      const yearEnd = termData.find(t => t.holiday_key === 6);
      
      if (yearStart && yearEnd) {
        const yearStartDate = parseISO(yearStart.Date);
        const yearEndDate = parseISO(yearEnd.Date);
        
        if (startDate >= yearStartDate && startDate <= yearEndDate) {
          const academicYear = yearStart['Academic Year'];
          
          // Find term within this academic year
          // Term 1: holiday_key 1-2, Term 2: 3-4, Term 3: 5-6
          const termBoundaries = [
            { name: '1-Autumn Term', startKey: 1, endKey: 2 },
            { name: '2-Spring Term', startKey: 3, endKey: 4 },
            { name: '3-Summer Term', startKey: 5, endKey: 6 }
          ];
          
          let matchedTerm = '';
          for (const term of termBoundaries) {
            const termStart = termData.find(t => t.holiday_key === term.startKey && t['Academic Year'] === academicYear);
            const termEnd = termData.find(t => t.holiday_key === term.endKey && t['Academic Year'] === academicYear);
            
            if (termStart && termEnd) {
              const termStartDate = parseISO(termStart.Date);
              const termEndDate = parseISO(termEnd.Date);
              
              if (startDate >= termStartDate && startDate <= termEndDate) {
                matchedTerm = term.name;
                break;
              }
            }
          }
          
          setFormData(prev => ({
            ...prev,
            'Academic Year': academicYear,
            'Term': matchedTerm
          }));
        }
      }
    } catch (error) {
      console.error('Error looking up academic year and term:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Auto-set Deadline if Start date changes (Start Date + 14 days)
      if (field === 'Start date' && value) {
        try {
          const startDate = parseISO(value);
          // Check if date is valid
          if (isValid(startDate)) {
            const deadlineDate = addDays(startDate, 14);
            const suggested = format(deadlineDate, 'yyyy-MM-dd');
            const currentDeadline = prev['Deadline'];
            if (!currentDeadline || currentDeadline === lastAutoDeadlineRef.current) {
              newData['Deadline'] = suggested;
              lastAutoDeadlineRef.current = suggested;
            }
          }
        } catch (error) {
          console.error('Error auto-setting deadline:', error);
        }
      }

      // Auto-clear room when status changes to 'Not started'
      if (field === 'Status' && value === 'Not started') {
        newData['Room'] = '';
      }

      return newData;
    });

    // Show toast for specific status transitions
    if (field === 'Status') {
      const previousStatus = formData['Status'];
      if (previousStatus === 'Not started' && value === 'Pending') {
        toast('Please select a room for this course', {
          icon: '🏠',
          duration: 5000
        });
      } else if (previousStatus === 'Pending' && value === 'Not started') {
        toast.success('Room cleared. Course marked as Not started.');
      }
    }

    // Auto-lookup Academic Year and Term when Start date changes
    if (field === 'Start date' && value) {
      lookupAcademicYearAndTerm(value);
    }

    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  useEffect(() => {
    if (!formData['Start date']) return;
    try {
      const startDate = parseISO(formData['Start date']);
      if (!isValid(startDate)) return;
      const suggested = format(addDays(startDate, 14), 'yyyy-MM-dd');
      if (!formData['Deadline']) {
        setFormData(prev => ({ ...prev, 'Deadline': suggested }));
        lastAutoDeadlineRef.current = suggested;
      }
    } catch (error) {
      console.error('Error suggesting deadline:', error);
    }
  }, [formData['Start date']]);

  // Nested Session Handlers
  const handleAimSessionChange = async (aimType, aimId, sessionIndex, field, value) => {
      const isLearning = aimType === 'learning';
      const setAims = isLearning ? setLearningAims : setTailoredAims;
      const aims = isLearning ? learningAims : tailoredAims;

      // If user is entering an End Date, cascade it to ALL sessions in ALL aims
      if (field === 'endDate' && value) {
        // Update all learning aim sessions
        setLearningAims(prevLearning => prevLearning.map(aim => ({
          ...aim,
          sessions: aim.sessions.map(session => ({
            ...session,
            endDate: value
          }))
        })));
        // Update all tailored aim sessions
        setTailoredAims(prevTailored => prevTailored.map(aim => ({
          ...aim,
          sessions: aim.sessions.map(session => ({
            ...session,
            endDate: value
          }))
        })));
        return;
      }

      const newAims = aims.map(aim => {
          if (aim.id !== aimId) return aim;
          const newSessions = [...aim.sessions];
          newSessions[sessionIndex] = { ...newSessions[sessionIndex], [field]: value };
          
          // Logic for auto-fill and availability check (scoped to this session)
          const session = newSessions[sessionIndex];

          // Auto-suggest End Date based on Course End Date and selected Day
          if (field === 'date') {
              const date = parse(value, 'yyyy-MM-dd', new Date());
              const courseEndDate = parse(formData['End date'], 'yyyy-MM-dd', new Date());
              
              if (isValid(date) && isValid(courseEndDate)) {
                  const dayOfWeek = format(date, 'EEE');
                  let checkDate = new Date(courseEndDate);
                  // Iterate backwards to find the last occurrence of dayOfWeek
                  for (let i = 0; i < 7; i++) {
                      if (format(checkDate, 'EEE') === dayOfWeek) {
                          // Only update if the suggested end date is on or after the start date
                          if (checkDate >= date) {
                              newSessions[sessionIndex].endDate = format(checkDate, 'yyyy-MM-dd');
                          }
                          break;
                      }
                      checkDate = addDays(checkDate, -1);
                  }
              }
          }

          // Auto-update slot if time changes
          if (field === 'startTime') {
              const hour = parseInt(value.split(':')[0], 10);
              let type = 'morning';
              if (hour >= 12 && hour < 17) type = 'afternoon';
              else if (hour >= 17) type = 'evening';
              // Default to slot 1
              newSessions[sessionIndex].slot = `${type} 1`;
          }

          if (field === 'tutor') {
              const tutor = options.tutors.find(t => t['Tutor name'] === value);
              newSessions[sessionIndex].tutorSubject = tutor ? tutor['Subjects'] : '';
              newSessions[sessionIndex].tutorAvailability = tutor ? tutor['Availability'] : '';
          }
          if (field === 'room') {
              const room = options.rooms.find(r => r.room_number === value);
              newSessions[sessionIndex].roomCapacity = room ? room.capacity : '';
              
              // Auto-fill Actual Enrolment with Room Capacity if this is the first room selection
              // or if the user expects it to sync. 
              // We'll update the global Actual Enrolment field.
              setFormData(prev => ({
                  ...prev,
                  'Actual Enrolment': room ? room.capacity : prev['Actual Enrolment']
              }));
          }
          
          return { ...aim, sessions: newSessions };
      });
      setAims(newAims);
      
      // Separate useEffect will handle Planned Costs calculation based on Actual Enrolment change

      // Async room availability check
      if ((field === 'date' || field === 'startTime' || field === 'endTime') && getAvailableRooms) {
         const aim = newAims.find(a => a.id === aimId);
         const session = aim.sessions[sessionIndex];
         if (session.date && session.startTime && session.endTime) {
             try {
                 const rooms = await getAvailableRooms(
                     session.date, 
                     session.startTime, 
                     session.endTime, 
                     null, // bookingIdToExclude
                     formData['End date'],
                     formData['Course ID'] // courseIdToExclude
                 );
                 
                 const sortedRooms = (rooms || []).sort((a, b) => {
                     const nameA = a.room_number || '';
                     const nameB = b.room_number || '';
                     
                     const getRoomNumber = (name) => {
                         const match = name.match(/^(?:Room\s+)?(\d+)$/i);
                         return match ? parseInt(match[1], 10) : null;
                     };
         
                     const numA = getRoomNumber(nameA);
                     const numB = getRoomNumber(nameB);
         
                     if (numA !== null && numB !== null) return numA - numB;
                     if (numA !== null && numB === null) return -1;
                     if (numA === null && numB !== null) return 1;
         
                     return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                 });

                 // Client-side filtering: Remove rooms already selected in OTHER sessions of this form
                 // that overlap with the current session's time/date.
                 const currentSession = session; // The one being edited (with new values)
                 
                 const checkOverlap = (s1, s2) => {
                     if (!s1.date || !s1.startTime || !s1.endTime) return false;
                     if (!s2.date || !s2.startTime || !s2.endTime) return false;
                     if (s1.date !== s2.date) return false;
                     return (s1.startTime < s2.endTime && s1.endTime > s2.startTime);
                 };

                 const occupiedRooms = new Set();
                 // Combine the updated current-type aims with the existing other-type aims
                 const allAims = [...newAims, ...(isLearning ? tailoredAims : learningAims)];
                 
                 allAims.forEach(a => {
                     a.sessions.forEach((s, idx) => {
                         // Skip the session we are currently editing
                         if (a.id === aimId && idx === sessionIndex) return;
                         
                         const overlaps = s.room && checkOverlap(currentSession, s);
                         if (overlaps) {
                             occupiedRooms.add(s.room); 
                         }
                     });
                 });

                 const finalAvailableRooms = sortedRooms.filter(r => !occupiedRooms.has(r.room_number));

                 setAims(prev => prev.map(a => {
                     if (a.id !== aimId) return a;
                     const updatedSessions = [...a.sessions];
                     updatedSessions[sessionIndex] = { ...updatedSessions[sessionIndex], availableRooms: finalAvailableRooms };
                     return { ...a, sessions: updatedSessions };
                 }));
             } catch (error) {
                 console.error('Error fetching available rooms:', error);
             }
         }
      }
  };

  const handleAddAimSession = (aimType, aimId) => {
      const isLearning = aimType === 'learning';
      const setAims = isLearning ? setLearningAims : setTailoredAims;
      
      setAims(prev => prev.map(aim => {
          if (aim.id !== aimId) return aim;
          if (aim.sessions.length >= 20) return aim; // Limit 20 sessions per aim
          
          let newSession = createDefaultSession(formData['Start date'], formData['End date']);
          
          // Auto-fill from first session if available
          if (aim.sessions.length > 0) {
            const firstSession = aim.sessions[0];
            newSession = {
                ...newSession,
                startTime: firstSession.startTime,
                endTime: firstSession.endTime,
                // Do not copy room or date as per requirements
                tutor: firstSession.tutor,
                tutorSubject: firstSession.tutorSubject,
                tutorAvailability: firstSession.tutorAvailability,
            };
        }
          
          return { ...aim, sessions: [...aim.sessions, newSession] };
      }));
  };

  const handleRemoveAimSession = (aimType, aimId, sessionIndex) => {
      const isLearning = aimType === 'learning';
      const setAims = isLearning ? setLearningAims : setTailoredAims;

      setAims(prev => prev.map(aim => {
          if (aim.id !== aimId) return aim;
          if (aim.sessions.length <= 1) return aim; // Min 1 session
          return { ...aim, sessions: aim.sessions.filter((_, i) => i !== sessionIndex) };
      }));
  };

  // No Session Dates Handlers
  const handleNoSessionDateChange = (index, value) => {
    const newDates = [...noSessionDates];
    newDates[index] = value;
    setNoSessionDates(newDates);
    const defaultHours = getHoursForDate(value) || '0';
    setNoSessionHours(prev => {
      const next = [...prev];
      next[index] = defaultHours;
      return next;
    });
    setNoSessionValues(prev => {
      const next = [...prev];
      const hours = parseFloat(defaultHours) || 0;
      next[index] = (hours * 35).toFixed(2);
      return next;
    });
  };

  const handleAddNoSessionDate = () => {
    const firstDate = noSessionDates.find(d => d !== '') || '';
    const defaultHours = firstDate ? (getHoursForDate(firstDate) || '0') : '0';
    const defaultCost = (parseFloat(defaultHours) * 35).toFixed(2);

    setNoSessionDates([...noSessionDates, firstDate]);
    setNoSessionHours([...noSessionHours, defaultHours]);
    setNoSessionValues([...noSessionValues, defaultCost]);
  };

  const handleRemoveNoSessionDate = (index) => {
    setNoSessionDates(noSessionDates.filter((_, i) => i !== index));
    setNoSessionHours(noSessionHours.filter((_, i) => i !== index));
    setNoSessionValues(noSessionValues.filter((_, i) => i !== index));
  };

  const handleNoSessionHoursChange = (index, value) => {
    setNoSessionHours(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setNoSessionValues(prev => {
      const next = [...prev];
      const hours = parseFloat(value) || 0;
      next[index] = (hours * 35).toFixed(2);
      return next;
    });
  };

  const handleNoSessionValueChange = (index, value) => {
    setNoSessionValues(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const openHolidayModal = async () => {
    setShowHolidayModal(true);
    // Normalize existing dates for comparison with holidays table dates
    setSelectedHolidayDates(noSessionDates.filter(Boolean).map(normalizeDateToYMD));
    setHolidaysLoading(true);
    try {
      const { data, error } = await dataService
        .from('holidays')
        .select('*')
        .order('holiday_key', { ascending: true });
      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error loading holidays:', error);
      toast.error('Failed to load holiday dates');
    } finally {
      setHolidaysLoading(false);
    }
  };

  const toggleHolidayDate = (date) => {
    if (!date) return;
    const normalizedDate = normalizeDateToYMD(date);
    setSelectedHolidayDates(prev => (
      prev.includes(normalizedDate) ? prev.filter(d => d !== normalizedDate) : [...prev, normalizedDate]
    ));
  };

  const normalizeDateToYMD = (dateStr) => {
    if (!dateStr) return '';
    // Try to parse date in various formats and return YYYY-MM-DD
    // Handle DD/MM/YYYY format from holidays table
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    // If already YYYY-MM-DD, return as-is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    // Try parsing with date-fns
    const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) return dateStr;
    // Try DD/MM/YYYY with date-fns
    const parsedDMY = parse(dateStr, 'dd/MM/yyyy', new Date());
    if (isValid(parsedDMY)) return format(parsedDMY, 'yyyy-MM-dd');
    return dateStr;
  };

  const confirmHolidayDates = () => {
    const mergedDates = Array.from(new Set([
      ...noSessionDates.filter(Boolean),
      ...selectedHolidayDates.filter(Boolean)
    ])).map(normalizeDateToYMD).sort();

    const datesToSet = mergedDates.length > 0 ? mergedDates : [''];
    const hoursToSet = datesToSet.map(date => date ? (getHoursForDate(date) || '0') : '0');
    const valuesToSet = hoursToSet.map(hours => ((parseFloat(hours) || 0) * 35).toFixed(2));

    setNoSessionDates(datesToSet);
    setNoSessionHours(hoursToSet);
    setNoSessionValues(valuesToSet);
    setShowHolidayModal(false);
  };

  // Relational Handlers (Main Form)
  
  // --- Learning Aim Handlers ---
  const handleAddLearningAim = () => {
    setLearningAims([...learningAims, {
      id: Date.now(),
      aimRef: '',
      title: '',
      awardingBody: '',
      glh: '',
      baseRate: '',
      weightedRate: '',
      baseRateEnrolled: '0',
      weightedEnrolled: '12',
      additionalAims: '',
      sessions: [createDefaultSession(formData['Start date'], formData['End date'])],
      tutor: ''
    }]);
  };

  const handleRemoveLearningAim = (id) => {
    if (learningAims.length > 0) {
        setLearningAims(learningAims.filter(aim => aim.id !== id));
    }
  };

  const handleLearningAimChange = (id, field, value) => {
      // Update the aim first
      const newAims = learningAims.map(aim => 
          aim.id === id ? { ...aim, [field]: value } : aim
      );

      // Calculate Actual Enrolment from ALL learning aims (sum of all baseRateEnrolled + weightedEnrolled)
      if (field === 'baseRateEnrolled' || field === 'weightedEnrolled') {
          let totalEnrolment = 0;
          newAims.forEach(aim => {
              totalEnrolment += (parseFloat(aim.baseRateEnrolled) || 0) + (parseFloat(aim.weightedEnrolled) || 0);
          });
          
          setFormData(prev => ({
              ...prev,
              'Actual Enrolment': totalEnrolment
          }));
      }

      setLearningAims(newAims);
  };

  const handleLearningAimSearch = async (id, value) => {
    handleLearningAimChange(id, 'aimRef', value);

    if (value.length < 3) {
        setAimSearchResults([]);
        return;
    }

    try {
        const { data } = await dataService.from('Learning Aims')
            .select('*')
            .ilike('Aim Ref', `%${value}%`)
            .limit(50);
        
        setAimSearchResults(data || []);

        const exactMatch = data?.find(a => a['Aim Ref'] === value);
        if (exactMatch) {
            setLearningAims(prev => prev.map(aim => 
                aim.id === id ? {
                    ...aim,
                    aimRef: exactMatch['Aim Ref'],
                    title: exactMatch['Aim Title'],
                    awardingBody: exactMatch['Awarding Body'],
                    glh: exactMatch['GLH'],
                    baseRate: exactMatch['Base Rate'],
                    weightedRate: exactMatch['Weighted Rate']
                } : aim
            ));
        }
    } catch (error) {
        console.error('Error searching aims:', error);
    }
  };

  // --- Additional Aims Handlers ---
  const handleRemoveAdditionalAim = (id) => {
    setAdditionalAims(additionalAims.filter(a => a.id !== id));
  };

  // --- Inline Additional Aims Handler ---
  const handleAddInlineAdditionalAim = (mainAimType, mainAimRef, additionalAimType) => {
    // For additional tailored aims, inherit glh from the parent aim's total hours
    let inheritedGlh = '';
    if (additionalAimType === 'Tailored') {
      const parentAim = tailoredAims.find(a => a.code === mainAimRef) ||
                        learningAims.find(a => a.aimRef === mainAimRef);
      if (parentAim) {
        inheritedGlh = getTotalAimHours(parentAim) || '';
      }
    }

    const newAim = {
      id: Date.now(),
      mainAimType,
      mainAimRef,
      additionalAimType,
      // Learning Aim fields
      aimRef: '',
      title: '',
      awardingBody: '',
      glh: additionalAimType === 'Tailored' ? inheritedGlh : '',
      baseRate: '',
      weightedRate: '',
      baseRateEnrolled: '0',
      weightedEnrolled: '12',
      // Tailored Aim fields
      code: '',
      tailoredLearningRate: '10',
      actuallyEnrolled: '12',
      // For inline search
      searchResults: []
    };
    setAdditionalAims([...additionalAims, newAim]);
  };

  const handleAdditionalAimSearch = async (aimId, value, aimType) => {
    // Update the aim ref value
    const updatedAims = additionalAims.map(a =>
      a.id === aimId ? { ...a, [aimType === 'Learning' ? 'aimRef' : 'code']: value } : a
    );
    setAdditionalAims(updatedAims);

    // Search after delay
    if (value.length >= 3) {
      try {
        if (aimType === 'Learning') {
          const { data, error } = await dataService
            .from('Learning Aims')
            .select('*')
            .ilike('Aim Ref', `%${value}%`)
            .limit(5);
          if (!error && data) {
            setAdditionalAims(prev => prev.map(a =>
              a.id === aimId ? { ...a, searchResults: data } : a
            ));

            // Check if exact match - auto populate
            const exactMatch = data.find(a => a['Aim Ref']?.toLowerCase() === value.toLowerCase());
            if (exactMatch) {
              setAdditionalAims(prev => prev.map(a =>
                a.id === aimId ? {
                  ...a,
                  aimRef: exactMatch['Aim Ref'],
                  title: exactMatch['Aim Title'],
                  awardingBody: exactMatch['Awarding Body'] || '',
                  glh: exactMatch['GLH'] || '',
                  baseRate: exactMatch['Base Rate'] || '',
                  weightedRate: exactMatch['Weighted Rate'] || '',
                  searchResults: []
                } : a
              ));
            }
          }
        } else {
          const { data, error } = await dataService
            .from('Tailored learning Aims')
            .select('*')
            .ilike('Code', `%${value}%`)
            .limit(5);
          if (!error && data) {
            setAdditionalAims(prev => prev.map(a =>
              a.id === aimId ? { ...a, searchResults: data } : a
            ));

            // Check if exact match - auto populate
            const exactMatch = data.find(a => a['Code']?.toLowerCase() === value.toLowerCase());
            if (exactMatch) {
              setAdditionalAims(prev => prev.map(a =>
                a.id === aimId ? {
                  ...a,
                  code: exactMatch['Code'],
                  title: exactMatch['Tailored Learning Aims'],
                  searchResults: []
                } : a
              ));
            }
          }
        }
      } catch (err) {
        console.error('Error searching additional aims:', err);
      }
    }
  };

  const handleSelectAdditionalAim = (aimId, aimData, aimType) => {
    setAdditionalAims(additionalAims.map(a => {
      if (a.id !== aimId) return a;
      
      if (aimType === 'Learning') {
        return {
          ...a,
          aimRef: aimData['Aim Ref'],
          title: aimData['Aim Title'],
          awardingBody: aimData['Awarding Body'] || '',
          glh: aimData['GLH'] || '',
          baseRate: aimData['Base Rate'] || '',
          weightedRate: aimData['Weighted Rate'] || '',
          searchResults: []
        };
      } else {
        return {
          ...a,
          code: aimData['Code'],
          title: aimData['Tailored Learning Aims'],
          searchResults: []
        };
      }
    }));
  };

  const handleAdditionalAimChange = (aimId, field, value) => {
    setAdditionalAims(additionalAims.map(a => 
      a.id === aimId ? { ...a, [field]: value } : a
    ));
  };

  // --- Tailored Aim Handlers ---
  const handleAddTailoredAim = () => {
      setTailoredAims([...tailoredAims, {
        id: Date.now(),
        code: '',
        title: '',
        sessions: [createDefaultSession(formData['Start date'], formData['End date'])],
        tutor: '',
        tailoredLearningRate: '10',
        actuallyEnrolled: '12',
        additionalAims: ''
      }]);
  };

  const handleRemoveTailoredAim = (id) => {
      if (tailoredAims.length > 0) {
          setTailoredAims(tailoredAims.filter(aim => aim.id !== id));
      }
  };

  const handleTailoredAimChange = (id, field, value) => {
      setTailoredAims(tailoredAims.map(aim => 
          aim.id === id ? { ...aim, [field]: value } : aim
      ));
  };

  const handleTailoredAimSearch = async (id, value) => {
    handleTailoredAimChange(id, 'code', value);

    if (value.length < 3) {
        setTailoredAimSearchResults([]);
        return;
    }

    try {
        const { data } = await dataService.from('Tailored learning Aims')
            .select('*')
            .ilike('Code', `%${value}%`)
            .limit(50);
        
        setTailoredAimSearchResults(data || []);

        const exactMatch = data?.find(a => a['Code'] === value);
        if (exactMatch) {
            setTailoredAims(prev => prev.map(aim => 
                aim.id === id ? { 
                    ...aim, 
                    code: value,
                    title: exactMatch['Tailored Learning Aims']
                } : aim
            ));
        }
    } catch (error) {
        console.error('Error searching tailored aims:', error);
    }
  };

  const getSessionDuration = (session) => {
      if (!session.startTime || !session.endTime) return '';
      const start = parse(session.startTime, 'HH:mm', new Date());
      const end = parse(session.endTime, 'HH:mm', new Date());
      if (isValid(start) && isValid(end)) {
          const diff = (end - start) / (1000 * 60 * 60);
          return diff > 0 ? diff.toFixed(1) : '';
      }
      return '';
  };

  const getTotalAimHours = (aim) => {
      const { 'Start date': startDateStr, 'End date': endDateStr } = formData;
      if (!startDateStr || !endDateStr) return '0';

      const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
      const endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
      
      if (!isValid(startDate) || !isValid(endDate) || endDate < startDate) return '0';

      let totalHours = 0;
      let currentDate = new Date(startDate);
      // Safety limit (e.g. 2 years) to prevent browser hang on bad dates
      const maxDate = addDays(startDate, 365 * 2);
      const effectiveEndDate = endDate > maxDate ? maxDate : endDate;

      // Pre-calculate session patterns
      const sessionPatterns = aim.sessions.map(session => {
          if (!session.date || !session.startTime || !session.endTime) return null;
          const sDate = parse(session.date, 'yyyy-MM-dd', new Date());
          if (!isValid(sDate)) return null;
          
          const start = parse(session.startTime, 'HH:mm', new Date());
          const end = parse(session.endTime, 'HH:mm', new Date());
          
          if (!isValid(start) || !isValid(end)) return null;
          
          const diff = (end - start) / (1000 * 60 * 60);
          return diff > 0 ? { day: format(sDate, 'EEE'), duration: diff } : null;
      }).filter(Boolean);

      if (sessionPatterns.length === 0) return '0';

      while (currentDate <= effectiveEndDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          
          // Only count hours if date is NOT in noSessionDates
          if (!noSessionDates.includes(dateStr)) {
              const currentDay = format(currentDate, 'EEE');
              
              sessionPatterns.forEach(p => {
                  if (p.day === currentDay) {
                      totalHours += p.duration;
                  }
              });
          }
          currentDate = addDays(currentDate, 1);
      }
      
      return totalHours.toFixed(1);
  };

  const getHoursForDate = (dateString) => {
    return getHoursForDateFromAims(dateString, learningAims, tailoredAims);
  };

  const handleCMChange = (e) => {
    const cmName = e.target.value;
    const cm = options.cms.find(c => c['CM name'] === cmName);
    setFormData(prev => ({
      ...prev,
      'Curriculum Manager': cmName,
      'Curriculum Area': cm ? cm['Curriculum area'] : ''
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData['Course ID']) newErrors['Course ID'] = 'Required';
    if (!formData['Course Name']) newErrors['Course Name'] = 'Required';
    if (!formData['Start date']) newErrors['Start date'] = 'Required';
    if (!formData['End date']) newErrors['End date'] = 'Required';
    
    // Check for internal session overlaps (same room, same time)
    const allAims = [...learningAims, ...tailoredAims];
    const checkOverlap = (s1, s2) => {
         if (!s1.date || !s1.startTime || !s1.endTime) return false;
         if (!s2.date || !s2.startTime || !s2.endTime) return false;
         if (s1.date !== s2.date) return false;
         return (s1.startTime < s2.endTime && s1.endTime > s2.startTime);
    };

    let hasOverlap = false;
    const allSessions = [];
    allAims.forEach(a => {
        a.sessions.forEach(s => {
            if (s.room && s.room !== 'NR' && s.date && s.startTime && s.endTime) {
                allSessions.push(s);
            }
        });
    });

    for (let i = 0; i < allSessions.length; i++) {
        for (let j = i + 1; j < allSessions.length; j++) {
            const s1 = allSessions[i];
            const s2 = allSessions[j];
            if (s1.room === s2.room && checkOverlap(s1, s2)) {
                hasOverlap = true;
                break;
            }
        }
        if (hasOverlap) break;
    }

    if (hasOverlap) {
        toast.error('Duplicate room booking detected within this form. Please ensure sessions in the same room do not overlap in time.');
        return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toNumberOrNull = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
    return isNaN(n) ? null : n;
  };

  const getFinancials = () => {
    // Basic Inputs
    // Tutors Cost is now what was "Planned Costs"
    // Calculation: (Planned Hours * Tutor Rate) - Sum(No Session Values)
    const plannedHours = parseFloat(formData['Planned numbers of hours']) || 0;
    const tutorRate = parseFloat(formData['Tutor Rate']) || 35;
    const totalNoSessionValue = noSessionValues.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const tutorsCost = Math.max(0, (plannedHours * tutorRate) - totalNoSessionValue);

    // Calculate TL Funding from Tailored Aims
    let calculatedTlFunding = 0;
    tailoredAims.forEach(aim => {
        const rate = parseFloat(aim.tailoredLearningRate) || 0;
        const hours = parseFloat(getTotalAimHours(aim)) || 0;
        const enrolled = parseFloat(aim.actuallyEnrolled) || 0;
        const tlAimFunding = rate * hours;
        calculatedTlFunding += tlAimFunding * enrolled;
    });

    const fullFees = parseFloat(formData['Full fees']) || 0;
    const concessionFees = parseFloat(formData['Concession fees']) || 0;
    const extraCosts = parseFloat(formData['Extra costs']) || 0;

    let totalBase = 0;
    let totalWeighted = 0;
    
    learningAims.forEach(aim => {
        const base = parseFloat(aim.baseRate) || 0;
        const weighted = parseFloat(aim.weightedRate) || 0;
        const baseEnrolled = parseFloat(aim.baseRateEnrolled) || 0;
        const weightedEnrolled = parseFloat(aim.weightedEnrolled) || 0;
        
        totalBase += base * baseEnrolled;
        totalWeighted += weighted * weightedEnrolled;
    });

    // Include Additional Aims in funding calculations
    additionalAims.forEach(aim => {
        if (aim.additionalAimType === 'Learning') {
            const base = parseFloat(aim.baseRate) || 0;
            const weighted = parseFloat(aim.weightedRate) || 0;
            const baseEnrolled = parseFloat(aim.baseRateEnrolled) || 0;
            const weightedEnrolled = parseFloat(aim.weightedEnrolled) || 0;
            
            totalBase += base * baseEnrolled;
            totalWeighted += weighted * weightedEnrolled;
        } else if (aim.additionalAimType === 'Tailored') {
            const rate = parseFloat(aim.tailoredLearningRate) || 0;
            const hours = parseFloat(aim.glh) || 0;
            const enrolled = parseFloat(aim.actuallyEnrolled) || 0;
            calculatedTlFunding += rate * hours * enrolled;
        }
    });

    // tlFunding now includes main tailored aims + all additional tailored aims
    const tlFunding = calculatedTlFunding;

    // Total Base = sum of all Cohort Base Rate values (baseRate * baseRateEnrolled)
    // Total Weighted = sum of all Cohort Weighted Rate values (weightedRate * weightedEnrolled)
    const calculatedTotalBase = totalBase;
    const calculatedTotalWeighted = totalWeighted;
    // Always use calculated values (read-only)
    totalBase = calculatedTotalBase;
    totalWeighted = calculatedTotalWeighted;
    
    // Total Incomes = Total Base + Total Weighted + TL funding + Full fees + Concession fees
    const totalIncomes = totalBase + totalWeighted + tlFunding + fullFees + concessionFees;

    // Total Costs = Tutors Cost + Extra costs (simple addition, not per-learner)
    const totalCosts = tutorsCost + extraCosts;

    // Course GP = Total Incomes - Total Costs
    const courseGP = totalIncomes - totalCosts;

    // GP% = (Course GP / Total Incomes) * 100
    const gpPercent = totalIncomes > 0 ? (courseGP / totalIncomes) * 100 : 0;
    
    return {
        totalBase,
        totalWeighted,
        calculatedTotalBase,
        calculatedTotalWeighted,
        tlFunding,
        fullFees,
        concessionFees,
        totalIncomes,
        tutorsCost,
        extraCosts,
        totalCosts,
        courseGP,
        gpPercent
    };
  };

  const normalizeNumericFields = (obj) => {
    const numericFields = [
      'Room Capacity',
      'Course No of Weeks',
      'GLH (Awarding Body)',
      'Base (unweighted rate)',
      'Full (weighted rate)',
      'No of Hours per Week',
      'Planned numbers of hours',
      "Total Aim's Hours",
      'Total number of Sessions',
      'Actual Enrolments'
    ];
    numericFields.forEach(f => {
      if (Object.prototype.hasOwnProperty.call(obj, f)) {
        obj[f] = toNumberOrNull(obj[f]);
      }
    });
    return obj;
  };

  const getSessionType = (time) => {
      if (!time) return 'morning';
      const hour = parseInt(time.split(':')[0], 10);
      if (hour < 12) return 'morning';
      if (hour < 17) return 'afternoon';
      return 'evening';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      // 1. Gather all sessions for summary
      let allSessions = [];
      learningAims.forEach(aim => {
          aim.sessions.forEach(s => allSessions.push({ ...s, aimRef: aim.aimRef }));
      });
      tailoredAims.forEach(aim => {
          aim.sessions.forEach(s => allSessions.push({ ...s, aimRef: aim.code }));
      });

      const dateString = allSessions.map(s => {
        if (!s.date) return '';
        const d = parse(s.date, 'yyyy-MM-dd', new Date());
        if (!isValid(d)) return '';
        const dayName = format(d, 'EEE');
        const dateStr = format(d, 'dd/MM/yy');
        return `[${s.aimRef || 'No Ref'}] ${dayName} ${dateStr}, ${s.startTime}-${s.endTime}, Room ${s.room}, ${s.tutor}`;
      }).filter(Boolean).join('\n');

      // 2. Merge No Session Dates
      const noSessionString = noSessionDates.filter(Boolean).map(d => {
          const date = parse(d, 'yyyy-MM-dd', new Date());
          return isValid(date) ? format(date, 'dd/MM/yy') : d;
      }).join(', ');

      // 2b. Merge New Comments
      const formattedNewComments = newComments
        .filter(c => c.trim() !== '')
        .map(c => {
           const now = new Date();
           const dateStr = format(now, 'dd/MM/yy');
           const timeStr = format(now, 'HH:mm');
           const { initials } = user ? getUserDetails(user) : { initials: 'SYS' };
           return `(${dateStr}, ${timeStr}, ${initials}) ${c}`;
        })
        .join('\n');

      const existingComments = formData['Comments'] || '';
      const finalComments = formattedNewComments 
        ? (existingComments ? existingComments + '\n' + formattedNewComments : formattedNewComments)
        : existingComments;

      // Insert notification for comments
      if (formattedNewComments) {
        try {
          const userEmail = user?.email || 'System';
          const { error: insertError } = await dataService
            .from('notifications')
            .insert([{
              email: userEmail,
              comments: formattedNewComments,
              "Course ID": formData['Course ID']
            }]);
            
          if (insertError) {
            console.error('Backend Notification Insert Error:', insertError);
            throw insertError;
          }
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
        }
      }

      // 3. Prepare final data
      const currentFinancials = getFinancials();
      const baseData = {
        ...formData,
        'TL funding': currentFinancials.tlFunding,
        'Dates with no sessions': noSessionString,
        'Comments': finalComments + '\n\n-- Schedule Summary --\n' + dateString,
        'student_n': parseFloat(formData['Actual Enrolment']) || 0,
        'learning_incomes': (parseFloat(currentFinancials.totalBase) || 0) + (parseFloat(currentFinancials.totalWeighted) || 0),
        'tailered_incomes': parseFloat(currentFinancials.tlFunding) || 0,
        'total_incomes': parseFloat(currentFinancials.totalIncomes) || 0,
        'gp_pct': parseFloat(currentFinancials.gpPercent) || 0,
        'Tutors Cost': parseFloat(currentFinancials.tutorsCost) || 0,
        'Planned Costs': parseFloat(currentFinancials.totalCosts) || 0,
        'Extra costs': parseFloat(currentFinancials.extraCosts) || 0,
      };

      // Clean up baseData to match Courses table schema
      // Map form fields to DB columns
      if (baseData['Actual Enrolment']) {
          baseData['Actual Enrolments'] = baseData['Actual Enrolment'];
      }
      delete baseData['Actual Enrolment']; 

      // Remove only truly transient fields or variations
      delete baseData['Concession Fees'];  // Remove title-case variation
      delete baseData['concession fees'];  // Remove lowercase variation (keep 'Concession fees' if that's the field)
      delete baseData['Concession fee'];   // Remove singular variation

      // Remove form fields that don't exist in Courses table
      delete baseData['Total Base'];
      delete baseData['Total Weighted'];

      let submissionData = [];
      let bookingsData = [];

      // ALWAYS Generate recurrences (for both Create and Edit modes)
      // We use a delete-and-recreate strategy for edits, so we generate full session lists.
      const tempBookings = [];
      const tempCourses = [];
      const coursesToInsert = [];
      const bookingsToInsert = [];
      const courseEndDate = parse(formData['End date'], 'yyyy-MM-dd', new Date());

      if (!isValid(courseEndDate)) throw new Error('Invalid Course End Date');

      const generateBookings = (aim, session, type) => {
           if (!session.date || !session.startTime || !session.endTime) return;
           let currentDate = parse(session.date, 'yyyy-MM-dd', new Date());
           if (!isValid(currentDate)) return;
           const firstDateStr = session.date;

           while (currentDate <= courseEndDate) {
              const dateStr = format(currentDate, 'yyyy-MM-dd');
              
              if (!noSessionDates.includes(dateStr)) {
                  const dayDetails = format(currentDate, 'EEEE');

                  // Create a Courses table entry ONLY for the first-week occurrence of this session
                  if (dateStr === firstDateStr) {
                      const courseEntry = {
                          ...baseData,
                          'Day Details': dayDetails,
                          'Start time': session.startTime,
                          'End time': session.endTime,
                          'Room': session.room,
                          'Room Capacity': session.roomCapacity,
                          'Tutor': session.tutor || aim.tutor,
                          'Tutor Subject': session.tutorSubject,
                          'Tutor availability': session.tutorAvailability,
                          'Course No of Weeks': formData['Course No of Weeks'],
                          'Actual Enrolments': formData['Actual Enrolment'],
                          
                          'AIMs': type === 'learning' ? aim.aimRef : '',
                          'Additional Aims': type === 'learning'
                            ? getCombinedAdditionalAims(aim.additionalAims)
                            : getCombinedAdditionalAims(aim.additionalAims, getAdditionalAimsSummaryFromLearningAims(learningAims)),
                          'Awarding Body': type === 'learning' ? aim.awardingBody : '',
                          'GLH (Awarding Body)': type === 'learning' ? aim.glh : '',
                          'Base (unweighted rate)': type === 'learning' ? aim.baseRate : '',
                          'Full (weighted rate)': type === 'learning' ? aim.weightedRate : '',

                          'Related Aim Title': type === 'learning' ? aim.title : '',
                          'Related Tailored Aim Title': type === 'tailored' ? aim.title : '',
                          'Tailored Learning Rate': type === 'tailored' ? aim.tailoredLearningRate : null,
                          'Tailored Enrolled': type === 'tailored' ? aim.actuallyEnrolled : null,

                          'Tailored learning aims': type === 'tailored' ? aim.code : '',
                          
                          'Total number of Sessions': formData['Total number of Sessions'],
                          "Total Aim's Hours": getTotalAimHours(aim),

                          'Comments': (baseData['Comments'] || ''),
                          dateObj: currentDate
                      };
                      
                      // Always remove ID to ensure new rows are created (Delete & Recreate strategy)
                      delete courseEntry.id;
                      delete courseEntry['Date'];

                      tempCourses.push(courseEntry);
                  }

                    // Temp Bookings
                    const start = parse(session.startTime, 'HH:mm', new Date());
                    const end = parse(session.endTime, 'HH:mm', new Date());
                    let duration = '';
                    if (isValid(start) && isValid(end)) {
                        const diff = (end - start) / (1000 * 60 * 60);
                        duration = diff.toFixed(1);
                    }

                    if (session.room !== 'NR') {
                        // Look up Room ID for 'Room' column which expects UUID
                        const roomObj = options.rooms.find(r => r.room_number === session.room);
                        const roomId = roomObj ? roomObj.id : null;

                        tempBookings.push({
                            dateObj: currentDate,
                            'Room': roomId || (session.room && session.room !== '' ? session.room : null), // Ensure empty string becomes null for UUID
                            'Course ID': formData['Course ID'],
                          'Course Name': formData['Course Name'],
                          'Day Details': dayDetails,
                          'Start time': session.startTime,
                          'End time': session.endTime,
                          'Lesson Length': duration,
                          'Tutor': session.tutor || aim.tutor,
                          'Start date': dateStr,
                          'End date': dateStr,
                          'Notes': ''
                      });
                    }
              }
              currentDate = addDays(currentDate, 7);
           }
      };

      learningAims.forEach(aim => {
          aim.sessions.forEach(session => generateBookings(aim, session, 'learning'));
      });

      tailoredAims.forEach(aim => {
          // Only generate course row if a tutor is selected (either at aim level or session level)
          // Checking if at least one session has a tutor, or the aim has a default tutor
          const hasTutor = aim.tutor || aim.sessions.some(s => s.tutor);
          if (hasTutor) {
              aim.sessions.forEach(session => generateBookings(aim, session, 'tailored'));
          }
      });

      // Process Temp Bookings & Courses
      if (tempBookings.length > 0) {
          // Sort Bookings
          tempBookings.sort((a, b) => {
              const dateDiff = a.dateObj - b.dateObj;
              if (dateDiff !== 0) return dateDiff;
              return a['Start time'].localeCompare(b['Start time']);
          });

          // Sort Courses (should match bookings order)
          tempCourses.sort((a, b) => {
              const dateDiff = a.dateObj - b.dateObj;
              if (dateDiff !== 0) return dateDiff;
              return a['Start time'].localeCompare(b['Start time']);
          });

          // Process Courses
          tempCourses.forEach((course, index) => {
               const sessionStr = `Session ${index + 1}`;
               const uniqueId = `${course['Course ID']}-${sessionStr}`;
               
               const finalCourse = {
                   ...course,
                   'SESSIONS': uniqueId
               };
               delete finalCourse.dateObj;
               
               coursesToInsert.push(normalizeNumericFields(finalCourse));
          });

          // Process Bookings
          tempBookings.forEach((booking, index) => {
              const lessonNum = index + 1;
              const finalBooking = {
                  ...booking,
                  'Lesson Number': lessonNum // Store as integer
              };
              delete finalBooking.dateObj;
              bookingsToInsert.push(finalBooking);
          });
      }

      if (coursesToInsert.length === 0) {
           throw new Error('No sessions generated. Check Start/End dates and Session dates.');
      }

      submissionData = coursesToInsert;
      bookingsData = bookingsToInsert;

      if (onSubmit) {
        // If parent provided onSubmit, pass just the Courses data (or both if updated)
        const result = await onSubmit(submissionData);
        if (result && result.error) throw result.error;
        if (result && result.success === false) throw new Error('Submission failed');

        // Insert into bookings table
        if (bookingsData.length > 0) {
            // If editing, we might want to delete existing bookings for this Course ID first?
            // For now, we'll append. Ideally we should wipe and recreate for this Course ID.
            // App.jsx likely handled deletion, but to be safe:
            let initialId = initialData?.['Course ID'];
            if (!initialId && initialData?.courses && initialData.courses.length > 0) {
                initialId = initialData.courses[0]['Course ID'];
            }

            if (initialId) {
                 await dataService.from('bookings').delete().eq('Course ID', initialId);
            }

            const { error: bookingError } = await dataService.from('bookings').insert(bookingsData);
            if (bookingError) {
                console.error('Error inserting bookings:', bookingError);
                toast('Course saved, but failed to save detailed bookings: ' + bookingError.message, { icon: '⚠️' });
            }
        }

        // Insert additional aims
        const courseId = formData['Course ID'];
        if (courseId) {
            await dataService.from('Courses Additional Aims').delete().eq('Course ID', courseId);
            
            const additionalAimsToInsert = additionalAims.map(aim => {
                const baseRate = parseFloat(aim.baseRate) || 0;
                const weightedRate = parseFloat(aim.weightedRate) || 0;
                const tailoredRate = parseFloat(aim.tailoredLearningRate) || 0;
                const glh = parseFloat(aim.glh) || 0;
                const baseEnrolled = parseFloat(aim.baseRateEnrolled) || 0;
                const weightedEnrolled = parseFloat(aim.weightedEnrolled) || 0;
                const actuallyEnrolled = parseFloat(aim.actuallyEnrolled) || 0;
                
                return {
                    'Course ID': courseId,
                    'Main Aim Type': aim.mainAimType === 'learning' ? 'Learning' : 'Tailored',
                    'Main Aim Ref': aim.mainAimRef,
                    'Additional Aim Ref': aim.aimRef || aim.code,
                    'Additional Aim Type': aim.additionalAimType,
                    // Calculated totals
                    'Cohort Total Base': aim.additionalAimType === 'Learning' ? (baseRate * baseEnrolled) : 0,
                    'Cohort Total Weighted': aim.additionalAimType === 'Learning' ? (weightedRate * weightedEnrolled) : 0,
                    'Cohort TL Funding': aim.additionalAimType === 'Tailored' ? (tailoredRate * glh * actuallyEnrolled) : 0,
                    // Raw values for reconstruction when loading
                    'Base Rate': baseRate,
                    'Weighted Rate': weightedRate,
                    'Base Enrolled': baseEnrolled,
                    'Weighted Enrolled': weightedEnrolled,
                    'Tailored Rate': tailoredRate,
                    'GLH': glh,
                    'Actually Enrolled': actuallyEnrolled
                };
            });
            
            if (additionalAimsToInsert.length > 0) {
                const { error: additionalAimsError } = await dataService.from('Courses Additional Aims').insert(additionalAimsToInsert);
                if (additionalAimsError) {
                    console.error('Error saving additional aims:', additionalAimsError);
                    toast('Course saved, but failed to save additional aims: ' + additionalAimsError.message, { icon: '⚠️' });
                }
            }
        }
      } else {
        // Direct Database Operation
        
        // 1. Manage Courses Table
        let initialId = initialData?.['Course ID'];
        if (!initialId && initialData?.courses && initialData.courses.length > 0) {
            initialId = initialData.courses[0]['Course ID'];
        }

        // Backup variables for Rollback mechanism
        let backupCourses = [];
        let backupBookings = [];

        if (initialId) {
             // --- EDIT MODE: DELETE EXISTING FIRST ---
             // Fetch backup data first
             const { data: cData } = await dataService.from('Courses').select('*').eq('Course ID', initialId);
             const { data: bData } = await dataService.from('bookings').select('*').eq('Course ID', initialId);
             if (cData) backupCourses = cData;
             if (bData) backupBookings = bData;

             // We use Delete & Recreate strategy for consistency
             await dataService.from('Courses').delete().eq('Course ID', initialId);
             await dataService.from('bookings').delete().eq('Course ID', initialId);
        }

        // --- INSERT (Create or Re-Create) ---
        const toInsertCourses = Array.isArray(submissionData) ? submissionData : [submissionData];
        const { error: courseError } = await dataService.from('Courses').insert(toInsertCourses);
        
        if (courseError) {
            // ROLLBACK: Restore original data if insert fails
            if (initialId && backupCourses.length > 0) {
                console.warn('Update failed. Rolling back changes...');
                await dataService.from('Courses').insert(backupCourses);
                if (backupBookings.length > 0) {
                    await dataService.from('bookings').insert(backupBookings);
                }
                console.warn('Rollback complete.');
            }
            throw courseError;
        }

        // Insert into bookings
        if (bookingsData.length > 0) {
            const { error: bookingError } = await dataService.from('bookings').insert(bookingsData);
            if (bookingError) {
                console.error('Error inserting bookings:', bookingError);
                // Note: We don't rollback here because the Course itself was saved successfully.
                // Bookings are secondary generated data.
                toast('Course saved, but failed to generate detailed bookings: ' + bookingError.message, { icon: '⚠️' });
            }
        }

        // 3. Manage Additional Aims Table
        const courseId = formData['Course ID'];
        if (courseId) {
            // Delete existing additional aims for this course
            await dataService.from('Courses Additional Aims').delete().eq('Course ID', courseId);
            
            // Prepare additional aims data for insertion
            const additionalAimsToInsert = additionalAims.map(aim => {
                const baseRate = parseFloat(aim.baseRate) || 0;
                const weightedRate = parseFloat(aim.weightedRate) || 0;
                const tailoredRate = parseFloat(aim.tailoredLearningRate) || 0;
                const glh = parseFloat(aim.glh) || 0;
                const baseEnrolled = parseFloat(aim.baseRateEnrolled) || 0;
                const weightedEnrolled = parseFloat(aim.weightedEnrolled) || 0;
                const actuallyEnrolled = parseFloat(aim.actuallyEnrolled) || 0;
                
                return {
                    'Course ID': courseId,
                    'Main Aim Type': aim.mainAimType === 'learning' ? 'Learning' : 'Tailored',
                    'Main Aim Ref': aim.mainAimRef,
                    'Additional Aim Ref': aim.aimRef || aim.code,
                    'Additional Aim Type': aim.additionalAimType,
                    // Calculated totals
                    'Cohort Total Base': aim.additionalAimType === 'Learning' ? (baseRate * baseEnrolled) : 0,
                    'Cohort Total Weighted': aim.additionalAimType === 'Learning' ? (weightedRate * weightedEnrolled) : 0,
                    'Cohort TL Funding': aim.additionalAimType === 'Tailored' ? (tailoredRate * glh * actuallyEnrolled) : 0,
                    // Raw values for reconstruction when loading
                    'Base Rate': baseRate,
                    'Weighted Rate': weightedRate,
                    'Base Enrolled': baseEnrolled,
                    'Weighted Enrolled': weightedEnrolled,
                    'Tailored Rate': tailoredRate,
                    'GLH': glh,
                    'Actually Enrolled': actuallyEnrolled
                };
            });
            
            if (additionalAimsToInsert.length > 0) {
                const { error: additionalAimsError } = await dataService.from('Courses Additional Aims').insert(additionalAimsToInsert);
                if (additionalAimsError) {
                    console.error('Error saving additional aims:', additionalAimsError);
                    toast('Course saved, but failed to save additional aims: ' + additionalAimsError.message, { icon: '⚠️' });
                }
            }
        }
      }

      // 2. Manage Costing Table (Always run regardless of submission mode)
      const financials = getFinancials();
      const costingData = {
          'Course ID': formData['Course ID'],
          'Tutor Rate': parseFloat(formData['Tutor Rate']),
          'Total Base': parseFloat(financials.totalBase),
          'Total Weighted': parseFloat(financials.totalWeighted),
          'TL funding': parseFloat(financials.tlFunding),
          'Full fees': parseFloat(financials.fullFees),
          'Concession fees': parseFloat(financials.concessionFees),
          'Total incomes': parseFloat(financials.totalIncomes),
          'Tutors Cost': parseFloat(financials.tutorsCost),
          'Extra costs': parseFloat(financials.extraCosts),
          'Total costs': parseFloat(financials.totalCosts),
          'Course GP': parseFloat(financials.courseGP),
          'GP%': parseFloat(financials.gpPercent)
      };

      // Upsert Costing (Delete then Insert is safest for simple 1:1 by Course ID)
      await dataService.from('Courses Costing').delete().eq('Course ID', formData['Course ID']);
      const { error: costError } = await dataService.from('Courses Costing').insert(costingData);
      if (costError) {
           console.error('Costing error:', costError);
           // Non-fatal, just log
      }

      toast.success('Course saved successfully');
      onClose();
    } catch (error) {
      console.error('Error saving course:', error);
      // toast.error('Failed to save course: ' + error.message);
      setErrorMessage(error.message);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1";
  const sectionClass = "bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4";
  const sectionTitleClass = "text-sm font-bold text-gray-900 mb-3 border-b pb-2";

  const formatCurrency = (val) => {
      if (val === undefined || val === null || val === '') return '';
      // Check if already has £
      if (String(val).includes('£')) return val;
      return `£${val}`;
  };

  const financials = getFinancials();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <FiPlus className="mr-2" /> {initialData && !initialData.isDuplicate ? 'Edit Course' : 'New Course'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Info */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Course ID *</label>
                  <input type="text" className={inputClass} value={formData['Course ID']} onChange={e => handleChange('Course ID', e.target.value)} />
                  {errors['Course ID'] && <p className="text-red-500 text-xs mt-1">{errors['Course ID']}</p>}
                </div>
                <div>
                  <label className={labelClass}>Course Name *</label>
                  <input type="text" className={inputClass} value={formData['Course Name']} onChange={e => handleChange('Course Name', e.target.value)} />
                  {errors['Course Name'] && <p className="text-red-500 text-xs mt-1">{errors['Course Name']}</p>}
                </div>
              </div>
              {/* Academic Year and Term */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Academic Year</label>
                  <select className={inputClass} value={formData['Academic Year']} onChange={e => handleChange('Academic Year', e.target.value)}>
                    <option value="">Select Academic Year</option>
                    {options.academicYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Term</label>
                  <select className={inputClass} value={formData['Term']} onChange={e => handleChange('Term', e.target.value)}>
                    <option value="">Select Term</option>
                    {options.terms.map(term => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Curriculum & Aims */}
            <div className={sectionClass}>
              <div className="flex items-center justify-between border-b border-gray-200 mb-3 pb-2">
                 <h3 className="text-sm font-bold text-gray-900">Curriculum & Aims</h3>
                 <a 
                   href="https://submit-learner-data.service.gov.uk/find-a-learning-aim/LearningAimSearchResult?TeachingYear=2526&HasFilters=False" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                 >
                   Find an aim <FiExternalLink className="ml-1" />
                 </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                 <div className="col-span-2">
                  <label className={labelClass}>Start Date *</label>
                  <input type="date" className={inputClass} value={formData['Start date']} onChange={e => handleChange('Start date', e.target.value)} />
                  {errors['Start date'] && <p className="text-red-500 text-xs mt-1">{errors['Start date']}</p>}
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>End Date *</label>
                  <input type="date" className={inputClass} value={formData['End date']} onChange={e => handleChange('End date', e.target.value)} />
                  {errors['End date'] && <p className="text-red-500 text-xs mt-1">{errors['End date']}</p>}
                </div>
              </div>

              {/* Learning Aims List */}
              <div className="space-y-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-700">Learning Aims</h4>
                {learningAims.map((aim, index) => (
                  <div key={aim.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative mb-4">
                    {learningAims.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLearningAim(aim.id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        <FiTrash />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                      <div className="col-span-2 relative">
                        <div className="flex items-center mb-1">
                            <label className="text-xs font-medium text-gray-700 mr-1">Learning Aim Ref</label>
                            <a href="?view=learning-aims" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">(Click here to select an aim)</a>
                        </div>
                        <input 
                          type="text" 
                          className={inputClass} 
                          value={aim.aimRef}
                          onChange={(e) => handleLearningAimSearch(aim.id, e.target.value)}
                          placeholder="Type to filter Aim Ref..."
                          list={`aim-options-${aim.id}`}
                        />
                        <datalist id={`aim-options-${aim.id}`}>
                            {aimSearchResults.map(a => (
                                <option key={a.id} value={a['Aim Ref']}>{a['Aim Title']}</option>
                            ))}
                        </datalist>
                      </div>
                      <div className="col-span-2">
                         <label className={labelClass}>Related Aim Title</label>
                         <input type="text" className={`${inputClass} bg-gray-100`} value={aim.title} readOnly />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                       <div className="md:col-span-1">
                        <label className={labelClass}>Awarding Body</label>
                        <input type="text" className={`${inputClass} bg-gray-100`} value={aim.awardingBody} readOnly />
                      </div>
                      <div className="md:col-span-1">
                        <label className={labelClass}>GLH</label>
                        <input type="text" className={`${inputClass} bg-gray-100`} value={aim.glh} readOnly />
                      </div>
                      <div className="md:col-span-1">
                        <label className={labelClass}>Base Rate</label>
                        <input type="text" className={`${inputClass} bg-gray-100`} value={formatCurrency(aim.baseRate)} readOnly />
                      </div>
                      <div className="md:col-span-1">
                        <label className={labelClass}>Weighted Rate</label>
                        <input type="text" className={`${inputClass} bg-gray-100`} value={formatCurrency(aim.weightedRate)} readOnly />
                      </div>
                    </div>
                    
                    {/* New Row: Enrolled & Cohort Rates */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                      <div className="md:col-span-1">
                        <label className={labelClass}>Base Rate Enrolled</label>
                        <input 
                            type="number" 
                            className={inputClass} 
                            value={aim.baseRateEnrolled !== undefined && aim.baseRateEnrolled !== '' ? aim.baseRateEnrolled : '12'} 
                            onChange={(e) => handleLearningAimChange(aim.id, 'baseRateEnrolled', e.target.value)} 
                            placeholder="Enrolled"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className={labelClass}>Cohort Base Rate</label>
                        <input 
                            type="text" 
                            className={`${inputClass} bg-gray-100`} 
                            value={formatCurrency((parseFloat(aim.baseRate) || 0) * (parseFloat(aim.baseRateEnrolled) || 0))} 
                            readOnly 
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className={labelClass}>Weighted Rate Enrolled</label>
                         <input 
                            type="number" 
                            className={inputClass} 
                            value={aim.weightedEnrolled !== undefined && aim.weightedEnrolled !== '' ? aim.weightedEnrolled : '12'} 
                            onChange={(e) => handleLearningAimChange(aim.id, 'weightedEnrolled', e.target.value)} 
                            placeholder="Enrolled"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className={labelClass}>Cohort Weighted Rate</label>
                        <input 
                            type="text" 
                            className={`${inputClass} bg-gray-100`} 
                            value={formatCurrency((parseFloat(aim.weightedRate) || 0) * (parseFloat(aim.weightedEnrolled) || 0))} 
                            readOnly 
                        />
                      </div>
                    </div>

                    {/* Add Additional Aims Links */}
                    <div className="mt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={() => handleAddInlineAdditionalAim('learning', aim.aimRef, 'Learning')}
                            className="flex items-center text-blue-600 font-medium text-xs hover:text-blue-800"
                        >
                            <FiPlus className="mr-1" /> Add Additional Learning Aim
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddInlineAdditionalAim('learning', aim.aimRef, 'Tailored')}
                            className="flex items-center text-purple-600 font-medium text-xs hover:text-purple-800"
                        >
                            <FiPlus className="mr-1" /> Add Additional TL Aim
                        </button>
                    </div>

                    {/* Inline Additional Aims for this Learning Aim */}
                    {additionalAims.filter(a => a.mainAimType === 'learning' && a.mainAimRef === aim.aimRef).length > 0 && (
                        <div className="mt-4 space-y-4">
                            {additionalAims
                                .filter(a => a.mainAimType === 'learning' && a.mainAimRef === aim.aimRef)
                                .map((additionalAim, idx) => (
                                    <div 
                                        key={additionalAim.id} 
                                        className={`p-4 border-2 rounded-lg relative ${
                                            additionalAim.additionalAimType === 'Learning' 
                                                ? 'border-blue-300 bg-blue-50/50' 
                                                : 'border-purple-300 bg-purple-50/50'
                                        }`}
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className={`text-sm font-bold ${
                                                additionalAim.additionalAimType === 'Learning' ? 'text-blue-800' : 'text-purple-800'
                                            }`}>
                                                Additional {additionalAim.additionalAimType} Aim #{idx + 1}
                                            </h5>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAdditionalAim(additionalAim.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <FiTrash size={14} />
                                            </button>
                                        </div>

                                        {/* Aim Search and Title */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                                            <div className="col-span-2 relative">
                                                <label className="text-xs font-medium text-gray-700">
                                                    {additionalAim.additionalAimType === 'Learning' ? 'Learning Aim Ref' : 'Tailored Aim Code'}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                    value={additionalAim.additionalAimType === 'Learning' ? additionalAim.aimRef : additionalAim.code}
                                                    onChange={(e) => handleAdditionalAimSearch(additionalAim.id, e.target.value, additionalAim.additionalAimType)}
                                                    placeholder={additionalAim.additionalAimType === 'Learning' ? 'Type Aim Ref...' : 'Type Code...'}
                                                    list={`additional-aim-options-${additionalAim.id}`}
                                                />
                                                <datalist id={`additional-aim-options-${additionalAim.id}`}>
                                                    {(additionalAim.searchResults || []).map(a => (
                                                        <option 
                                                            key={a.id} 
                                                            value={additionalAim.additionalAimType === 'Learning' ? a['Aim Ref'] : a['Code']}
                                                        >
                                                            {additionalAim.additionalAimType === 'Learning' ? a['Aim Title'] : a['Tailored Learning Aims']}
                                                        </option>
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs font-medium text-gray-700">Title</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100" 
                                                    value={additionalAim.title} 
                                                    readOnly 
                                                />
                                            </div>
                                        </div>

                                        {/* Additional Learning Aim Fields */}
                                        {additionalAim.additionalAimType === 'Learning' && (
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-600">Awarding Body</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={additionalAim.awardingBody} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">GLH</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={additionalAim.glh} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Base Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={formatCurrency(additionalAim.baseRate)} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Weighted Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={formatCurrency(additionalAim.weightedRate)} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Base Rate Enrolled</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.baseRateEnrolled || '0'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'baseRateEnrolled', e.target.value)}
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Cohort Base Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white font-medium" 
                                                        value={formatCurrency((parseFloat(additionalAim.baseRate) || 0) * (parseFloat(additionalAim.baseRateEnrolled) || 0))} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Weighted Enrolled</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.weightedEnrolled || '12'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'weightedEnrolled', e.target.value)}
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Cohort Weighted Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white font-medium" 
                                                        value={formatCurrency((parseFloat(additionalAim.weightedRate) || 0) * (parseFloat(additionalAim.weightedEnrolled) || 0))} 
                                                        readOnly 
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Additional Tailored Aim Fields */}
                                        {additionalAim.additionalAimType === 'Tailored' && (
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-600">Tailored Learning rate (£6-£10)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.tailoredLearningRate || '10'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'tailoredLearningRate', e.target.value)}
                                                        min="6"
                                                        max="10"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">TL Aim funding</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100"
                                                        value={formatCurrency(
                                                            (parseFloat(additionalAim.tailoredLearningRate) || 0) *
                                                            (parseFloat(additionalAim.glh) || 0)
                                                        )}
                                                        readOnly
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Actually enrolled</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.actuallyEnrolled !== undefined ? additionalAim.actuallyEnrolled : '12'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'actuallyEnrolled', e.target.value)}
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">TL funding</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white font-medium"
                                                        value={formatCurrency(
                                                            (parseFloat(additionalAim.tailoredLearningRate) || 0) *
                                                            (parseFloat(additionalAim.glh) || 0) *
                                                            (parseFloat(additionalAim.actuallyEnrolled) || 0)
                                                        )}
                                                        readOnly
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}

                    <div className="mt-4 border-t border-gray-200 pt-4">
                        <label className="block text-xs font-bold text-gray-700 mb-2">Sessions</label>
                        {aim.sessions.map((session, sIndex) => (
                             <div key={sIndex} className="p-3 border border-gray-300 rounded-md bg-white mb-3 relative">
                                {aim.sessions.length > 1 && (
                                     <button 
                                        type="button"
                                        onClick={() => handleRemoveAimSession('learning', aim.id, sIndex)}
                                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                     >
                                        <FiTrash />
                                     </button>
                                )}
                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Session</h5>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                    <div>
                                        <label className={labelClass}>Start Time</label>
                                        <TimePicker className={inputClass} value={session.startTime} onChange={val => handleAimSessionChange('learning', aim.id, sIndex, 'startTime', val)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>End Time</label>
                                        <TimePicker className={inputClass} value={session.endTime} onChange={val => handleAimSessionChange('learning', aim.id, sIndex, 'endTime', val)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Day (First Session Date)</label>
                                        <input type="date" className={inputClass} value={session.date} onChange={e => handleAimSessionChange('learning', aim.id, sIndex, 'date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>End Date</label>
                                        <input type="date" className={inputClass} value={session.endDate} onChange={e => handleAimSessionChange('learning', aim.id, sIndex, 'endDate', e.target.value)} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Tutor</label>
                                        <select className={inputClass} value={session.tutor} onChange={e => handleAimSessionChange('learning', aim.id, sIndex, 'tutor', e.target.value)}>
                                            <option value="">Select Tutor</option>
                                            {options.tutors.map(t => (
                                                <option key={t['Tutor name']} value={t['Tutor name']}>{t['Tutor name']}</option>
                                            ))}
                                        </select>
                                     </div>
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Day Details</label>
                                        <input 
                                            type="text" 
                                            className={`${inputClass} bg-gray-100`} 
                                            value={session.date && !isNaN(new Date(session.date)) ? format(new Date(session.date), 'EEEE') : ''} 
                                            readOnly 
                                        />
                                     </div>
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Room (Available only)</label>
                                        <select className={inputClass} value={session.room} onChange={e => handleAimSessionChange('learning', aim.id, sIndex, 'room', e.target.value)}>
                                            <option value="">Select Room</option>
                                            {[
                                              { id: 'NR', room_number: 'NR', capacity: '' },
                                              ...((session.availableRooms !== null ? session.availableRooms : options.rooms) || [])
                                            ].map(r => (
                                                <option key={r.id ?? r.room_number} value={r.room_number}>
                                                  {r.room_number === 'NR' ? 'NR' : `${r.room_number} (Cap: ${r.capacity})`}
                                                </option>
                                            ))}
                                            {session.availableRooms !== null && session.availableRooms.length === 0 && (
                                                <option disabled>No rooms available</option>
                                            )}
                                        </select>
                                     </div>
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>GLH</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={aim.glh} readOnly />
                                     </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>Tutor Subject</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={session.tutorSubject} readOnly />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>Availability</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={session.tutorAvailability} readOnly />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>Capacity</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={session.roomCapacity} readOnly />
                                    </div>
                                    <div className="md:col-span-1">
                                       <label className={labelClass}>Total Aim's Hours</label>
                                       <input type="text" className={`${inputClass} bg-gray-100`} value={getTotalAimHours(aim)} readOnly />
                                   </div>
                               </div>
                            </div>
                        ))}
                        {aim.sessions.length < 5 && (
                            <button
                                type="button"
                                onClick={() => handleAddAimSession('learning', aim.id)}
                                className="flex items-center text-blue-600 font-medium text-xs hover:text-blue-800 mt-2"
                            >
                                <FiPlus className="mr-1" /> Add Session
                            </button>
                        )}
                    </div>
                  </div>
                ))}
                
                <button 
                  type="button" 
                  onClick={handleAddLearningAim} 
                  className="text-blue-600 text-sm flex items-center hover:text-blue-800"
                >
                  <FiPlus className="mr-1" /> Add Learning Aim
                </button>
              </div>

              {/* Tailored Aims List */}
              <div className="space-y-4 mb-6 border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-gray-700">Tailored Learning Aims</h4>
                    <a href="?view=tailored-learning" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View List</a>
                </div>
                
                {tailoredAims.map((aim, index) => (
                  <div key={aim.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative mb-4">
                    {tailoredAims.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTailoredAim(aim.id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        <FiTrash />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                        <div className="col-span-2 relative">
                            <div className="flex items-center mb-1">
                                <label className="text-xs font-medium text-gray-700 mr-1">Tailored Learning Aim Ref</label>
                                <a href="?view=tailored-learning" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">(Click here to select an aim)</a>
                            </div>
                            <input 
                                type="text" 
                                className={inputClass} 
                                value={aim.code} 
                                onChange={(e) => handleTailoredAimSearch(aim.id, e.target.value)}
                                list={`tailored-aim-options-${aim.id}`}
                                placeholder="Type to filter Code..."
                            />
                             <datalist id={`tailored-aim-options-${aim.id}`}>
                                {tailoredAimSearchResults.map(a => (
                                    <option key={a.id} value={a['Code']}>{a['Tailored Learning Aims']}</option>
                                ))}
                            </datalist>
                        </div>
                        <div className="col-span-2">
                           <label className={labelClass}>Related Tailored Aim Title</label>
                           <input type="text" className={`${inputClass} bg-gray-100`} value={aim.title} readOnly />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                        <div className="md:col-span-1">
                            <label className={labelClass}>Tailored Learning rate (£6-£10)</label>
                            <input 
                                type="number" 
                                className={inputClass} 
                                value={aim.tailoredLearningRate || ''} 
                                onChange={e => handleTailoredAimChange(aim.id, 'tailoredLearningRate', e.target.value)} 
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={labelClass}>TL Aim funding</label>
                            <input 
                                type="text" 
                                className={`${inputClass} bg-gray-100`} 
                                value={formatCurrency((parseFloat(aim.tailoredLearningRate) || 0) * (parseFloat(getTotalAimHours(aim)) || 0))} 
                                readOnly 
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={labelClass}>Actually enrolled</label>
                            <input 
                                type="number" 
                                className={inputClass} 
                                value={aim.actuallyEnrolled !== undefined ? aim.actuallyEnrolled : '12'} 
                                onChange={e => handleTailoredAimChange(aim.id, 'actuallyEnrolled', e.target.value)} 
                                placeholder="Enrolled"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={labelClass}>TL funding</label>
                            <input 
                                type="text" 
                                className={`${inputClass} bg-gray-100`} 
                                value={formatCurrency(
                                    (parseFloat(aim.tailoredLearningRate) || 0) * 
                                    (parseFloat(getTotalAimHours(aim)) || 0) * 
                                    (parseFloat(aim.actuallyEnrolled) || 0)
                                )} 
                                readOnly 
                            />
                        </div>
                    </div>

                    {/* Add Additional Aims Links */}
                    <div className="mt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={() => handleAddInlineAdditionalAim('tailored', aim.code, 'Learning')}
                            className="flex items-center text-blue-600 font-medium text-xs hover:text-blue-800"
                        >
                            <FiPlus className="mr-1" /> Add Additional Learning Aim
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddInlineAdditionalAim('tailored', aim.code, 'Tailored')}
                            className="flex items-center text-purple-600 font-medium text-xs hover:text-purple-800"
                        >
                            <FiPlus className="mr-1" /> Add Additional TL Aim
                        </button>
                    </div>

                    {/* Inline Additional Aims for this Tailored Aim */}
                    {additionalAims.filter(a => a.mainAimType === 'tailored' && a.mainAimRef === aim.code).length > 0 && (
                        <div className="mt-4 space-y-4">
                            {additionalAims
                                .filter(a => a.mainAimType === 'tailored' && a.mainAimRef === aim.code)
                                .map((additionalAim, idx) => (
                                    <div 
                                        key={additionalAim.id} 
                                        className={`p-4 border-2 rounded-lg relative ${
                                            additionalAim.additionalAimType === 'Learning' 
                                                ? 'border-blue-300 bg-blue-50/50' 
                                                : 'border-purple-300 bg-purple-50/50'
                                        }`}
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className={`text-sm font-bold ${
                                                additionalAim.additionalAimType === 'Learning' ? 'text-blue-800' : 'text-purple-800'
                                            }`}>
                                                Additional {additionalAim.additionalAimType} Aim #{idx + 1}
                                            </h5>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAdditionalAim(additionalAim.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <FiTrash size={14} />
                                            </button>
                                        </div>

                                        {/* Aim Search and Title */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                                            <div className="col-span-2 relative">
                                                <label className="text-xs font-medium text-gray-700">
                                                    {additionalAim.additionalAimType === 'Learning' ? 'Learning Aim Ref' : 'Tailored Aim Code'}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                    value={additionalAim.additionalAimType === 'Learning' ? additionalAim.aimRef : additionalAim.code}
                                                    onChange={(e) => handleAdditionalAimSearch(additionalAim.id, e.target.value, additionalAim.additionalAimType)}
                                                    placeholder={additionalAim.additionalAimType === 'Learning' ? 'Type Aim Ref...' : 'Type Code...'}
                                                    list={`additional-aim-tailored-options-${additionalAim.id}`}
                                                />
                                                <datalist id={`additional-aim-tailored-options-${additionalAim.id}`}>
                                                    {(additionalAim.searchResults || []).map(a => (
                                                        <option 
                                                            key={a.id} 
                                                            value={additionalAim.additionalAimType === 'Learning' ? a['Aim Ref'] : a['Code']}
                                                        >
                                                            {additionalAim.additionalAimType === 'Learning' ? a['Aim Title'] : a['Tailored Learning Aims']}
                                                        </option>
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs font-medium text-gray-700">Title</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100" 
                                                    value={additionalAim.title} 
                                                    readOnly 
                                                />
                                            </div>
                                        </div>

                                        {/* Additional Learning Aim Fields */}
                                        {additionalAim.additionalAimType === 'Learning' && (
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-600">Awarding Body</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={additionalAim.awardingBody} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">GLH</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={additionalAim.glh} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Base Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={formatCurrency(additionalAim.baseRate)} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Weighted Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100" 
                                                        value={formatCurrency(additionalAim.weightedRate)} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Base Rate Enrolled</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.baseRateEnrolled || '0'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'baseRateEnrolled', e.target.value)}
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Cohort Base Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white font-medium" 
                                                        value={formatCurrency((parseFloat(additionalAim.baseRate) || 0) * (parseFloat(additionalAim.baseRateEnrolled) || 0))} 
                                                        readOnly 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Weighted Enrolled</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.weightedEnrolled || '12'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'weightedEnrolled', e.target.value)}
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Cohort Weighted Rate</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white font-medium" 
                                                        value={formatCurrency((parseFloat(additionalAim.weightedRate) || 0) * (parseFloat(additionalAim.weightedEnrolled) || 0))} 
                                                        readOnly 
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Additional Tailored Aim Fields */}
                                        {additionalAim.additionalAimType === 'Tailored' && (
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-600">Tailored Learning rate (£6-£10)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.tailoredLearningRate || '10'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'tailoredLearningRate', e.target.value)}
                                                        min="6"
                                                        max="10"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">TL Aim funding</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100"
                                                        value={formatCurrency(
                                                            (parseFloat(additionalAim.tailoredLearningRate) || 0) *
                                                            (parseFloat(additionalAim.glh) || 0)
                                                        )}
                                                        readOnly
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Actually enrolled</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        value={additionalAim.actuallyEnrolled !== undefined ? additionalAim.actuallyEnrolled : '12'}
                                                        onChange={(e) => handleAdditionalAimChange(additionalAim.id, 'actuallyEnrolled', e.target.value)}
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">TL funding</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white font-medium"
                                                        value={formatCurrency(
                                                            (parseFloat(additionalAim.tailoredLearningRate) || 0) *
                                                            (parseFloat(additionalAim.glh) || 0) *
                                                            (parseFloat(additionalAim.actuallyEnrolled) || 0)
                                                        )}
                                                        readOnly
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}

                    <div className="mt-4 border-t border-gray-200 pt-4">
                        <label className="block text-xs font-bold text-gray-700 mb-2">Sessions</label>
                        {aim.sessions.map((session, sIndex) => (
                             <div key={sIndex} className="p-3 border border-gray-300 rounded-md bg-white mb-3 relative">
                                {aim.sessions.length > 1 && (
                                     <button 
                                        type="button"
                                        onClick={() => handleRemoveAimSession('tailored', aim.id, sIndex)}
                                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                     >
                                        <FiTrash />
                                     </button>
                                )}
                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Session</h5>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                    <div>
                                        <label className={labelClass}>Start Time</label>
                                        <TimePicker className={inputClass} value={session.startTime} onChange={val => handleAimSessionChange('tailored', aim.id, sIndex, 'startTime', val)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>End Time</label>
                                        <TimePicker className={inputClass} value={session.endTime} onChange={val => handleAimSessionChange('tailored', aim.id, sIndex, 'endTime', val)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Day (First Session Date)</label>
                                        <input type="date" className={inputClass} value={session.date} onChange={e => handleAimSessionChange('tailored', aim.id, sIndex, 'date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>End Date</label>
                                        <input type="date" className={inputClass} value={session.endDate} onChange={e => handleAimSessionChange('tailored', aim.id, sIndex, 'endDate', e.target.value)} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Tutor</label>
                                        <select className={inputClass} value={session.tutor} onChange={e => handleAimSessionChange('tailored', aim.id, sIndex, 'tutor', e.target.value)}>
                                            <option value="">Select Tutor</option>
                                            {options.tutors.map(t => (
                                                <option key={t['Tutor name']} value={t['Tutor name']}>{t['Tutor name']}</option>
                                            ))}
                                        </select>
                                     </div>
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Day Details</label>
                                        <input 
                                            type="text" 
                                            className={`${inputClass} bg-gray-100`} 
                                            value={session.date && !isNaN(new Date(session.date)) ? format(new Date(session.date), 'EEEE') : ''} 
                                            readOnly 
                                        />
                                     </div>
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Room (Available only)</label>
                                        <select className={inputClass} value={session.room} onChange={e => handleAimSessionChange('tailored', aim.id, sIndex, 'room', e.target.value)}>
                                            <option value="">Select Room</option>
                                            {[
                                              { id: 'NR', room_number: 'NR', capacity: '' },
                                              ...((session.availableRooms !== null ? session.availableRooms : options.rooms) || [])
                                            ].map(r => (
                                                <option key={r.id ?? r.room_number} value={r.room_number}>
                                                  {r.room_number === 'NR' ? 'NR' : `${r.room_number} (Cap: ${r.capacity})`}
                                                </option>
                                            ))}
                                            {session.availableRooms !== null && session.availableRooms.length === 0 && (
                                                <option disabled>No rooms available</option>
                                            )}
                                        </select>
                                     </div>
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Number of Weeks</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={formData['Course No of Weeks']} readOnly />
                                     </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>Tutor Subject</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={session.tutorSubject} readOnly />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>Availability</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={session.tutorAvailability} readOnly />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>Capacity</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={session.roomCapacity} readOnly />
                                    </div>
                                     <div className="md:col-span-1">
                                        <label className={labelClass}>Total Aim's Hours</label>
                                        <input type="text" className={`${inputClass} bg-gray-100`} value={getTotalAimHours(aim)} readOnly />
                                    </div>
                                </div>
                             </div>
                        ))}
                        {aim.sessions.length < 5 && (
                            <button
                                type="button"
                                onClick={() => handleAddAimSession('tailored', aim.id)}
                                className="flex items-center text-blue-600 font-medium text-xs hover:text-blue-800 mt-2"
                            >
                                <FiPlus className="mr-1" /> Add Session
                            </button>
                        )}
                    </div>
                  </div>
                ))}

                <button 
                  type="button" 
                  onClick={handleAddTailoredAim} 
                  className="text-blue-600 text-sm flex items-center hover:text-blue-800"
                >
                  <FiPlus className="mr-1" /> Add a new Tailored Learning Aim
                </button>
              </div>

              {/* CM Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                <div className="col-span-2">
                  <label className={labelClass}>Curriculum Manager</label>
                  <select className={inputClass} value={formData['Curriculum Manager']} onChange={handleCMChange}>
                    <option value="">Select CM</option>
                    {options.cms.map(c => (
                      <option key={c['CM name']} value={c['CM name']}>{c['CM name']}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Curriculum Area</label>
                  <input type="text" className={`${inputClass} bg-gray-100`} value={formData['Curriculum Area']} readOnly />
                </div>
              </div>
            </div>



             {/* Review Course */}
             <div className={sectionClass}>
              <h3 className={sectionTitleClass}>Review Course</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                 <div>
                   <label className={labelClass}>Hours per Week (Calc)</label>
                   <input type="text" className={`${inputClass} bg-gray-100`} value={formData['No of Hours per Week']} readOnly />
                </div>
                 <div>
                   <label className={labelClass}>Planned Hours (Calc)</label>
                   <input type="text" className={`${inputClass} bg-gray-100`} value={formData['Planned numbers of hours']} readOnly />
                </div>
                 <div>
                   <label className={labelClass}>Total Sessions</label>
                   <input type="text" className={`${inputClass} bg-gray-100`} value={formData['Total number of Sessions']} readOnly />
                </div>
                 <div>
                   <label className={labelClass}>Course No of Weeks</label>
                   <input type="text" className={`${inputClass} bg-gray-100`} value={formData['Course No of Weeks']} readOnly />
                </div>
                 <div>
                  <label className={labelClass}>Mode of Delivery</label>
                  <select className={inputClass} value={formData['Mode of Delivery']} onChange={e => handleChange('Mode of Delivery', e.target.value)}>
                    <option value="Classroom">Classroom</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
                 <div>
                  <label className={labelClass}>Published on webenrol</label>
                  <select className={inputClass} value={formData['Published on webenrol']} onChange={e => handleChange('Published on webenrol', e.target.value)}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                 <div>
                  <label className={labelClass}>BKSB Initial Assessment</label>
                  <select className={inputClass} value={formData['BKSB Initial Assessment']} onChange={e => handleChange('BKSB Initial Assessment', e.target.value)}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                 <label className={labelClass}>ADDITIONAL AIMS</label>
                 <textarea
                   className={`${inputClass} bg-gray-100`}
                   value={getAdditionalAimsSummaryFromLearningAims(learningAims)}
                   readOnly
                   rows={2}
                 />
               </div>
                 <div>
                  <label className={labelClass}>Planned Progression</label>
                   <input type="text" className={inputClass} value={formData['Planned Progression']} onChange={e => handleChange('Planned Progression', e.target.value)} />
                </div>
              </div>

              {/* Financials */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-4 pt-4 border-t border-gray-200">
                  {/* Row 1 */}
                  <div>
                      <label className={labelClass}>Actual Enrolment</label>
                      <input 
                        type="number" 
                        className={inputClass} 
                        value={formData['Actual Enrolment']} 
                        onChange={e => handleChange('Actual Enrolment', e.target.value)} 
                        title="Sum of Base Rate Enrolled + Weighted Rate Enrolled from all Learning Aims"
                      />
                  </div>
                  <div>
                      <label className={labelClass}>Total Base</label>
                      <input 
                        type="text" 
                        className={`${inputClass} bg-gray-100`} 
                        value={formatCurrency(financials.totalBase)} 
                        readOnly 
                        title="Sum of all Cohort Base Rate values from Learning Aims"
                      />
                  </div>
                  <div>
                      <label className={labelClass}>Total Weighted</label>
                      <input 
                        type="text" 
                        className={`${inputClass} bg-gray-100`} 
                        value={formatCurrency(financials.totalWeighted)} 
                        readOnly 
                        title="Sum of all Cohort Weighted Rate values from Learning Aims"
                      />
                  </div>
                  <div>
                      <label className={labelClass}>Total ASF</label>
                      <input type="text" className={`${inputClass} bg-gray-100`} value={formatCurrency(financials.totalBase + financials.totalWeighted)} readOnly title="Total Base + Total Weighted" />
                  </div>
                  <div>
                      <label className={labelClass}>TL funding</label>
                      <input 
                        type="text" 
                        className={`${inputClass} bg-gray-100`} 
                        value={formatCurrency(financials.tlFunding)} 
                        readOnly 
                        title="Sum of all Tailored Aims funding"
                      />
                  </div>
                  <div>
                      <label className={labelClass}>Total fees</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className={inputClass} 
                        value={formData['Full fees']} 
                        onChange={e => handleChange('Full fees', e.target.value)} 
                        placeholder="0"
                      />
                  </div>

                  {/* Row 2 */}
                  <div>
                      <label className={labelClass}>Tutor Rate</label>
                      <input 
                        type="number" 
                        className={inputClass} 
                        value={formData['Tutor Rate']} 
                        onChange={e => handleChange('Tutor Rate', e.target.value)} 
                      />
                  </div>
                  <div>
                      <label className={labelClass}>Tutors Cost</label>
                       <input 
                         type="text" 
                         className={`${inputClass} bg-gray-100`} 
                         value={formatCurrency(financials.tutorsCost)} 
                         readOnly 
                         title="(Planned Hours * Tutor Rate) - Dates with no sessions value"
                       />
                  </div>
                  <div>
                      <label className={labelClass}>Extra costs</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className={inputClass} 
                        value={formData['Extra costs']} 
                        onChange={e => handleChange('Extra costs', e.target.value)} 
                        placeholder="0"
                      />
                  </div>
                  <div>
                      <label className={labelClass}>Total costs</label>
                      <input type="text" className={`${inputClass} bg-gray-100`} value={formatCurrency(financials.totalCosts)} readOnly />
                  </div>
                   <div>
                      <label className={labelClass}>Total incomes</label>
                      <input type="text" className={`${inputClass} bg-gray-100`} value={formatCurrency(financials.totalIncomes)} readOnly />
                  </div>
                   <div>
                      <label className={labelClass}>GP%</label>
                       <input type="text" className={`${inputClass} bg-gray-100`} value={financials.gpPercent ? financials.gpPercent.toFixed(2) + '%' : '0.00%'} readOnly />
                  </div>
              </div>
              
              <div className="mt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <label className={labelClass}>Dates with no sessions</label>
                    <button type="button" onClick={openHolidayModal} className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                      Import holidays
                    </button>
                    <a
                      href="https://haringey.gov.uk/schools-learning/schools/school-term-dates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                    >
                      School term dates <FiExternalLink className="ml-1" />
                    </a>
                  </div>
                  <div className="space-y-2">
                      {noSessionDates.map((date, index) => (
                          <div key={index} className="flex items-center gap-2">
                              <input 
                                type="date" 
                                className={inputClass} 
                                value={date} 
                                onChange={e => handleNoSessionDateChange(index, e.target.value)} 
                              />
                              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                                <span className="text-xs font-medium text-gray-600">Hours</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  className="w-20 px-2 py-1 border border-gray-300 rounded bg-white text-sm"
                                  value={noSessionHours[index] ?? getHoursForDate(date)}
                                  onChange={e => handleNoSessionHoursChange(index, e.target.value)}
                                />
                              </div>
                              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                                <span className="text-xs font-medium text-gray-600">(£)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded bg-white text-sm"
                                  value={noSessionValues[index] || '0'}
                                  onChange={e => handleNoSessionValueChange(index, e.target.value)}
                                />
                              </div>
                              {noSessionDates.length > 1 && (
                                  <button type="button" onClick={() => handleRemoveNoSessionDate(index)} className="text-red-500"><FiTrash /></button>
                              )}
                          </div>
                      ))}
                      <div className="flex justify-between items-center mt-2">
                          <button type="button" onClick={handleAddNoSessionDate} className="text-blue-600 text-sm flex items-center">
                              <FiPlus className="mr-1" /> Add another date
                          </button>
                          <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded border border-green-200">
                             <label className="text-sm font-semibold text-green-800">Total Days Value:</label>
                             <span className="text-sm font-bold text-green-700">
                               £{noSessionValues.reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(2)}
                             </span>
                          </div>
                      </div>
                  </div>
              </div>
            </div>

            {/* Status, Deadline & Comments Section */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>Status & Comments</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className={labelClass}>Status</label>
                    <select 
                      className={inputClass} 
                      value={formData['Status']} 
                      onChange={e => handleChange('Status', e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Not started">Not started</option>
                      <option value="Planned">Planned</option>
                      <option value="Live">Live</option>
                      <option value="Incomplete">Incomplete</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Errors">Errors</option>
                      <option value="Ended">Ended</option>
                      <option value="Completed">Completed</option>
                      <option value="Closed">Closed</option>
                    </select>
                 </div>
                 <div>
                    <label className={labelClass}>Deadline</label>
                    <input 
                      type="date" 
                      className={inputClass} 
                      value={formData['Deadline']} 
                      onChange={e => handleChange('Deadline', e.target.value)} 
                    />
                 </div>
              </div>

              <div className="mb-4">
                  <label className={labelClass}>Previous Comments</label>
                  <textarea
                    className={`${inputClass} min-h-[80px] bg-gray-50`}
                    rows={3}
                    value={formData['Comments']}
                    readOnly
                    placeholder="No previous comments..."
                  />
              </div>

              <div className="space-y-4">
                  <label className={labelClass}>Add New Comments</label>
                  {newComments.map((comment, index) => (
                      <div key={index} className="flex gap-2">
                          <textarea
                              className={`${inputClass} min-h-[60px]`}
                              rows={2}
                              value={comment}
                              onChange={e => handleNewCommentChange(index, e.target.value)}
                              placeholder="Enter new comment..."
                          />
                          {newComments.length > 1 && (
                               <button type="button" onClick={() => removeNewCommentBox(index)} className="text-red-500 self-center"><FiTrash /></button>
                          )}
                      </div>
                  ))}
                  <button type="button" onClick={addNewCommentBox} className="text-blue-600 text-sm flex items-center mt-2">
                      <FiPlus className="mr-1" /> Add comment
                  </button>
              </div>
            </div>

            {/* Scrollable Text Areas */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>Course Details</h3>
              <div className="grid grid-cols-1 gap-4">
                {[
                  'Learning objective 1',
                  'Learning objective 2',
                  'Learning objective 3',
                  'Learning objective 4',
                  'Learning objective 5',
                  'Single sentence description',
                  'What is the course about?',
                  'Who is the course for?',
                  'Are there any entry requirements?',
                  'Do I need to have an interview before I can enrol?',
                  'How will I be taught?',
                  'What feedback will I get?',
                  'How will I be able to give my views on the course?',
                  'What course can I do next?',
                  'Additional Information',
                  'Assessment methods',
                  'Equipment required'
                ].map(field => (
                  <div key={field}>
                    <label className={labelClass}>{field}</label>
                    <textarea
                      className={`${inputClass} min-h-[80px]`}
                      rows={3}
                      value={formData[field]}
                      onChange={e => handleChange(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {loading ? 'Saving...' : <><FiSave className="mr-2" /> {initialData && !initialData.isDuplicate ? 'Update Course' : 'Create Course'}</>}
          </button>
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl border-l-4 border-red-500">
                <h3 className="text-lg font-bold text-red-600 mb-2">Important</h3>
                <p className="text-gray-700 mb-4">{errorMessage}</p>
                <button 
                    onClick={() => setShowErrorModal(false)}
                    className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 transition font-medium"
                >
                    Close
                </button>
            </div>
        </div>
      )}

      {showHolidayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Import holidays</h3>
              <button type="button" onClick={() => setShowHolidayModal(false)} className="text-gray-500 hover:text-gray-700">
                <FiX size={22} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {holidaysLoading ? (
                <div className="py-8 text-center text-sm text-gray-600">Loading holidays...</div>
              ) : holidays.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-600">No holiday dates found.</div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {holidays.map((holiday, index) => {
                        const normalizedHolidayDate = normalizeDateToYMD(holiday.Date);
                        const holidayDateObj = normalizedHolidayDate ? parseISO(normalizedHolidayDate) : null;
                        const dayName = holidayDateObj && isValid(holidayDateObj) ? format(holidayDateObj, 'EEE') : '';
                        return (
                          <tr key={`${holiday.Date}-${index}`} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedHolidayDates.includes(normalizedHolidayDate)}
                                onChange={() => toggleHolidayDate(holiday.Date)}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-700">{dayName}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{holiday.Date}</td>
                            <td className="px-3 py-2">{holiday.Description}</td>
                            <td className="px-3 py-2">{holiday.Term}</td>
                            <td className="px-3 py-2">{holiday['Academic Year']}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowHolidayModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={confirmHolidayDates} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                Add selected dates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewCourseModal;
