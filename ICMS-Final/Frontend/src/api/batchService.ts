import { api } from './api';

export interface Batch { 
    id: string;
    name: string; 
    program: any; 
    start_year: number; 
    end_year: number; 
    current_semester: number; 
    student_count: number; 
    is_active: boolean; 
    status: 'active' | 'graduated';
    curriculum_version_id?: number;
    curriculum_version_no?: string;
    graduated_at: string | null;
    exit_survey_enabled: boolean;
    pending_exit_survey_count: number;
    is_program_end_ready: boolean;
    graduation_status: 'not_graduating' | 'in_progress' | 'graduated_partial' | 'graduated_complete';
} 

export interface BatchCreateData { 
    name: string; 
    start_year: number; 
    end_year: number; 
    session_type: 'fall' | 'spring';
    curriculum_version_id?: number; // New field for cloning
}

export interface BatchFlat {
    id: string;
    name: string;
    program_name: string;
    program_id: string;
    has_curriculum?: boolean;
}

const batchService = {
    getBatches: (programId: string) => 
        api.get<Batch[]>(`programs/${programId}/batches/`),
    
    getBatchById: (programId: string, batchId: string) => 
        api.get<Batch>(`programs/${programId}/batches/${batchId}/`),
    
    createBatch: (programId: string, data: BatchCreateData) => 
        api.post<Batch>(`programs/${programId}/batches/`, data),
    
    updateBatch: (programId: string, batchId: string, data: Partial<BatchCreateData>) => 
        api.patch<Batch>(`programs/${programId}/batches/${batchId}/`, data),
    
    advanceSemester: (programId: string, batchId: string) => 
        api.patch<Batch>(`programs/${programId}/batches/${batchId}/advance/`),
    
    graduateBatch: (programId: string, batchId: string) => 
        api.patch<{ success: boolean; message: string; batch_name: string; alumni_count: number }>(
            `programs/${programId}/batches/${batchId}/graduate/`
        ),
    
    deleteBatch: (programId: string, batchId: string) => 
        api.delete<{ success: boolean }>(`programs/${programId}/batches/${batchId}/delete/`),

    getAllBatches: () => 
        api.get<BatchFlat[]>('batches/all/'),
};

export default batchService;
