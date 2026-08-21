import React from 'react';

interface Props {
  status: 'active' | 'changed' | 'cancelled';
}

const AllocationStatusBadge: React.FC<Props> = ({ status }) => {
  const styles = {
    active: 'bg-green-100 text-green-800 border-green-200',
    changed: 'bg-amber-100 text-amber-800 border-amber-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default AllocationStatusBadge;
