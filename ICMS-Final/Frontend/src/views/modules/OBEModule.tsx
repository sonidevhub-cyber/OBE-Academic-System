import React, { useState } from 'react';
import CLOGAMappingMatrix from '../../components/obe/CLOGAMappingMatrix';

interface Props {
  departmentId: number;
}

const OBEModule: React.FC<Props> = ({ departmentId }) => {
  const [activeTab, setActiveTab] = useState('mapping');
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>();

  const tabs = [
    { id: 'mapping', label: 'CLO-GA Mapping' },
    { id: 'attainment', label: 'Attainment Analysis' },
    { id: 'reports', label: 'OBE Reports' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">OBE Management</h2>
        <div className="flex gap-2">
          <select 
            className="px-3 py-2 border rounded-md"
            value={selectedCourse || ''}
            onChange={(e) => setSelectedCourse(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All Courses</option>
            <option value="1">CS101 - Programming</option>
            <option value="2">CS201 - Data Structures</option>
          </select>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
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

      <div className="tab-content">
        {activeTab === 'mapping' && (
          <CLOGAMappingMatrix 
            courseId={selectedCourse} 
            departmentId={departmentId} 
          />
        )}
        
        {activeTab === 'attainment' && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Attainment Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-700">CLO Attainment</h4>
                <p className="text-2xl font-bold text-green-600">78.5%</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-700">GA Attainment</h4>
                <p className="text-2xl font-bold text-blue-600">82.3%</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-700">Overall Score</h4>
                <p className="text-2xl font-bold text-purple-600">80.4%</p>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'reports' && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">OBE Reports</h3>
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                <div>
                  <h4 className="font-medium">CLO Attainment Report - Fall 2024</h4>
                  <p className="text-sm text-gray-600">Generated on Dec 15, 2024</p>
                </div>
                <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Download
                </button>
              </div>
              <div className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                <div>
                  <h4 className="font-medium">GA Assessment Report - Fall 2024</h4>
                  <p className="text-sm text-gray-600">Generated on Dec 10, 2024</p>
                </div>
                <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Download
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OBEModule;