import React from 'react';

interface Props {
  status: 'draft' | 'finalized' | 'archived';
}

const VersionStatusBadge: React.FC<Props> = ({ status }) => {
  const styles = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    finalized: 'bg-green-100 text-green-800 border-green-200',
    archived: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default VersionStatusBadge;
