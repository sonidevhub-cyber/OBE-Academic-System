import { api } from '../../api/api';
import type { PEOReportData, PEOCQIRecord } from './types';

const downloadBlobAsFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export async function getPEOReport(
  programId: string,
  year: string | number,
  batchId?: string
): Promise<PEOReportData> {
  const params = batchId ? { batch_id: batchId } : {};
  const response = await api.get(`peo-report/${programId}/${year}/`, { params });
  return response.data;
}

export async function downloadPEOReportPDF(
  programId: string,
  year: string | number,
  chartImageBase64: string,
  batchId?: string
): Promise<Blob> {
  const params = batchId ? { batch_id: batchId } : {};
  try {
    const response = await api.post(
      `peo-report/${programId}/${year}/pdf/`,
      { chart_image: chartImageBase64 },
      { responseType: 'blob', params },
    );

    const blob = response.data as Blob;
    downloadBlobAsFile(blob, `peo-report-${programId}-${year}.pdf`);
    return blob;
  } catch (error: any) {
    const responseData = error?.response?.data;
    if (responseData instanceof Blob) {
      try {
        const text = await responseData.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.error || parsed.detail || 'PDF generation is currently unavailable.');
      } catch {
        throw new Error('PDF generation is currently unavailable.');
      }
    }

    throw new Error(error?.response?.data?.error || error?.message || 'Failed to download PEO report PDF');
  }
}

export async function upsertPEOCQI(
  payload: {
    peo: string;
    batch: string;
    root_cause?: string;
    remedial_plan?: string;
    attainment_value?: number;
    kpi_threshold_at_trigger?: number;
  },
): Promise<PEOCQIRecord> {
  const response = await api.post(`obe/peo-cqi/create/`, payload);
  return response.data;
}

export const upsertPEOCQIRecord = upsertPEOCQI;

export async function getPEOCQIRecord(cqiId: string): Promise<PEOCQIRecord> {
  const response = await api.get(`obe/peo-cqi/${cqiId}/`);
  return response.data;
}

export async function updatePEOCQIRecord(
  cqiId: string,
  payload: Partial<{
    root_cause: string;
    remedial_plan: string;
  }>,
): Promise<PEOCQIRecord> {
  const response = await api.patch(`obe/peo-cqi/${cqiId}/`, payload);
  return response.data;
}

export async function submitPEOCQIRecord(cqiId: string): Promise<PEOCQIRecord> {
  const response = await api.post(`obe/peo-cqi/${cqiId}/submit/`);
  return response.data;
}
