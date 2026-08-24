import { useState, useEffect, useCallback } from 'react';
import obeService, { FrameworkSnapshotResponse, DossierListItem } from '../api/obeService';

export const useFrameworkSnapshot = (batchId: string | null | undefined) => {
  const [data, setData] = useState<FrameworkSnapshotResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!batchId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await obeService.getFrameworkSnapshot(batchId);
      setData(result);
    } catch (err: any) {
      console.error('Failed to fetch framework snapshot:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load framework snapshot');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  return {
    data,
    loading,
    error,
    refetch: fetchSnapshot,
  };
};

export const useDossierList = (params?: { program?: string; status?: 'active' | 'graduated' }) => {
  const [data, setData] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await obeService.getDossierList(params);
      setData(result || []);
    } catch (err: any) {
      console.error('Failed to fetch dossier list:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load dossier list');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [params?.program, params?.status]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  return {
    data,
    loading,
    error,
    refetch: fetchList,
  };
};
