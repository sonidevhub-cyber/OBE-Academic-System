import React from 'react';
import ActiveHODRecords from '../components/ActiveHODRecords';

const ActiveHODRecordsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <ActiveHODRecords />
      </div>
    </div>
  );
};

export default ActiveHODRecordsPage;