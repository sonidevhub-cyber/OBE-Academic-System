import { api } from '../../api/api';
import type { PEOReportData } from './types';

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

export async function getPEOReport(programId: string, year: string | number): Promise<PEOReportData> {
  const response = await api.get(`peo-report/${programId}/${year}/`);
  return response.data;
}

export async function downloadPEOReportPDF(
  programId: string,
  year: string | number,
  chartImageBase64: string,
): Promise<Blob> {
  const response = await api.post(
    `peo-report/${programId}/${year}/pdf/`,
    { chart_image: chartImageBase64 },
    { responseType: 'blob' },
  );

  const blob = response.data as Blob;
  downloadBlobAsFile(blob, `peo-report-${programId}-${year}.pdf`);
  return blob;
}

export async function upsertPEOCQI(
  programId: string,
  year: string | number,
  peoId: string,
  payload: {
    identified_weakness: string;
    corrective_action_plan: string;
  },
): Promise<unknown> {
  const response = await api.post(`peo-cqi/${programId}/${peoId}/${year}/`, payload);
  return response.data;
}
