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
    graduated_at: string | null;
} 

export interface BatchCreateData { 
    name: string; 
    start_year: number; 
    end_year: number; 
    session_type: 'fall' | 'spring';
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

<<<<<<< HEAD
    getAllBatches: () => 
        api.get<BatchFlat[]>('batches/all/'),
};

export default batchService;
=======
    // Used for student/admin dropdowns.
    // Frontend expects flat payload: [{id,name,program_name}]
    getAllBatches: () => api.get<BatchFlat[]>('batches/all/'),
};

export default batchService;

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
