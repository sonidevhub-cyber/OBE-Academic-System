import { api } from './api';

export interface Batch { 
    id: string;
    name: string; 
    program: string; 
    start_year: number; 
    end_year: number; 
    current_semester: number; 
    student_count: number; 
    is_active: boolean; 
    status: 'active' | 'graduated';
    curriculum_version_no?: string;
    graduated_at: string | null;
} 

export interface BatchCreateData { 
    name: string; 
    start_year: number; 
    end_year: number; 
    session_type: 'fall' | 'spring';
    curriculum_version_id?: string; // New field for cloning
}

export interface BatchFlat {
    id: string;
    name: string;
    program_name: string;
}

const batchService = {
    getBatches: (programId: string) => 
        api.get<Batch[]>(`programs/${programId}/batches/`),
    
    getBatchById: (programId: string, batchId: string) => 
        api.get<Batch>(`programs/${programId}/batches/${batchId}/`),
    
    createBatch: (programId: string, data: BatchCreateData) => 
        api.post<Batch>(`programs/${programId}/batches/`, data),
    
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