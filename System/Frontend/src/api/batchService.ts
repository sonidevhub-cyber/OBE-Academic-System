import { api } from './api';

export interface Batch { 
    id: string;
    name: string; 
    program: any; 
    program_id?: string;
    program_name?: string;
    start_year: number; 
    end_year: number; 
    session_type?: 'fall' | 'spring';
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
    is_graduating_eligible?: boolean;
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
    program?: any;
    program_name: string;
    program_id: string;
    start_year?: number;
    end_year?: number;
    session_type?: 'fall' | 'spring';
    current_semester?: number;
    student_count?: number;
    status?: 'active' | 'graduated';
    has_curriculum?: boolean;
    curriculum_version_id?: string | number | null;
    curriculum_version_no?: string | null;
}

export interface BatchStructureGA {
    id: string;
    order_number?: number;
    code?: string;
    title: string;
    description?: string;
    kpi_threshold?: number;
    is_active?: boolean;
}

export interface BatchStructurePEO {
    id: string;
    order_number?: number;
    title?: string | null;
    description: string;
    kpi_threshold?: number;
    is_active?: boolean;
    ga_mappings?: Array<{
        ga_id?: string;
        ga_code?: string;
        weight?: number | string;
    }>;
    keyword_mappings?: BatchStructurePOKeywordMapping[];
}

export interface BatchStructureVisionMission {
    id?: string;
    statement_type: 'VISION' | 'MISSION' | string;
    statement: string;
    keywords?: Array<{ id?: string; text?: string } | string>;
}

export interface BatchStructureCourse {
    course_id: string;
    course_name: string;
    course_code?: string;
    semester_number?: number | null;
    clos: Array<{
        clo_id: string;
        clo_number: string;
        title: string;
        mapped_gas: Array<{
            ga_id: string;
            ga_title: string;
            ga_code?: string;
        }>;
    }>;
}

export interface BatchStructureResponse {
    batch_id: string;
    batch_name: string;
    snapshot_locked_date: string | null;
    ga_snapshot: BatchStructureGA[];
    peo_snapshot: BatchStructurePEO[];
    vision_mission_snapshot: BatchStructureVisionMission[];
    ga_peo_mappings?: Array<{
        id?: string | null;
        po_id?: string | null;
        po_code: string;
        po_title?: string | null;
        ga_id?: string | null;
        ga_code: string;
        ga_title?: string | null;
        weight?: string | number | null;
    }>;
    po_keyword_mappings?: BatchStructurePOKeywordMapping[];
    vision_mission_mappings?: Array<{
        mapping_id?: string | null;
        mission_keyword_id?: string | null;
        mission_keyword?: string | null;
        vision_keyword_id?: string | null;
        vision_keyword?: string | null;
    }>;
    courses: BatchStructureCourse[];
}

export interface BatchStructurePOKeywordMapping {
    id?: string | null;
    mapping_id?: string | null;
    po_id?: string | null;
    peo_id?: string | null;
    po_code?: string;
    po_title?: string | null;
    mission_keyword?: string | null;
    vision_keyword?: string | null;
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

    getAllBatches: (params?: { alumni_feedback?: 'all' | string; program?: string }) => 
        api.get<BatchFlat[]>('batches/all/', { params }),

    getBatchStructure: (batchId: string, semester?: number | string) =>
        api.get<BatchStructureResponse>(`batches/${batchId}/structure/`, {
            params: semester ? { semester } : undefined,
        }),
};

export default batchService;
