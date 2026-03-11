import React from 'react';
import ProfessionalTimetable from './timetable/ProfessionalTimetable';

interface HODTimetableProps {
  darkMode?: boolean;
}

const HODTimetable: React.FC<HODTimetableProps> = ({ darkMode = false }) => {
  return (
    <ProfessionalTimetable 
      viewType="hod"
      darkMode={darkMode}
    />
  );
};

export default HODTimetable;