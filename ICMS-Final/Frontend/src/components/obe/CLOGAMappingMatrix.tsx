import React, { useEffect, useMemo, useState } from 'react';
import obeService, { MappingMatrix } from '../../api/obeService';

interface Props {
  courseId?: number;
  departmentId?: number;
}

const coerceWeight = (weight: number | string | null | undefined): number => {
  const num = Number(weight);
  return Number.isFinite(num) ? num : 0;
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const splitEvenlyWithRounding = (keys: string[], total: number) => {
  const result: Record<string, number> = {};
  if (keys.length === 0) return result;
  if (keys.length === 1) {
    result[keys[0]] = roundToTwo(total);
    return result;
  }

  const base = roundToTwo(total / keys.length);
  let allocated = 0;
  keys.forEach((key, index) => {
    const value = index === keys.length - 1 ? roundToTwo(total - allocated) : base;
    allocated = roundToTwo(allocated + value);
    result[key] = value;
  });
  return result;
};

const formatWeight = (weight: number | string | null | undefined): string => {
  const num = coerceWeight(weight);
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
};

const CLOGAMappingMatrix: React.FC<Props> = ({ courseId, departmentId }) => {
  const [matrix, setMatrix] = useState<MappingMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadMatrix();
  }, [courseId, departmentId]);

  const normalizeMatrix = (data: MappingMatrix): MappingMatrix => {
    const normalizedRows = data.matrix.map(row => {
      const activeGaCodes = data.gas
        .map(ga => ga.code)
        .filter(gaCode => coerceWeight(row.mappings[gaCode]?.value) > 0 || !!row.mappings[gaCode]?.strength);

      const split = splitEvenlyWithRounding(activeGaCodes, 1);
      const nextMappings: Record<string, { strength: string | null; value: number }> = {};

      data.gas.forEach(ga => {
        const current = row.mappings[ga.code] || { strength: null, value: 0 };
        if (activeGaCodes.includes(ga.code)) {
          nextMappings[ga.code] = {
            strength: null,
            value: split[ga.code] ?? 0
          };
        } else {
          nextMappings[ga.code] = {
            strength: null,
            value: 0
          };
        }
      });

      return {
        ...row,
        mappings: nextMappings
      };
    });

    return {
      ...data,
      matrix: normalizedRows
    };
  };

  const loadMatrix = async () => {
    try {
      const data = await obeService.getMappingMatrix(courseId, departmentId);
      setMatrix(normalizeMatrix(data));
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to load matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  const isMatrixValid = useMemo(() => {
    if (!matrix?.matrix?.length) return false;
    return matrix.matrix.every(row => {
      const total = matrix.gas.reduce((sum, ga) => sum + coerceWeight(row.mappings[ga.code]?.value), 0);
      return Math.abs(total - 1) < 0.0001;
    });
  }, [matrix]);

  const rowTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    matrix?.matrix.forEach(row => {
      totals[row.clo] = matrix.gas.reduce((sum, ga) => sum + coerceWeight(row.mappings[ga.code]?.value), 0);
    });
    return totals;
  }, [matrix]);

  const updateRow = (cloCode: string, updater: (row: MappingMatrix['matrix'][number]) => MappingMatrix['matrix'][number]) => {
    setMatrix(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        matrix: prev.matrix.map(row => (row.clo === cloCode ? updater(row) : row))
      };
    });
    setIsDirty(true);
  };

  const rebalanceRow = (row: MappingMatrix['matrix'][number], activeGaCodes: string[]) => {
    const split = splitEvenlyWithRounding(activeGaCodes, 1);
    const nextMappings: Record<string, { strength: string | null; value: number }> = {};

    matrix?.gas.forEach(ga => {
      if (activeGaCodes.includes(ga.code)) {
        nextMappings[ga.code] = {
          strength: null,
          value: split[ga.code] ?? 0
        };
      } else {
        nextMappings[ga.code] = {
          strength: null,
          value: 0
        };
      }
    });

    return {
      ...row,
      mappings: nextMappings
    };
  };

  const handleToggleCell = (cloCode: string, gaCode: string, checked: boolean) => {
    updateRow(cloCode, row => {
      const activeGaCodes = matrix?.gas
        .map(ga => ga.code)
        .filter(code => coerceWeight(row.mappings[code]?.value) > 0 || (!!row.mappings[code]?.strength && code !== gaCode)) || [];

      const nextActive = checked
        ? Array.from(new Set([...activeGaCodes, gaCode]))
        : activeGaCodes.filter(code => code !== gaCode);

      return rebalanceRow(row, nextActive);
    });
  };

  const handleWeightChange = (cloCode: string, gaCode: string, value: string) => {
    const nextWeight = value === '' ? 0 : Number(value);
    updateRow(cloCode, row => ({
      ...row,
      mappings: {
        ...row.mappings,
        [gaCode]: {
          strength: null,
          value: Number.isFinite(nextWeight) ? nextWeight : 0
        }
      }
    }));
  };

  const saveChanges = async () => {
    if (!matrix) return;
    if (!isMatrixValid) {
      console.error('Each CLO row must sum to exactly 1.00 before saving.');
      return;
    }

    const mappings = matrix.matrix.flatMap((row, rowIndex) =>
      matrix.gas
        .map((ga, gaIndex) => {
          const value = coerceWeight(row.mappings[ga.code]?.value);
          if (value <= 0) return null;
          return {
            clo_id: rowIndex + 1,
            ga_id: gaIndex + 1,
            weight: roundToTwo(value)
          };
        })
        .filter(Boolean) as Array<{ clo_id: number; ga_id: number; weight: number }>
    );

    try {
      await obeService.bulkUpdateMappings(mappings);
      setIsDirty(false);
      loadMatrix();
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  };

  if (loading) return <div className="p-4">Loading matrix...</div>;
  if (!matrix) return <div className="p-4">No data available</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">CLO-GA Mapping Matrix</h3>
        {isDirty && (
          <button
            onClick={saveChanges}
            disabled={!isMatrixValid}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
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
              <th className="border border-gray-300 p-2 bg-gray-100 text-xs">Total</th>
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
                  const isActive = coerceWeight(currentMapping?.value) > 0;
                  const displayValue = currentMapping?.value ?? 0;
                  
                  return (
                    <td
                      key={ga.code}
                      className={`border border-gray-300 p-2 text-center align-top ${isActive ? 'bg-indigo-50' : 'bg-gray-50'}`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => handleToggleCell(row.clo, ga.code, e.target.checked)}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        {isActive ? (
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={formatWeight(displayValue)}
                            onChange={(e) => handleWeightChange(row.clo, ga.code, e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center text-sm font-semibold"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">Inactive</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className={`border border-gray-300 p-2 text-center font-bold ${Math.abs((rowTotals[row.clo] || 0) - 1) < 0.0001 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatWeight(rowTotals[row.clo] || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-indigo-50 border border-indigo-200 rounded"></div>
          <span>Active weight</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
          <span>Inactive</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Row total must be 1.00</span>
        </div>
      </div>
    </div>
  );
};

export default CLOGAMappingMatrix;
