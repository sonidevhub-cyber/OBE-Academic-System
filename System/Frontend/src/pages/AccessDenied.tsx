import React from 'react';
import { Link } from 'react-router-dom';

const AccessDenied: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-slate-600 mt-3">
          You do not have permission to view this page.
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
