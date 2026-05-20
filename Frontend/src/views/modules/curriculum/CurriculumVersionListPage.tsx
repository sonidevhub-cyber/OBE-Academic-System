import React, { useState, useEffect } from 'react';
import { curriculumService, CurriculumVersion } from '../../../api/curriculumService';
import VersionStatusBadge from '../../../components/obe/VersionStatusBadge';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Filter, Eye, Edit, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';


interface CurriculumVersionListPageProps {
  onViewVersion?: (id: string) => void;
  onCreateNew?: () => void;
}

const CurriculumVersionListPage: React.FC<CurriculumVersionListPageProps> = ({ onViewVersion, onCreateNew }) => {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<CurriculumVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchVersions();
  }, [programId, statusFilter]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const params: any = { program: programId };
      if (statusFilter) params.status = statusFilter;
      
      const response = await curriculumService.getVersions(params);
      setVersions(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Error fetching curriculum versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      navigate('/curriculum-versions/new');
    }
  };

  const handleViewVersion = (id: string | number) => {
    if (onViewVersion) {
      onViewVersion(String(id));
    } else {
      navigate(`/curriculum-versions/${id}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Curriculum Versions</h1>
          <p className="text-gray-500">Manage academic curriculum and teacher allocations</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Version
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-500">
            <Filter className="w-4 h-4 mr-2" />
            Filter by:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border-gray-200 rounded-md focus:ring-green-500 focus:border-green-500"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">Version No</th>
                <th className="px-6 py-3 font-semibold">Batch</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Courses</th>
                <th className="px-6 py-3 font-semibold">Created By</th>
                <th className="px-6 py-3 font-semibold">Activated At</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400">Loading versions...</td>
                </tr>
              ) : versions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                    No curriculum versions yet. Create the first one.
                  </td>
                </tr>
              ) : (
                versions.map((version) => (
                  <tr key={version.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{version.version_no}</td>
                    <td className="px-6 py-4 text-gray-600">{version.batch_name}</td>
                    <td className="px-6 py-4">
                      <VersionStatusBadge status={version.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-600">{version.total_courses} courses</td>
                    <td className="px-6 py-4 text-gray-600">{version.created_by_name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {version.activated_at ? new Date(version.activated_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        {version.status === 'draft' ? (
                          <>
                            <button
                              onClick={() => {
                                if (version.id) {
                                  handleViewVersion(version.id);
                                } else {
                                  toast.error('Invalid version ID');
                                }
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit/View"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (version.id) {
                                  // For now, view version will handle the detail, 
                                  // but we can pass a tab if we want to expand functionality
                                  handleViewVersion(version.id);
                                } else {
                                  toast.error('Invalid version ID');
                                }
                              }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Teacher Allocation"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              if (version.id) {
                                handleViewVersion(version.id);
                              } else {
                                toast.error('Invalid version ID');
                              }
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {/* Clone Logic */}}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                          title="Clone for New Batch"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CurriculumVersionListPage;
