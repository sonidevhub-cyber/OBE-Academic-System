import React, { useState, useEffect } from 'react';
import obeService, { MappingMatrix } from '../../api/obeService';

interface Props {
  courseId?: number;
  departmentId?: number;
}

const CLOGAMappingMatrix: React.FC<Props> = ({ courseId, departmentId }) => {
  const [matrix, setMatrix] = useState<MappingMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadMatrix();
  }, [courseId, departmentId]);

  const loadMatrix = async () => {
    try {
      const data = await obeService.getMappingMatrix(courseId, departmentId);
      setMatrix(data);
    } catch (error) {
      console.error('Failed to load matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (cloCode: string, gaCode: string, currentStrength: string | null) => {
    const key = `${cloCode}-${gaCode}`;
    const strengths = ['', 'low', 'medium', 'high'];
    const currentIndex = strengths.indexOf(currentStrength || '');
    const nextStrength = strengths[(currentIndex + 1) % strengths.length];
    
    setChanges(prev => new Map(prev.set(key, nextStrength)));
  };

  const saveChanges = async () => {
    if (!matrix) return;
    
    const mappings = Array.from(changes.entries()).map(([key, strength]) => {
      const [cloCode, gaCode] = key.split('-');
      const cloRow = matrix.matrix.find(row => row.clo === cloCode);
      const ga = matrix.gas.find(g => g.code === gaCode);
      
      return {
        clo_id: cloRow ? matrix.matrix.indexOf(cloRow) + 1 : 0,
        ga_id: ga ? matrix.gas.indexOf(ga) + 1 : 0,
        strength: strength || null
      };
    });

    try {
      await obeService.bulkUpdateMappings(mappings);
      setChanges(new Map());
      loadMatrix();
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  };

  const getStrengthColor = (strength: string | null) => {
    switch (strength) {
      case 'high': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-orange-500';
      default: return 'bg-gray-200';
    }
  };

  const getStrengthValue = (strength: string | null) => {
    switch (strength) {
      case 'high': return '3';
      case 'medium': return '2';
      case 'low': return '1';
      default: return '';
    }
  };

  if (loading) return <div className="p-4">Loading matrix...</div>;
  if (!matrix) return <div className="p-4">No data available</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">CLO-GA Mapping Matrix</h3>
        {changes.size > 0 && (
          <button
            onClick={saveChanges}
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
              <th className="border border-gray-300 p-2 bg-gray-100">Course</th>
              {matrix.gas.map(ga => (
                <th key={ga.code} className="border border-gray-300 p-2 bg-gray-100 text-xs">
                  {ga.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.matrix.map(row => (
              <tr key={row.clo}>
                <td className="border border-gray-300 p-2 font-medium">{row.clo}</td>
                <td className="border border-gray-300 p-2 text-sm">{row.course}</td>
                {matrix.gas.map(ga => {
                  const key = `${row.clo}-${ga.code}`;
                  const currentMapping = row.mappings[ga.code];
                  const pendingChange = changes.get(key);
                  const displayStrength = pendingChange !== undefined ? pendingChange : currentMapping.strength;
                  
                  return (
                    <td
                      key={ga.code}
                      className={`border border-gray-300 p-1 text-center cursor-pointer hover:opacity-80 ${getStrengthColor(displayStrength)} ${pendingChange !== undefined ? 'ring-2 ring-blue-400' : ''}`}
                      onClick={() => handleCellClick(row.clo, ga.code, currentMapping.strength)}
                      title={`${row.clo} → ${ga.code}: ${displayStrength || 'None'}`}
                    >
                      <span className="text-white font-bold text-sm">
                        {getStrengthValue(displayStrength)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>High (3)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span>Medium (2)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <span>Low (1)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <span>None</span>
        </div>
      </div>
    </div>
  );
};

export default CLOGAMappingMatrix;