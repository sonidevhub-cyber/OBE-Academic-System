import React from 'react';
import { useAuth } from '../context/AuthContext';
import DateSheetModule from '../views/modules/DateSheetModule';

const DateSheetPage: React.FC = () => {
  const { currentUser } = useAuth();
  const role = (currentUser?.effective_role || currentUser?.active_role || currentUser?.role || '').toLowerCase();
  const mappedRole = role === 'hod' ? 'hod' : role === 'coordinator' ? 'coordinator' : 'student';
  return <DateSheetModule role={mappedRole} />;
};

export default DateSheetPage;

