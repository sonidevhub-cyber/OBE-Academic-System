import { api } from './api';
import { PEO, GA } from './obeService';

// --- Interfaces ---

export interface GAPEOMappingWithWeight {
  id: string;
  ga: string;
  peo: string;
  ga_id?: string;
  peo_id?: string;
  weight: number;
  is_active?: boolean;
  created_at?: string;
}

export interface GAPEOMatrixWithWeight {
  gas: GA[];
  peos: PEO[];
  mappings: GAPEOMappingWithWeight[];
}

export interface PEOReportContributingGA {
  ga_id: string;
  ga_code: string;
  ga_title: string;
  ga_score: number;
  weight: number;
}

export interface PEOReportItem {
  peo_id: string;
  peo_code: string;
  peo_title: string;
  final_score: number | null;
  direct_score: number | null;
  indirect_score: number | null;
  formula_applied: string;
  breakdown: any;
  contributing_gas: PEOReportContributingGA[];
  indirect_sources: any[];
}

export interface PEOCQISubmissionHistory {
  id: string;
  cqi_record: string;
  root_cause_snapshot: string | null;
  status_at_time: string;
  submitted_at: string;
}

export interface PEOCQIRecord {
  id: string;
  peo: string;
  peo_title: string;
  peo_code: string;
  peo_id?: string;
  batch: string;
  batch_name: string;
  attainment_value: number | null;
   kpi_threshold_at_trigger: number | null;
   root_cause: string | null;
   status: 'DRAFT' | 'APPROVED' | 'OPEN' | 'CLOSED_IMPLEMENTED';
  submitted_by: any | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  history?: PEOCQISubmissionHistory[];
  contributing_gas?: PEOReportContributingGA[];
  implemented_in_batch?: string | null;
  implemented_in_batch_name?: string | null;
  action_taken_description?: string | null;
  resulting_attainment?: number | null;
  closed_by?: any | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
}

// --- Service Class ---

class PEOService {
  // --- PEO Report ---
  async getPEOReports(batchId: string): Promise<PEOReportItem[]> {
    const response = await api.get(`/obe/peo-reports/${batchId}/`);
    return response.data;
  }

  // --- GA-PEO Mapping ---
  async getGAPEOMatrix(programId: string): Promise<GAPEOMatrixWithWeight> {
    const response = await api.get(`/obe/programs/${programId}/ga-peo-matrix/`);
    return response.data;
  }

  async saveGAPEOMappings(programId: string, mappings: Array<{ ga_id: string; peo_id: string; weight: number }>): Promise<any> {
    const response = await api.post(`/obe/programs/${programId}/ga-peo-matrix/`, { mappings });
    return response.data;
  }

  // --- PEO CQI ---
  async getPEOCQIRecords(batchId?: string): Promise<PEOCQIRecord[]> {
    const params = batchId ? { batch_id: batchId } : {};
    const response = await api.get('/obe/peo-cqi/', { params });
    return response.data;
  }

  async getPEOCQIRecord(cqiId: string): Promise<PEOCQIRecord> {
    const response = await api.get(`/obe/peo-cqi/${cqiId}/`);
    return response.data;
  }

  async createPEOCQI(data: { peo: string; batch: string; root_cause?: string }): Promise<PEOCQIRecord> {
    const response = await api.post('/obe/peo-cqi/create/', data);
    return response.data;
  }

  async updatePEOCQIRecord(cqiId: string, data: Partial<PEOCQIRecord>): Promise<PEOCQIRecord> {
    const response = await api.patch(`/obe/peo-cqi/${cqiId}/`, data);
    return response.data;
  }

  async submitPEOCQI(cqiId: string): Promise<PEOCQIRecord> {
    const response = await api.post(`/obe/peo-cqi/${cqiId}/submit/`);
    return response.data;
  }

  async getPEOCQIHistory(cqiId: string): Promise<PEOCQISubmissionHistory[]> {
    const response = await api.get(`/obe/peo-cqi/${cqiId}/history/`);
    return response.data;
  }

  async closePEOCQI(
    cqiId: string,
    data: { implemented_in_batch: string; action_taken_description: string }
  ): Promise<PEOCQIRecord> {
    const response = await api.post(`/obe/peo-cqi/${cqiId}/close/`, data);
    return response.data;
  }
}

export default new PEOService();
