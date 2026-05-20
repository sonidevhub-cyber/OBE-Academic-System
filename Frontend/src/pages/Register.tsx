import React from 'react';

const RegisterPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">Registration Disabled</h2>
      <p className="text-gray-700 mb-4">Self-registration has been disabled. Please contact an administrator to create an account.</p>
      <a href="/login" className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Go to Login</a>
    </div>
  );
};

export default RegisterPage;
