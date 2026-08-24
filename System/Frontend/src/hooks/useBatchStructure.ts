import { useCallback, useEffect, useState } from 'react';
import batchService, { BatchStructureResponse } from '../api/batchService';

export const useBatchStructure = (batchId: string | null | undefined, semester?: number | string | null) => {
  const [data, setData] = useState<BatchStructureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStructure = useCallback(async () => {
    if (!batchId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await batchService.getBatchStructure(batchId, semester || undefined);
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to fetch batch structure:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load batch structure');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [batchId, semester]);

  useEffect(() => {
    void fetchStructure();
  }, [fetchStructure]);

  return {
    data,
    loading,
    error,
    refetch: fetchStructure,
  };
};

export default useBatchStructure;
