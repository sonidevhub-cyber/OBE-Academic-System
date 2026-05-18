import React, { useState, useEffect } from 'react';
import { obeService, CLO, GA } from '../../api/obeService';

interface MappingMatrix {
  clos: CLO[];
  gas: GA[];
  mappings: { [key: string]: number };
}

interface Props {
  courseId?: number;
  batchId?: number;
}

const CLOGAMappingMatrix: React.FC<Props> = ({ courseId, batchId }) => {
  const [matrix, setMatrix] = useState<MappingMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (courseId && batchId) {
      loadMatrix();
    }
  }, [courseId, batchId]);

  const loadMatrix = async () => {
    if (!courseId || !batchId) return;
    try {
      const response = await obeService.getCLOGAMatrix(courseId.toString(), batchId.toString());
      const mappingsDict = response.data.mappings.reduce((acc, mapping) => {
        acc[`${mapping.clo}-${mapping.ga}`] = mapping.weight;
        return acc;
      }, {} as { [key: string]: number });

      setMatrix({ ...response.data, mappings: mappingsDict });
    } catch (error) {
      console.error('Failed to load matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (key: string, value: number) => {
    setChanges(prev => new Map(prev.set(key, value)));
  };

  const handleSaveChanges = async () => {
    if (!matrix || !courseId || !batchId) return;

    const mappings = Array.from(changes.entries()).map(([key, strength]) => {
      const [cloId, gaId] = key.split('-');
      return {
        clo_id: cloId,
        ga_id: gaId,
        weight: strength,
      };
    });

    try {
      await obeService.saveCLOGAMatrix(courseId.toString(), batchId.toString(), mappings);
      setChanges(new Map());
      loadMatrix();
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  };

  if (loading) return <div className="p-4">Loading matrix...</div>;
  if (!matrix) return <div className="p-4">No data available for this course/batch combination.</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">CLO-GA Mapping Matrix</h3>
        {changes.size > 0 && (
          <button
            onClick={handleSaveChanges}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save Changes ({changes.size})
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2 bg-gray-100">CLO</th>
              {matrix.gas.map((ga: GA) => (
                <th key={ga.id} className="border border-gray-300 p-2 bg-gray-100 text-xs">
                  {ga.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.clos.map((clo: CLO) => (
              <tr key={clo.id}>
                <td className="border border-gray-300 p-2 font-medium">{clo.title}</td>
                {matrix.gas.map((ga: GA) => {
                  const key = `${clo.id}-${ga.id}`;
                  const currentStrength = matrix.mappings[key];
                  const pendingChange = changes.get(key);
                  const displayStrength = pendingChange !== undefined ? pendingChange : currentStrength;

                  return (
                    <td key={ga.id} className="border border-gray-300 p-2 text-center">
                      <select
                        value={displayStrength || 0}
                        onChange={(e) => handleMappingChange(key, parseInt(e.target.value, 10))}
                        className={`w-full p-1 border rounded text-xs ${pendingChange !== undefined ? 'bg-yellow-100' : ''}`}
                      >
                        <option value="0">N/A</option>
                        <option value="1">1 (Low)</option>
                        <option value="2">2 (Medium)</option>
                        <option value="3">3 (High)</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CLOGAMappingMatrix;