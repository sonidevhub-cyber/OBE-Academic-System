import React, { useState, useEffect } from 'react';

interface Department {
  department_id: number;
  name: string;
  code: string;
}

interface Semester {
  semester_id: number;
  name: string;
  semester_code: string;
  department: number;
  department_name?: string;
}

interface AttendanceFiltersProps {
  onFilterChange: (filters: { departmentId: string; semesterId: string }) => void;
  selectedDepartment: string;
  selectedSemester: string;
}

const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  onFilterChange,
  selectedDepartment,
  selectedSemester
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [filteredSemesters, setFilteredSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchDepartments(), fetchSemesters()]);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      const filtered = semesters.filter(sem => 
        sem.department && sem.department.toString() === selectedDepartment
      );
      setFilteredSemesters(filtered);
    } else {
      setFilteredSemesters(semesters);
    }
  }, [selectedDepartment, semesters]);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching departments with token:', token ? 'Present' : 'Missing');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Token ${token}`;
      }
      
      const response = await fetch('http://localhost:8000/api/academics/departments/', {
        headers
      });
      
      console.log('Department response status:', response.status);
      
      if (!response.ok) {
        console.error('Department fetch failed:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      console.log('Raw departments response:', data);
      
      let departmentList = [];
      if (Array.isArray(data)) {
        departmentList = data;
      } else if (data.results && Array.isArray(data.results)) {
        departmentList = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        departmentList = data.data;
      }
      
      console.log('Processed departments:', departmentList);
      setDepartments(departmentList);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchSemesters = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching semesters with token:', token ? 'Present' : 'Missing');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Token ${token}`;
      }
      
      const response = await fetch('http://localhost:8000/api/academics/semesters/', {
        headers
      });
      
      console.log('Semester response status:', response.status);
      
      if (!response.ok) {
        console.error('Semester fetch failed:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      console.log('Raw semesters response:', data);
      
      let semesterList = [];
      if (Array.isArray(data)) {
        semesterList = data;
      } else if (data.results && Array.isArray(data.results)) {
        semesterList = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        semesterList = data.data;
      }
      
      console.log('Processed semesters:', semesterList);
      setSemesters(semesterList);
    } catch (error) {
      console.error('Failed to fetch semesters:', error);
    }
  };

  const handleDepartmentChange = (departmentId: string) => {
    onFilterChange({ departmentId, semesterId: '' });
  };

  const handleSemesterChange = (semesterId: string) => {
    onFilterChange({ departmentId: selectedDepartment, semesterId });
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-6 mb-6">
        <div className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500">
          Loading departments...
        </div>
        <div className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500">
          Loading semesters...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-6 mb-6">
        <div className="flex-1 px-4 py-3 border border-red-300 rounded-lg bg-red-50 text-red-600">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-6 mb-6">
      <select
        value={selectedDepartment}
        onChange={(e) => handleDepartmentChange(e.target.value)}
        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base bg-white"
      >
        <option value="">Select Department ({departments.length} available)</option>
        {departments.map((dept) => (
          <option key={dept.department_id} value={dept.department_id}>
            {dept.name}
          </option>
        ))}
      </select>
      
      <select
        value={selectedSemester}
        onChange={(e) => handleSemesterChange(e.target.value)}
        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base bg-white"
        disabled={!selectedDepartment}
      >
        <option value="">Select Semester ({filteredSemesters.length} available)</option>
        {filteredSemesters.map((sem) => (
          <option key={sem.semester_id} value={sem.semester_id}>
            {sem.name}
          </option>
        ))}
      </select>

      {(selectedDepartment || selectedSemester) && (
        <button
          onClick={() => onFilterChange({ departmentId: '', semesterId: '' })}
          className="px-6 py-3 text-base text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap"
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default AttendanceFilters;