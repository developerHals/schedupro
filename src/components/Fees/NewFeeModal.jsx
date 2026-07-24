import React, { useState, useEffect } from 'react';
import { dataService } from '../../lib/dataService';
import { FiX, FiPlus, FiTrash2, FiSave } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const NewFeeModal = ({ onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  
  // Course Level Inputs
  const [courseIdInput, setCourseIdInput] = useState('');
  const [courseName, setCourseName] = useState('');
  const [concessionStudents, setConcessionStudents] = useState(0);
  const [fullFeeStudents, setFullFeeStudents] = useState(0);
  const [baseStudents, setBaseStudents] = useState(0);
  const [weightedStudents, setWeightedStudents] = useState(0);
  
  // Aims
  const [aims, setAims] = useState([]);

  // Course Level Costs
  const [tutorResitCost, setTutorResitCost] = useState(0);
  const [roomBookingCost, setRoomBookingCost] = useState(0);
  const [facilitiesCost, setFacilitiesCost] = useState(0);
  const [tutorsHourlyRate, setTutorsHourlyRate] = useState(35);
  const [minStudents, setMinStudents] = useState(10);
  
  // Fee Inputs
  const [aFullFeePP, setAFullFeePP] = useState(0);
  const [sConcessionFeePP, setSConcessionFeePP] = useState(0);
  const [aConcessionFeePP, setAConcessionFeePP] = useState(0);

  // Data Sources
  const [learningAimsData, setLearningAimsData] = useState([]);
  const [tailoredAimsData, setTailoredAimsData] = useState([]);
  const [courseSpecificAims, setCourseSpecificAims] = useState([]);

  useEffect(() => {
    fetchLearningAims();
    fetchTailoredAims();
  }, []);

  const fetchLearningAims = async () => {
    const { data, error } = await dataService.from('Learning Aims').select('*');
    if (!error && data) setLearningAimsData(data);
  };

  const fetchTailoredAims = async () => {
    const { data, error } = await dataService.from('Tailored learning Aims').select('*');
    if (!error && data) setTailoredAimsData(data);
  };

  const fetchCourseDetails = async (id) => {
    if (!id) {
      setCourseName('');
      setCourseSpecificAims([]);
      return;
    }
    
    // Fetch all rows for this course ID from Courses table
    const { data, error } = await dataService
      .from('Courses')
      .select('*')
      .eq('Course ID', id);
    
    if (data && data.length > 0) {
      // 1. Set Course Name from the first record found
      const firstRecord = data[0];
      setCourseName(firstRecord['Course Name'] || firstRecord['Course Title'] || '');
      
      // 2. Extract unique aims associated with this course
      const extractedAims = [];
      const seenCodes = new Set();
      
      data.forEach(row => {
        const aimCode = row['AIMs'];
        if (aimCode && !seenCodes.has(aimCode)) {
          seenCodes.add(aimCode);
          
          // Try to find the aim title in the master list
          const masterAim = learningAimsData.find(la => la.Code === aimCode || la['Aim Ref'] === aimCode);
          
          extractedAims.push({
            Code: aimCode,
            'Aim Ref': aimCode,
            'Learning Aim': masterAim?.['Learning Aim'] || masterAim?.['Aim Title'] || '',
            'Aim Title': masterAim?.['Aim Title'] || masterAim?.['Learning Aim'] || '',
            'Awarding Body': row['Awarding Body'],
            'GLH': row['GLH (Awarding Body)'],
            'Base Rate': row['Base (unweighted rate)'],
            'Weighted Rate': row['Full (weighted rate)']
          });
        }
      });
      
      setCourseSpecificAims(extractedAims);
    } else {
      setCourseName('');
      setCourseSpecificAims([]);
    }
  };

  const handleCourseIdBlur = () => {
    fetchCourseDetails(courseIdInput);
  };

  const addAim = (type) => {
    setAims([...aims, {
      id: crypto.randomUUID(),
      type, // 'standard' or 'tailored'
      code: '',
      title: '',
      awardingBody: '',
      glh: 0,
      baseRate: 0,
      weightedRate: 0,
      tlFunding: 0,
      plannedHours: 0,
      resourcesCost: 50,
      courseHourlyRate: 0, // Calculated
      
      // New fee fields
      registrationFee: 0,
      examFee: 0,
      certificationFee: 0,
      resitCosts: 0,
      
      // New v2 fields
      accreditationFee: 0,
    }]);
  };

  const removeAim = (id) => {
    setAims(aims.filter(a => a.id !== id));
  };

  const updateAim = (id, field, value) => {
    setAims(aims.map(a => {
      if (a.id !== id) return a;
      const newAim = { ...a, [field]: value };
      
      // Auto-populate based on code selection
      if (field === 'code') {
        if (a.type === 'standard') {
          // Check course specific aims first
          let found = courseSpecificAims.find(la => la.Code === value || la['Aim Ref'] === value);
          
          if (found) {
             let title = found['Learning Aim'] || found['Aim Title'] || found['Title'] || '';
             // If title is missing (e.g. from courseSpecificAims), try fallback to master list
             if (!title) {
                const master = learningAimsData.find(la => la.Code === value || la['Aim Ref'] === value);
                if (master) {
                    title = master['Learning Aim'] || master['Aim Title'] || master['Title'] || '';
                    // Also fill in other missing details if needed
                    if (!found['Awarding Body']) newAim.awardingBody = master['Awarding Body'] || '';
                    if (!found.GLH) newAim.glh = parseFloat(master.GLH || 0);
                    if (!found['Base Rate']) newAim.baseRate = parseFloat(master['Base Rate'] || 0);
                    if (!found['Weighted Rate']) newAim.weightedRate = parseFloat(master['Weighted Rate'] || 0);
                }
             }

             newAim.title = title;
             newAim.awardingBody = found['Awarding Body'] || newAim.awardingBody || '';
             newAim.glh = parseFloat(found.GLH || found.glh || newAim.glh || 0);
             newAim.baseRate = parseFloat(found['Base Rate'] || found.baseRate || newAim.baseRate || 0);
             newAim.weightedRate = parseFloat(found['Weighted Rate'] || found.weightedRate || newAim.weightedRate || 0);
          } else {
             // Fallback to master list
             found = learningAimsData.find(la => la.Code === value || la['Aim Ref'] === value);
             if (found) {
               newAim.title = found['Learning Aim'] || found['Aim Title'] || found['Title'] || '';
               newAim.awardingBody = found['Awarding Body'] || '';
               newAim.glh = parseFloat(found.GLH || 0);
               newAim.baseRate = parseFloat(found['Base Rate'] || 0);
               newAim.weightedRate = parseFloat(found['Weighted Rate'] || 0);
             }
          }
        } else {
          const found = tailoredAimsData.find(ta => ta.Code === value);
          if (found) {
            newAim.title = found['Tailored Learning Aims'] || found['Tailored Learning Aim'];
          }
        }
      }

      // Auto-calc courseHourlyRate
      if (field === 'plannedHours') {
        newAim.courseHourlyRate = (parseFloat(value) || 0) * 5;
      }

      return newAim;
    }));
  };

  // --- Calculations ---
  const totalStudents = (parseInt(concessionStudents) || 0) + (parseInt(fullFeeStudents) || 0);

  // Total Individual Cost (Sum of all aims)
  let sumTotalIndividualCost = 0;
  let sumTotalAimCost = 0;
  
  aims.forEach(aim => {
    const totalIndividualCostPP = 
      (parseFloat(aim.registrationFee) || 0) + 
      (parseFloat(aim.examFee) || 0) + 
      (parseFloat(aim.certificationFee) || 0) + 
      (parseFloat(aim.resitCosts) || 0) + 
      (parseFloat(aim.resourcesCost) || 0);
      
    const totalIndividualCost = (totalIndividualCostPP * totalStudents) + (parseFloat(aim.courseHourlyRate) || 0);
    sumTotalIndividualCost += totalIndividualCost;
    
    const totalAimCost = totalIndividualCost + (parseFloat(aim.accreditationFee) || 0);
    sumTotalAimCost += totalAimCost;
  });

  // Management Cost
  // "Above the Management Cost (20%), instead the Total individual cost (£), you need to calculate the Totals Aims Final Cost"
  // Assuming management cost is based on the new total aim cost sum plus tutor resit cost
  const managementCost = 0.2 * ((parseFloat(tutorResitCost) || 0) + sumTotalAimCost);

  // Other Costs
  const otherCosts = sumTotalAimCost + (parseFloat(tutorResitCost) || 0) + managementCost + (parseFloat(roomBookingCost) || 0) + (parseFloat(facilitiesCost) || 0);

  // Tutors Cost
  const totalPlannedHours = aims.reduce((sum, aim) => sum + (parseFloat(aim.plannedHours) || 0), 0);
  const tutorsCost = totalPlannedHours * (parseFloat(tutorsHourlyRate) || 0);

  // Total Costs
  const totalCosts = tutorsCost + otherCosts;

  // Unit Costs
  const unitCosts = totalStudents > 0 ? totalCosts / totalStudents : 0;

  // S. full fee pp
  const sFullFeePP = (parseInt(minStudents) || 1) > 0 ? totalCosts / (parseInt(minStudents) || 1) : 0;

  // Update S. Concession Fee PP when S. Full Fee PP changes (30% of S. Full Fee PP)
  useEffect(() => {
    const calculatedSConcession = (parseFloat(sFullFeePP) || 0) * 0.30;
    setSConcessionFeePP(calculatedSConcession);
  }, [sFullFeePP]);

  // Full fees
  const fullFees = (parseFloat(aFullFeePP) || 0) * (parseInt(fullFeeStudents) || 0);

  // Concession fees
  const concessionFees = (parseFloat(aConcessionFeePP) || 0) * (parseInt(concessionStudents) || 0);

  // Course total fees
  const courseTotalFees = fullFees + concessionFees;

  // Course total funding
  const courseTotalFunding = aims.reduce((sum, aim) => {
    if (aim.type === 'standard') {
      const aimFunding = ((parseInt(baseStudents) || 0) * (parseFloat(aim.baseRate) || 0)) + 
                         ((parseInt(weightedStudents) || 0) * (parseFloat(aim.weightedRate) || 0));
      return sum + aimFunding;
    } else {
      return sum + (parseFloat(aim.tlFunding) || 0);
    }
  }, 0);


  const handleSave = async () => {
    setLoading(true);
    try {
      const submissionGroupId = crypto.randomUUID();
      
      const rowsToInsert = aims.map(aim => ({
        submission_group_id: submissionGroupId,
        course_id: courseIdInput,
        course_name: courseName,
        concession_students: parseInt(concessionStudents) || 0,
        full_fee_students: parseInt(fullFeeStudents) || 0,
        total_students: totalStudents,
        
        aim_type: aim.type,
        aim_code: aim.code,
        aim_title: aim.title,
        awarding_body: aim.awardingBody,
        glh: aim.glh,
        base_rate: aim.baseRate,
        weighted_rate: aim.weightedRate,
        tl_funding: aim.tlFunding,
        
        planned_hours: aim.plannedHours,
        resources_costs: aim.resourcesCost,
        course_hourly_rate: aim.courseHourlyRate,
        
        // Storing the *unit* individual cost or the *total* for this aim?
        // User said "The app will calculate the Total individual cost...".
        // I'll store the calculated total for this aim (unit * students)
        total_individual_cost: (((parseFloat(aim.registrationFee) || 0) + (parseFloat(aim.examFee) || 0) + (parseFloat(aim.certificationFee) || 0) + (parseFloat(aim.resitCosts) || 0) + (parseFloat(aim.resourcesCost) || 0)) * totalStudents) + (parseFloat(aim.courseHourlyRate) || 0),
        
        registration_fee: parseFloat(aim.registrationFee) || 0,
        exam_fee: parseFloat(aim.examFee) || 0,
        certification_fee: parseFloat(aim.certificationFee) || 0,
        resit_costs: parseFloat(aim.resitCosts) || 0,
        
        // New v2 fields
        base_students: parseInt(baseStudents) || 0,
        weighted_students: parseInt(weightedStudents) || 0,
        accreditation_fee: parseFloat(aim.accreditationFee) || 0,

        tutor_resit_cost: parseFloat(tutorResitCost) || 0,
        management_cost: managementCost,
        room_booking_cost: parseFloat(roomBookingCost) || 0,
        facilities_cost: parseFloat(facilitiesCost) || 0,
        other_costs: otherCosts,
        tutors_cost: tutorsCost,
        total_costs: totalCosts,
        unit_costs: unitCosts,
        min_students_number: parseInt(minStudents) || 0,
        s_full_fee_pp: sFullFeePP,
        a_full_fee_pp: parseFloat(aFullFeePP) || 0,
        full_fees: fullFees,
        s_concession_fee_pp: sConcessionFeePP,
        a_concession_fee_pp: parseFloat(aConcessionFeePP) || 0,
        concession_fees: concessionFees,
        course_total_fees: courseTotalFees,
        course_total_funding: courseTotalFunding
      }));

      const { error } = await dataService.from('fees').insert(rowsToInsert);
      if (error) throw error;
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving fees:', error);
      alert('Error saving fees: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">New Fee Calculation</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <SafeIcon icon={FiX} className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Course Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Course Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course ID</label>
                <input
                  type="text"
                  value={courseIdInput}
                  onChange={(e) => setCourseIdInput(e.target.value)}
                  onBlur={handleCourseIdBlur}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Course ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                <input
                  type="text"
                  value={courseName}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concession Students</label>
                <input
                  type="number"
                  value={concessionStudents}
                  onChange={(e) => setConcessionStudents(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Fee Students</label>
                <input
                  type="number"
                  value={fullFeeStudents}
                  onChange={(e) => setFullFeeStudents(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Students</label>
                <input
                  type="number"
                  value={totalStudents}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600 font-bold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Students</label>
                <input
                  type="number"
                  value={baseStudents}
                  onChange={(e) => setBaseStudents(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weighted Students</label>
                <input
                  type="number"
                  value={weightedStudents}
                  onChange={(e) => setWeightedStudents(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Aims Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold text-gray-800">Learning Aims</h3>
              <div className="space-x-2">
                <button
                  onClick={() => addAim('standard')}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors"
                >
                  + Add Learning Aim
                </button>
                <button
                  onClick={() => addAim('tailored')}
                  className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium transition-colors"
                >
                  + Add Tailored Aim
                </button>
              </div>
            </div>

            {aims.map((aim, index) => (
              <div key={aim.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                <button
                  onClick={() => removeAim(aim.id)}
                  className="absolute top-2 right-2 p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                >
                  <SafeIcon icon={FiTrash2} className="h-4 w-4" />
                </button>
                
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                  {aim.type === 'standard' ? 'Standard Learning Aim' : 'Tailored Learning Aim'} #{index + 1}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Aim Ref / Code</label>
                    <input
                      list={`aims-${aim.type}`}
                      value={aim.code}
                      onChange={(e) => updateAim(aim.id, 'code', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Search Code..."
                    />
                    <datalist id={`aims-${aim.type}`}>
                      {aim.type === 'standard' 
                        ? (courseSpecificAims.length > 0 ? courseSpecificAims : learningAimsData).map((item, idx) => (
                             <option key={idx} value={item.Code || item['Aim Ref']}>
                               {item['Aim Title'] || item['Learning Aim'] || item['Awarding Body'] || ''}
                             </option>
                           ))
                        : tailoredAimsData.map(ta => <option key={ta.id} value={ta.Code}>{ta['Tailored Learning Aims']}</option>)
                      }
                    </datalist>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={aim.title}
                      readOnly
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-600 text-sm"
                    />
                  </div>
                </div>

                {aim.type === 'standard' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Awarding Body</label>
                      <input value={aim.awardingBody} readOnly className="w-full px-2 py-1.5 bg-white border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">GLH</label>
                      <input value={aim.glh} readOnly className="w-full px-2 py-1.5 bg-white border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Base Rate</label>
                      <input value={aim.baseRate} readOnly className="w-full px-2 py-1.5 bg-white border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Weighted Rate</label>
                      <input value={aim.weightedRate} readOnly className="w-full px-2 py-1.5 bg-white border rounded text-sm" />
                    </div>
                  </div>
                )}

                {aim.type === 'tailored' && (
                   <div className="grid grid-cols-1 gap-4 mb-4">
                     <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">TL Funding</label>
                        <input 
                          type="number"
                          value={aim.tlFunding} 
                          onChange={(e) => updateAim(aim.id, 'tlFunding', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                        />
                     </div>
                   </div>
                )}

                {/* New Fee Fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pt-4 border-t border-gray-100">
                    <div>
                       <label className="block text-xs font-medium text-gray-500 mb-1">Registration Fee (£)</label>
                       <input 
                         type="number"
                         value={aim.registrationFee} 
                         onChange={(e) => updateAim(aim.id, 'registrationFee', e.target.value)}
                         className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-medium text-gray-500 mb-1">Exam Fee (£)</label>
                       <input 
                         type="number"
                         value={aim.examFee} 
                         onChange={(e) => updateAim(aim.id, 'examFee', e.target.value)}
                         className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-medium text-gray-500 mb-1">Certification Fee (£)</label>
                       <input 
                         type="number"
                         value={aim.certificationFee} 
                         onChange={(e) => updateAim(aim.id, 'certificationFee', e.target.value)}
                         className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-medium text-gray-500 mb-1">Resit Costs (£)</label>
                       <input 
                         type="number"
                         value={aim.resitCosts} 
                         onChange={(e) => updateAim(aim.id, 'resitCosts', e.target.value)}
                         className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                       />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-gray-200 pt-4">
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Planned Hours</label>
                      <input 
                        type="number"
                        value={aim.plannedHours} 
                        onChange={(e) => updateAim(aim.id, 'plannedHours', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Resources Costs (£)</label>
                      <input 
                        type="number"
                        value={aim.resourcesCost} 
                        onChange={(e) => updateAim(aim.id, 'resourcesCost', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Course H. Rate (£)</label>
                      <div className="flex items-center gap-2">
                         <input 
                           type="number"
                           value={aim.courseHourlyRate} 
                           onChange={(e) => updateAim(aim.id, 'courseHourlyRate', e.target.value)}
                           className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                         />
                         <span className="text-xs text-gray-400 whitespace-nowrap">
                           (Sugg: {((parseFloat(aim.plannedHours) || 0) * 5).toFixed(0)})
                         </span>
                      </div>
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Total individual cost pp (£)</label>
                      <input 
                        type="number"
                        value={((parseFloat(aim.registrationFee) || 0) + (parseFloat(aim.examFee) || 0) + (parseFloat(aim.certificationFee) || 0) + (parseFloat(aim.resitCosts) || 0) + (parseFloat(aim.resourcesCost) || 0)).toFixed(2)}
                        readOnly
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600 font-bold" 
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Total individual cost (£)</label>
                      <input 
                        type="number"
                        value={((((parseFloat(aim.registrationFee) || 0) + (parseFloat(aim.examFee) || 0) + (parseFloat(aim.certificationFee) || 0) + (parseFloat(aim.resitCosts) || 0) + (parseFloat(aim.resourcesCost) || 0)) * totalStudents) + (parseFloat(aim.courseHourlyRate) || 0)).toFixed(2)}
                        readOnly
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600 font-bold" 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Accreditation Fee (£)</label>
                      <input 
                        type="number"
                        value={aim.accreditationFee} 
                        onChange={(e) => updateAim(aim.id, 'accreditationFee', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Total Aim cost (£)</label>
                      <input 
                        type="number"
                        value={(((((parseFloat(aim.registrationFee) || 0) + (parseFloat(aim.examFee) || 0) + (parseFloat(aim.certificationFee) || 0) + (parseFloat(aim.resitCosts) || 0) + (parseFloat(aim.resourcesCost) || 0)) * totalStudents) + (parseFloat(aim.courseHourlyRate) || 0)) + (parseFloat(aim.accreditationFee) || 0)).toFixed(2)}
                        readOnly
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600 font-bold" 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Aim funding (£)</label>
                      <input 
                        type="number"
                        value={(((parseInt(baseStudents) || 0) * (parseFloat(aim.baseRate) || 0)) + ((parseInt(weightedStudents) || 0) * (parseFloat(aim.weightedRate) || 0))).toFixed(2)}
                        readOnly
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600 font-bold" 
                      />
                   </div>
                </div>
              </div>
            ))}
          </section>

          {/* Costs & Totals Section */}
          <section className="space-y-6 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800">Costs & Fees Calculation</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tutor Resit Cost</label>
                  <input
                    type="number"
                    value={tutorResitCost}
                    onChange={(e) => setTutorResitCost(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Booking Cost</label>
                  <input
                    type="number"
                    value={roomBookingCost}
                    onChange={(e) => setRoomBookingCost(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facilities Cost</label>
                  <input
                    type="number"
                    value={facilitiesCost}
                    onChange={(e) => setFacilitiesCost(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tutors Hourly Rate (£)</label>
                  <input
                    type="number"
                    value={tutorsHourlyRate}
                    onChange={(e) => setTutorsHourlyRate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                 <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Totals Aims Final Cost</span>
                    <span className="font-bold text-gray-900">£{sumTotalAimCost.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Management Cost (20%)</span>
                    <span className="font-bold text-gray-900">£{managementCost.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Other Costs</span>
                    <span className="font-bold text-gray-900">£{otherCosts.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tutors Cost</span>
                    <span className="font-bold text-gray-900">£{tutorsCost.toFixed(2)}</span>
                 </div>
                 <div className="border-t pt-2 flex justify-between">
                    <span className="text-base font-bold text-gray-800">Total Costs</span>
                    <span className="text-base font-bold text-blue-600">£{totalCosts.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Unit Costs</span>
                    <span className="font-bold text-gray-900">£{unitCosts.toFixed(2)}</span>
                 </div>
              </div>

              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min. Students</label>
                    <input
                      type="number"
                      value={minStudents}
                      onChange={(e) => setMinStudents(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                 </div>
                 
                 <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <label className="block text-sm font-medium text-blue-700 mb-1">S. Full Fee pp</label>
                    <input
                      type="number"
                      value={sFullFeePP.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-blue-100 text-blue-600 mb-2"
                    />
                    <label className="block text-sm font-medium text-blue-700 mb-1">A. Full Fee pp</label>
                    <input
                      type="number"
                      value={aFullFeePP}
                      onChange={(e) => setAFullFeePP(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                 </div>

                 <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <label className="block text-sm font-medium text-purple-700 mb-1">S. Concession pp (30%)</label>
                    <input
                      type="number"
                      value={typeof sConcessionFeePP === 'number' ? sConcessionFeePP.toFixed(2) : sConcessionFeePP}
                      readOnly
                      className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-purple-100 text-purple-600 mb-2"
                    />
                    
                    <label className="block text-sm font-medium text-purple-700 mb-1">A. Concession Fee pp</label>
                    <input
                      type="number"
                      value={aConcessionFeePP}
                      onChange={(e) => setAConcessionFeePP(e.target.value)}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-blue-50 p-6 rounded-xl border border-blue-100">
               <div>
                 <span className="block text-sm text-blue-600 mb-1">Full Fees</span>
                 <span className="text-xl font-bold text-blue-900">£{fullFees.toFixed(2)}</span>
               </div>
               <div>
                 <span className="block text-sm text-blue-600 mb-1">Concession Fees</span>
                 <span className="text-xl font-bold text-blue-900">£{concessionFees.toFixed(2)}</span>
               </div>
               <div>
                 <span className="block text-sm text-blue-600 mb-1">Course Total Fees</span>
                 <span className="text-2xl font-bold text-blue-900">£{courseTotalFees.toFixed(2)}</span>
               </div>
               <div>
                 <span className="block text-sm text-blue-600 mb-1">Course Total Funding</span>
                 <span className="text-2xl font-bold text-green-700">£{courseTotalFunding.toFixed(2)}</span>
               </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
            >
              <SafeIcon icon={FiSave} className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Fee Calculation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewFeeModal;
