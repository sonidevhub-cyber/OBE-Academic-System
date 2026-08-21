import { api } from './api';

export interface StudentPromotion {
    id: string;
    custom_id?: string;
    full_name: string;
    email: string;
    current_semester: number;
    promotion_status: 'none' | 'provisional' | 'confirmed' | 'repeat' | 'freeze';
    original_batch: string | null;
}

export interface EligibleBatch {
    id: string;
    name: string;
    current_semester: number;
    session_type: 'fall' | 'spring';
    student_count: number;
}

export interface PendingTransferStudent {
    id: string;
    full_name: string;
    email: string;
    current_batch: string;
    original_batch: string | null;
    current_semester: number;
    session_type: 'fall' | 'spring';
    has_eligible_batch: boolean;
    promotion_status?: 'freeze';
}

export type DropoutRiskFlagType = 'CGPA_DECLINE' | 'RETAKE_EXHAUSTED';
export type DropoutRiskSeverity = 'WARNING' | 'CRITICAL';

export interface DropoutRiskFlag {
    flag_type: DropoutRiskFlagType;
    severity: DropoutRiskSeverity;
    triggering_details: Record<string, any>;
}

export interface StudentRiskFlags {
    student_id: string;
    flags: DropoutRiskFlag[];
}

export interface TransferData {
    new_batch_id: string;
}

export interface PromotionResponse {
    success: boolean;
    message: string;
    promoted_count?: number;
    confirmed_count?: number;
    new_semester?: number;
    student_name?: string;
    repeat_semester?: number;
    old_batch?: string;
    new_batch?: string;
    semester?: number;
}

const promotionService = {
    getBatchStudents: (programId: string, batchId: string) =>
        api.get<StudentPromotion[]>(`programs/${programId}/batches/${batchId}/students/`),

    promoteAllProvisionally: (programId: string, batchId: string) =>
        api.post<PromotionResponse>(`programs/${programId}/batches/${batchId}/promote-all/`),

    markAsRepeat: (programId: string, batchId: string, studentId: string) =>
        api.patch<PromotionResponse>(`programs/${programId}/batches/${batchId}/students/${studentId}/repeat/`),

    confirmAllPromotions: (programId: string, batchId: string) =>
        api.patch<PromotionResponse>(`programs/${programId}/batches/${batchId}/confirm-promotions/`),

    getEligibleBatches: (studentId: string) =>
        api.get<{ eligible_batches: EligibleBatch[]; has_eligible: boolean }>(`students/${studentId}/eligible-batches/`),

    transferStudent: (studentId: string, data: TransferData) =>
        api.patch<PromotionResponse>(`students/${studentId}/transfer/`, data),

    failDropStudent: (studentId: string, gpa: number) =>
        api.patch<PromotionResponse>(`students/${studentId}/fail-drop/`, { gpa }),

    getPendingTransfers: () =>
        api.get<PendingTransferStudent[]>(`students/pending-transfers/`),

    getRiskFlags: (batchId: string) =>
        api.get<StudentRiskFlags[]>(`students/risk-flags/`, { params: { batch_id: batchId } }),
};

export default promotionService;
