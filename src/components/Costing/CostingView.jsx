import React, { useState, useEffect } from 'react';
import { FiSave, FiCopy, FiPlus, FiTrash2 } from 'react-icons/fi';
import { Toaster, toast } from 'react-hot-toast';

const CostingView = () => {
  // --- State ---
  
  // 1. Learners & Hours
  const [numLearners, setNumLearners] = useState(12);
  const [plannedHours, setPlannedHours] = useState('');
  const [courseHourlyRate, setCourseHourlyRate] = useState(5);
  
  // 2. Individual Costs
  const [regFee, setRegFee] = useState('');
  const [examFee, setExamFee] = useState('');
  const [certFee, setCertFee] = useState('');
  const [resitCost, setResitCost] = useState('');
  const [resourcesCost, setResourcesCost] = useState(50);

  // 3. Management
  const [accreditationFee, setAccreditationFee] = useState('');
  const [travelCost, setTravelCost] = useState('');
  const [tutorResitCost, setTutorResitCost] = useState('');

  // 4. Extra Costs
  const [extraCosts, setExtraCosts] = useState([]); // { id, name, amount }
  const [newCostName, setNewCostName] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [roomBookingCost, setRoomBookingCost] = useState('');
  const [facilitiesCost, setFacilitiesCost] = useState('');

  // 5. Printing (Student)
  const [printStudents, setPrintStudents] = useState('');
  const [dailyPages, setDailyPages] = useState('');
  const [numLessons, setNumLessons] = useState('');
  const [bwCostPage, setBwCostPage] = useState(0.10);
  const [colCostPage, setColCostPage] = useState(0.20);

  // 6. Printing (Teacher)
  const [numTeachers, setNumTeachers] = useState('');
  const [lessonsPerWeek, setLessonsPerWeek] = useState('');
  const [academicWeeks, setAcademicWeeks] = useState(33);
  const [avgDailyBWCost, setAvgDailyBWCost] = useState(''); // Treated as "Average Cost per Lesson/Unit" based on context
  const [avgDailyColCost, setAvgDailyColCost] = useState('');

  // --- Effects ---

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('costingData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setNumLearners(parsed.numLearners ?? 12);
        setPlannedHours(parsed.plannedHours ?? '');
        setCourseHourlyRate(parsed.courseHourlyRate ?? 5);
        setRegFee(parsed.regFee ?? '');
        setExamFee(parsed.examFee ?? '');
        setCertFee(parsed.certFee ?? '');
        setResitCost(parsed.resitCost ?? '');
        setResourcesCost(parsed.resourcesCost ?? 50);
        setAccreditationFee(parsed.accreditationFee ?? '');
        setTravelCost(parsed.travelCost ?? '');
        setTutorResitCost(parsed.tutorResitCost ?? '');
        setExtraCosts(parsed.extraCosts ?? []);
        setRoomBookingCost(parsed.roomBookingCost ?? '');
        setFacilitiesCost(parsed.facilitiesCost ?? '');
        setPrintStudents(parsed.printStudents ?? '');
        setDailyPages(parsed.dailyPages ?? '');
        setNumLessons(parsed.numLessons ?? '');
        setBwCostPage(parsed.bwCostPage ?? 0.10);
        setColCostPage(parsed.colCostPage ?? 0.20);
        setNumTeachers(parsed.numTeachers ?? '');
        setLessonsPerWeek(parsed.lessonsPerWeek ?? '');
        setAcademicWeeks(parsed.academicWeeks ?? 33);
        setAvgDailyBWCost(parsed.avgDailyBWCost ?? '');
        setAvgDailyColCost(parsed.avgDailyColCost ?? '');
      } catch (e) {
        console.error("Failed to parse saved costing data", e);
      }
    }
  }, []);

  // --- Calculations ---

  const parse = (val) => parseFloat(val) || 0;

  // Course H. Rate cost
  const courseHourlyRateCost = parse(plannedHours) * parse(courseHourlyRate);

  // Individual learner cost
  const individualLearnerCost = parse(regFee) + parse(examFee) + parse(certFee) + parse(resitCost) + parse(resourcesCost);

  // Partial cost
  const partialCost = individualLearnerCost * parse(numLearners);

  // Management cost (20% of Sum)
  // Sum = Course H. Rate cost + Partial cost + Accreditation + Travel + Tutor resit
  const managementBaseSum = courseHourlyRateCost + partialCost + parse(accreditationFee) + parse(travelCost) + parse(tutorResitCost);
  const managementCost = managementBaseSum * 0.20;

  // Total Extra Cost
  // Sum of dynamic extra costs
  const totalDynamicExtra = extraCosts.reduce((acc, curr) => acc + parse(curr.amount), 0);
  // Formula: Course H. Rate + Partial + Management + Room + Facilities + DynamicExtras
  const totalExtraCost = courseHourlyRateCost + partialCost + managementCost + parse(roomBookingCost) + parse(facilitiesCost) + totalDynamicExtra;

  // Printing - Student
  const totalStudentBW = parse(printStudents) * parse(dailyPages) * parse(numLessons) * parse(bwCostPage);
  const totalStudentCol = parse(printStudents) * parse(dailyPages) * parse(numLessons) * parse(colCostPage);

  // Printing - Teacher
  // Forecasted = Teachers * (Lessons/Week * Weeks) * AvgCost
  const totalTeacherLessons = parse(lessonsPerWeek) * parse(academicWeeks);
  const forecastedTeacherBW = parse(numTeachers) * totalTeacherLessons * parse(avgDailyBWCost);
  const forecastedTeacherCol = parse(numTeachers) * totalTeacherLessons * parse(avgDailyColCost);

  // --- Handlers ---

  const handleSave = () => {
    const dataToSave = {
      numLearners, plannedHours, courseHourlyRate,
      regFee, examFee, certFee, resitCost, resourcesCost,
      accreditationFee, travelCost, tutorResitCost,
      extraCosts, roomBookingCost, facilitiesCost,
      printStudents, dailyPages, numLessons, bwCostPage, colCostPage,
      numTeachers, lessonsPerWeek, academicWeeks, avgDailyBWCost, avgDailyColCost
    };
    localStorage.setItem('costingData', JSON.stringify(dataToSave));
    toast.success('Costing data saved locally!');
  };

  const handleAddExtraCost = () => {
    if (!newCostName || !newCostAmount) return;
    const newCost = {
      id: Date.now(),
      name: newCostName,
      amount: newCostAmount
    };
    setExtraCosts([...extraCosts, newCost]);
    setNewCostName('');
    setNewCostAmount('');
  };

  const handleRemoveExtraCost = (id) => {
    setExtraCosts(extraCosts.filter(c => c.id !== id));
  };

  const copyToClipboard = (val) => {
    navigator.clipboard.writeText(formatCurrency(val));
    toast.success('Copied to clipboard');
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val);
  };

  const SectionTitle = ({ children }) => (
    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4 mt-6">{children}</h3>
  );

  const InputRow = ({ label, value, onChange, type = "number", placeholder = "0", prefix = "£" }) => (
    <div className="flex items-center justify-between mb-2">
      <label className="text-sm font-medium text-gray-700 w-1/2">{label}</label>
      <div className="relative w-1/2">
        {prefix && <span className="absolute left-3 top-2 text-gray-500 text-sm">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-gray-300 rounded-md p-1.5 text-right focus:ring-blue-500 focus:border-blue-500 ${prefix ? 'pl-7' : ''}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );

  const ResultRow = ({ label, value, isTotal = false, onCopy }) => (
    <div className={`flex items-center justify-between mb-2 ${isTotal ? 'bg-blue-50 p-2 rounded-lg' : ''}`}>
      <label className={`text-sm ${isTotal ? 'font-bold text-blue-900' : 'font-medium text-gray-700'} w-1/2`}>
        {label}
      </label>
      <div className="w-1/2 flex justify-end items-center gap-2">
        <span className={`${isTotal ? 'text-lg font-bold text-blue-700' : 'font-medium text-gray-900'}`}>
          {formatCurrency(value)}
        </span>
        {onCopy && (
            <button 
                onClick={() => onCopy(value)}
                className={`p-1 rounded hover:bg-gray-100 transition-colors ${isTotal ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-400 hover:text-blue-600'}`}
                title="Copy"
            >
                <FiCopy className="h-4 w-4" />
            </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Toaster position="top-right" />
      
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Costing Calculator</h1>
          <button
            onClick={handleSave}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <FiSave className="mr-2" />
            Save (Local)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1: Course Costs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="w-2 h-8 bg-blue-500 rounded-full mr-3"></span>
              Course Costing
            </h2>

            {/* Learners & Hours */}
            <SectionTitle>Learners & Hours</SectionTitle>
            <InputRow label="Number of Learners" value={numLearners} onChange={setNumLearners} prefix="" />
            <InputRow label="Planned Hours" value={plannedHours} onChange={setPlannedHours} prefix="" />
            <InputRow label="Course H. Rate" value={courseHourlyRate} onChange={setCourseHourlyRate} />
            <ResultRow label="Course H. Rate Cost" value={courseHourlyRateCost} isTotal />

            {/* Individual Costs */}
            <SectionTitle>Individual Costs</SectionTitle>
            <InputRow label="Registration Fee" value={regFee} onChange={setRegFee} />
            <InputRow label="Exam Fee" value={examFee} onChange={setExamFee} />
            <InputRow label="Certification Fee" value={certFee} onChange={setCertFee} />
            <InputRow label="Resit Costs" value={resitCost} onChange={setResitCost} />
            <InputRow label="Resources Costs" value={resourcesCost} onChange={setResourcesCost} />
            
            <div className="mt-4 pt-4 border-t border-dashed">
                <ResultRow label="Individual Learner Cost" value={individualLearnerCost} />
                <ResultRow label="Partial Cost (x Learners)" value={partialCost} isTotal />
            </div>

            {/* Management Section */}
            <SectionTitle>Management Section</SectionTitle>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <div className="flex justify-between mb-1">
                    <span>Course H. Rate Cost:</span>
                    <span className="font-medium">{formatCurrency(courseHourlyRateCost)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Partial Cost:</span>
                    <span className="font-medium">{formatCurrency(partialCost)}</span>
                </div>
            </div>
            
            <InputRow label="Accreditation Fee" value={accreditationFee} onChange={setAccreditationFee} />
            <InputRow label="Travel Costs" value={travelCost} onChange={setTravelCost} />
            <InputRow label="Tutor Resit Cost" value={tutorResitCost} onChange={setTutorResitCost} />
            
            <ResultRow label="Management Cost (20%)" value={managementCost} isTotal />

            {/* Total Extra Cost Section */}
            <SectionTitle>Total Extra Cost</SectionTitle>
            
            {/* Dynamic Costs List */}
            <div className="space-y-2 mb-4">
                {extraCosts.map(cost => (
                    <div key={cost.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                        <span>{cost.name}</span>
                        <div className="flex items-center">
                            <span className="font-medium mr-3">{formatCurrency(parse(cost.amount))}</span>
                            <button onClick={() => handleRemoveExtraCost(cost.id)} className="text-red-500 hover:text-red-700">
                                <FiTrash2 />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Cost Input */}
            <div className="flex gap-2 mb-4">
                <input 
                    type="text" 
                    placeholder="Cost Name" 
                    className="flex-1 border rounded p-1.5 text-sm"
                    value={newCostName}
                    onChange={e => setNewCostName(e.target.value)}
                />
                <input 
                    type="number" 
                    placeholder="Amount" 
                    className="w-24 border rounded p-1.5 text-sm"
                    value={newCostAmount}
                    onChange={e => setNewCostAmount(e.target.value)}
                />
                <button 
                    onClick={handleAddExtraCost}
                    className="bg-green-100 text-green-700 p-2 rounded hover:bg-green-200"
                >
                    <FiPlus />
                </button>
            </div>

            <InputRow label="Room Booking Cost" value={roomBookingCost} onChange={setRoomBookingCost} />
            <InputRow label="Facilities Costs" value={facilitiesCost} onChange={setFacilitiesCost} />

            <div className="mt-6 p-4 bg-blue-600 text-white rounded-xl shadow-lg flex justify-between items-center">
                <div>
                    <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Total Extra Cost</p>
                    <p className="text-3xl font-bold">{formatCurrency(totalExtraCost)}</p>
                </div>
                <button 
                    onClick={() => copyToClipboard(totalExtraCost)}
                    className="p-2 bg-blue-500 rounded-lg hover:bg-blue-400 transition-colors"
                    title="Copy Total"
                >
                    <FiCopy className="h-6 w-6" />
                </button>
            </div>

          </div>

          {/* Column 2: Printing Costs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="w-2 h-8 bg-purple-500 rounded-full mr-3"></span>
              Printing Costs
            </h2>

            {/* Student Printing */}
            <SectionTitle>Student Printing</SectionTitle>
            <InputRow label="Number of Students" value={printStudents} onChange={setPrintStudents} prefix="" />
            <InputRow label="Daily Pages Needed" value={dailyPages} onChange={setDailyPages} prefix="" />
            <InputRow label="Number of Lessons" value={numLessons} onChange={setNumLessons} prefix="" />
            <InputRow label="B/W Cost per Page" value={bwCostPage} onChange={setBwCostPage} />
            <InputRow label="Colour Cost per Page" value={colCostPage} onChange={setColCostPage} />

            <div className="mt-4 pt-4 border-t border-dashed">
                <ResultRow label="Total B/W Cost" value={totalStudentBW} onCopy={copyToClipboard} />
                <ResultRow label="Total Colour Cost" value={totalStudentCol} onCopy={copyToClipboard} />
            </div>

            {/* Annual Teacher Printing */}
            <SectionTitle>Annual Teacher Printing</SectionTitle>
            <InputRow label="Number of Teachers" value={numTeachers} onChange={setNumTeachers} prefix="" />
            <InputRow label="Lessons per Week" value={lessonsPerWeek} onChange={setLessonsPerWeek} prefix="" />
            <InputRow label="Academic Year Weeks" value={academicWeeks} onChange={setAcademicWeeks} prefix="" />
            <InputRow label="Avg. Daily B/W Cost" value={avgDailyBWCost} onChange={setAvgDailyBWCost} />
            <InputRow label="Avg. Daily Colour Cost" value={avgDailyColCost} onChange={setAvgDailyColCost} />

            <div className="mt-6 p-4 bg-purple-600 text-white rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-purple-100 text-sm font-medium uppercase tracking-wider">Forecasted B/W Cost</p>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">{formatCurrency(forecastedTeacherBW)}</p>
                        <button 
                            onClick={() => copyToClipboard(forecastedTeacherBW)}
                            className="p-1.5 bg-purple-500 rounded-lg hover:bg-purple-400 transition-colors text-white"
                            title="Copy"
                        >
                            <FiCopy className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                <div className="border-t border-purple-500 my-2"></div>
                <div className="flex justify-between items-center">
                    <p className="text-purple-100 text-sm font-medium uppercase tracking-wider">Forecasted Colour Cost</p>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">{formatCurrency(forecastedTeacherCol)}</p>
                        <button 
                            onClick={() => copyToClipboard(forecastedTeacherCol)}
                            className="p-1.5 bg-purple-500 rounded-lg hover:bg-purple-400 transition-colors text-white"
                            title="Copy"
                        >
                            <FiCopy className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default CostingView;
