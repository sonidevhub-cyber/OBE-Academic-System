import React from 'react';
import ProfessionalTimetable from './ProfessionalTimetable';

interface StudentTimetableProps {
  studentId: string;
  darkMode?: boolean;
}

const StudentTimetable: React.FC<StudentTimetableProps> = ({ studentId, darkMode = false }) => {
  return (
    <ProfessionalTimetable 
      studentId={studentId}
      viewType="student"
      darkMode={darkMode}
    />
  );
};

export default StudentTimetable;