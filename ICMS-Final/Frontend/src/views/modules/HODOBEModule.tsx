import React, { useEffect, useState } from 'react';
import { api } from '../../api/api';
import { obeService, GA } from '../../api/obeService';
import CLOGAMappingMatrix from '../../components/obe/CLOGAMappingMatrix';


interface Props {
  departmentId: number;
}

const HODOBEModule: React.FC<Props> = ({ departmentId }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'gas' | 'mapping' | 'reports'>('overview');
  const [gas, setGas] = useState<GA[]>([]);

  const [attainmentData, setAttainmentData] = useState({
    avgCLO: 0,
    avgGA: 0,
    totalCourses: 0,
    totalInstructors: 0,
  });

  useEffect(() => {
    void loadDepartmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const loadDepartmentData = async () => {
    try {
      if (!departmentId) return;

      const programResponse = await api.get(`/programs/?department_id=${departmentId}`);
      if (programResponse.data?.length > 0) {
        const programId = programResponse.data[0].id;
        const gaResponse = await obeService.getGAs(programId);
        setGas(gaResponse.data);
      }

      // Mock attainment data
      setAttainmentData({
        avgCLO: 78.5,
        avgGA: 82.3,
        totalCourses: 12,
        totalInstructors: 8,
      });
    } catch (error) {
      console.error('Failed to load department data:', error);
    }
  };

  const GAManagement = () => {
    const [newGA, setNewGA] = useState({
      code: '',
      title: '',
      description: '',
      order_number: 0,
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        if (!departmentId) return;

        const programResponse = await api.get(`/programs/?department_id=${departmentId}`);
        if (programResponse.data?.length > 0) {
          const programId = programResponse.data[0].id;
          await obeService.createGA(programId, { ...newGA });
          setNewGA({ code: '', title: '', description: '', order_number: 0 });
          await loadDepartmentData();
        }
      } catch (error) {
        console.error('Failed to create GA:', error);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Define Graduate Attributes</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="GA Code (e.g., GA1)"
                value={newGA.code}
                onChange={(e) => setNewGA({ ...newGA, code: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <input
                type="text"
                placeholder="GA Title"
                value={newGA.title}
                onChange={(e) => setNewGA({ ...newGA, title: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
            </div>
            <textarea
              placeholder="GA Description"
              value={newGA.description}
              onChange={(e) => setNewGA({ ...newGA, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add Graduate Attribute
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Department Graduate Attributes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gas.map((ga) => (
              <div key={ga.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-lg">{ga.code}</h4>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      ga.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {ga.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h5 className="font-medium text-gray-700 mb-2">{ga.title}</h5>
                <p className="text-sm text-gray-600">{ga.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const OverviewDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Avg CLO Attainment</h3>
          <p className="text-3xl font-bold text-blue-600">{attainmentData.avgCLO}%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Avg GA Attainment</h3>
          <p className="text-3xl font-bold text-green-600">{attainmentData.avgGA}%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Courses</h3>
          <p className="text-3xl font-bold text-purple-600">{attainmentData.totalCourses}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Instructors</h3>
          <p className="text-3xl font-bold text-orange-600">{attainmentData.totalInstructors}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Course-wise OBE Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-3 text-left">Course</th>
                <th className="border border-gray-300 p-3 text-left">Instructor</th>
                <th className="border border-gray-300 p-3 text-left">CLOs Defined</th>
                <th className="border border-gray-300 p-3 text-left">Assessments</th>
                <th className="border border-gray-300 p-3 text-left">Avg Attainment</th>
                <th className="border border-gray-300 p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-3">CS101 - Programming</td>
                <td className="border border-gray-300 p-3">Dr. Smith</td>
                <td className="border border-gray-300 p-3">5/5</td>
                <td className="border border-gray-300 p-3">8</td>
                <td className="border border-gray-300 p-3">82%</td>
                <td className="border border-gray-300 p-3">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Complete</span>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-3">CS201 - Data Structures</td>
                <td className="border border-gray-300 p-3">Dr. Johnson</td>
                <td className="border border-gray-300 p-3">4/6</td>
                <td className="border border-gray-300 p-3">5</td>
                <td className="border border-gray-300 p-3">75%</td>
                <td className="border border-gray-300 p-3">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">In Progress</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const ReportsSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Generate OBE Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50">
            <h4 className="font-medium">Department CLO Report</h4>
            <p className="text-sm text-gray-600 mt-1">Overall CLO attainment across all courses</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50">
            <h4 className="font-medium">GA Attainment Report</h4>
            <p className="text-sm text-gray-600 mt-1">Graduate attribute achievement analysis</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50">
            <h4 className="font-medium">Accreditation Report</h4>
            <p className="text-sm text-gray-600 mt-1">Comprehensive report for accreditation bodies</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50">
            <h4 className="font-medium">Instructor Performance</h4>
            <p className="text-sm text-gray-600 mt-1">OBE implementation by instructors</p>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Reports</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <div>
              <h4 className="font-medium">Fall 2024 CLO Report</h4>
              <p className="text-sm text-gray-600">Generated on Dec 15, 2024</p>
            </div>
            <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm">Download</button>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <div>
              <h4 className="font-medium">GA Assessment Report</h4>
              <p className="text-sm text-gray-600">Generated on Dec 10, 2024</p>
            </div>
            <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm">Download</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold">Department OBE Management</h2>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'gas', label: 'Graduate Attributes' },
            { id: 'mapping', label: 'CLO-GA Matrix' },
            { id: 'reports', label: 'Reports' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
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

      <div>
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'gas' && <GAManagement />}
        {activeTab === 'mapping' && <CLOGAMappingMatrix />}
        {activeTab === 'reports' && <ReportsSection />}
      </div>
    </div>
  );
};

export default HODOBEModule;

