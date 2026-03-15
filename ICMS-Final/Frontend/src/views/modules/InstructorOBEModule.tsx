import React, { useState, useEffect } from 'react';
import obeService from '../../api/obeService';

interface Course {
  id: number;
  name: string;
  code: string;
}

interface Assessment {
  id: number;
  title: string;
  assessment_type: string;
  total_marks: number;
  assessment_date: string;
}

interface Props {
  instructorId: number;
}

const InstructorOBEModule: React.FC<Props> = ({ instructorId }) => {
  const [activeTab, setActiveTab] = useState('clos');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [clos, setClos] = useState([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const tabs = [
    { id: 'clos', label: 'Define CLOs' },
    { id: 'assessments', label: 'Assessments' },
    { id: 'results', label: 'Results Entry' },
    { id: 'mapping', label: 'CLO Mapping' }
  ];

  useEffect(() => {
    loadInstructorCourses();
  }, [instructorId]);

  const loadInstructorCourses = async () => {
    // Mock data - replace with actual API call
    setCourses([
      { id: 1, name: 'Programming Fundamentals', code: 'CS101' },
      { id: 2, name: 'Data Structures', code: 'CS201' }
    ]);
  };

  const CLODefinitionForm = () => {
    const [newCLO, setNewCLO] = useState({
      clo_number: 1,
      description: '',
      bloom_level: 'Remember'
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCourse) return;
      
      try {
        await obeService.createCLO({
          ...newCLO,
          course: selectedCourse
        });
        setNewCLO({ clo_number: 1, description: '', bloom_level: 'Remember' });
        loadCLOs();
      } catch (error) {
        console.error('Failed to create CLO:', error);
      }
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Define Course Learning Outcomes</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="number"
              min="1"
              placeholder="CLO # (e.g., 1)"
              value={newCLO.clo_number}
              onChange={(e) => setNewCLO({...newCLO, clo_number: Number(e.target.value)})}
              className="px-3 py-2 border rounded-md"
              required
            />
            <select
              value={newCLO.bloom_level}
              onChange={(e) => setNewCLO({...newCLO, bloom_level: e.target.value})}
              className="px-3 py-2 border rounded-md"
            >
              <option value="Remember">Remember</option>
              <option value="Understand">Understand</option>
              <option value="Apply">Apply</option>
              <option value="Analyze">Analyze</option>
              <option value="Evaluate">Evaluate</option>
              <option value="Create">Create</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add CLO
            </button>
          </div>
          <textarea
            placeholder="CLO Description"
            value={newCLO.description}
            onChange={(e) => setNewCLO({...newCLO, description: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
            rows={3}
            required
          />
        </form>

        <div className="mt-6">
          <h4 className="font-medium mb-3">Existing CLOs</h4>
          <div className="space-y-2">
            {clos.map((clo: any) => (
              <div key={clo.id} className="p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">CLO {clo.clo_number}</span>
                    <span className="ml-2 text-sm text-gray-600">
                      (Bloom Level: {clo.bloom_level})
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-1">{clo.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const AssessmentForm = () => {
    const [newAssessment, setNewAssessment] = useState({
      title: '',
      assessment_type: 'quiz',
      total_marks: 0,
      assessment_date: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCourse) return;
      
      try {
        await obeService.createAssessment({
          ...newAssessment,
          course: selectedCourse
        });
        setNewAssessment({
          title: '',
          assessment_type: 'quiz',
          total_marks: 0,
          assessment_date: ''
        });
        loadAssessments();
      } catch (error) {
        console.error('Failed to create assessment:', error);
      }
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Create Assessment</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Assessment Title"
              value={newAssessment.title}
              onChange={(e) => setNewAssessment({...newAssessment, title: e.target.value})}
              className="px-3 py-2 border rounded-md"
              required
            />
            <select
              value={newAssessment.assessment_type}
              onChange={(e) => setNewAssessment({...newAssessment, assessment_type: e.target.value})}
              className="px-3 py-2 border rounded-md"
            >
              <option value="quiz">Quiz</option>
              <option value="assignment">Assignment</option>
              <option value="midterm">Mid-term Exam</option>
              <option value="final">Final Exam</option>
              <option value="project">Project</option>
            </select>
            <input
              type="number"
              placeholder="Total Marks"
              value={newAssessment.total_marks}
              onChange={(e) => setNewAssessment({...newAssessment, total_marks: Number(e.target.value)})}
              className="px-3 py-2 border rounded-md"
              required
            />
            <input
              type="date"
              value={newAssessment.assessment_date}
              onChange={(e) => setNewAssessment({...newAssessment, assessment_date: e.target.value})}
              className="px-3 py-2 border rounded-md"
              required
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Create Assessment
          </button>
        </form>

        <div className="mt-6">
          <h4 className="font-medium mb-3">Course Assessments</h4>
          <div className="space-y-2">
            {assessments.map((assessment: any) => (
              <div key={assessment.id} className="p-3 bg-gray-50 rounded-md flex justify-between items-center">
                <div>
                  <span className="font-medium">{assessment.title}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    ({assessment.assessment_type} - {assessment.total_marks} marks)
                  </span>
                </div>
                <span className="text-sm text-gray-500">{assessment.assessment_date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ResultsEntry = () => {
    const [selectedAssessment, setSelectedAssessment] = useState<number | null>(null);
    const [students, setStudents] = useState([
      { id: 1, name: 'John Doe', roll_no: '2021-CS-001' },
      { id: 2, name: 'Jane Smith', roll_no: '2021-CS-002' }
    ]);
    const [results, setResults] = useState<Record<number, number>>({});

    const handleResultChange = (studentId: number, marks: number) => {
      setResults(prev => ({ ...prev, [studentId]: marks }));
    };

    const submitResults = async () => {
      if (!selectedAssessment) return;
      
      const studentResults = Object.entries(results).map(([studentId, marks]) => ({
        student_id: Number(studentId),
        obtained_marks: marks
      }));

      try {
        await obeService.bulkCreateStudentAssessments({
          assessment_id: selectedAssessment,
          student_results: studentResults
        });
        setResults({});
        alert('Results saved successfully!');
      } catch (error) {
        console.error('Failed to save results:', error);
      }
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Enter Assessment Results</h3>
        
        <div className="mb-4">
          <select
            value={selectedAssessment || ''}
            onChange={(e) => setSelectedAssessment(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">Select Assessment</option>
            {assessments.map((assessment: any) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title} ({assessment.total_marks} marks)
              </option>
            ))}
          </select>
        </div>

        {selectedAssessment && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 font-medium text-gray-700 border-b pb-2">
              <span>Student</span>
              <span>Roll No</span>
              <span>Marks Obtained</span>
            </div>
            {students.map(student => (
              <div key={student.id} className="grid grid-cols-3 gap-4 items-center">
                <span>{student.name}</span>
                <span>{student.roll_no}</span>
                <input
                  type="number"
                  min="0"
                  max={assessments.find((a: Assessment) => a.id === selectedAssessment)?.total_marks || 100}
                  value={results[student.id] || ''}
                  onChange={(e) => handleResultChange(student.id, Number(e.target.value))}
                  className="px-3 py-2 border rounded-md"
                  placeholder="Enter marks"
                />
              </div>
            ))}
            <button
              onClick={submitResults}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Save Results
            </button>
          </div>
        )}
      </div>
    );
  };

  const loadCLOs = async () => {
    if (!selectedCourse) return;
    try {
      const data = await obeService.getCourseOutcomes(selectedCourse);
      setClos(data);
    } catch (error) {
      console.error('Failed to load CLOs:', error);
    }
  };

  const loadAssessments = async () => {
    if (!selectedCourse) return;
    // Mock data - replace with actual API call
    setAssessments([
      { id: 1, title: 'Quiz 1', assessment_type: 'quiz', total_marks: 10, assessment_date: '2024-01-15' },
      { id: 2, title: 'Assignment 1', assessment_type: 'assignment', total_marks: 20, assessment_date: '2024-01-20' }
    ]);
  };

  useEffect(() => {
    if (selectedCourse) {
      loadCLOs();
      loadAssessments();
    }
  }, [selectedCourse]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">OBE Management</h2>
          <select
            value={selectedCourse || ''}
            onChange={(e) => setSelectedCourse(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">Select Course</option>
            {courses.map((course: any) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedCourse && (
        <>
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div>
            {activeTab === 'clos' && <CLODefinitionForm />}
            {activeTab === 'assessments' && <AssessmentForm />}
            {activeTab === 'results' && <ResultsEntry />}
            {activeTab === 'mapping' && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">CLO-Assessment Mapping</h3>
                <p className="text-gray-600">Map CLOs to assessments with weightages</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InstructorOBEModule;
