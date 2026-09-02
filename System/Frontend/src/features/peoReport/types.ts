export interface PEOReportHeader {
  department: string;
  program: string;
  evaluationCycleYear: string;
  totalSurveyResponses: number;
  totalAlumniSurveyResponses?: number;
  totalEmployerSurveyResponses?: number;
}

export interface PEOIndirectSourceBreakdown {
  percentage: number | null;
  responseCount: number;
  weight: number;
}

export interface PEOIndirectMeta {
  alumni: PEOIndirectSourceBreakdown;
  employer: PEOIndirectSourceBreakdown;
  totalResponses: number;
}

export interface PEOIndirectWeightConfig {
  alumniWeight: number;
  employerWeight: number;
}

export interface PEOEmploymentStatusItem {
  key: string;
  label: string;
  count: number;
}

export interface PEOEmploymentStats {
  employmentDistribution: PEOEmploymentStatusItem[];
  topEmployers: Array<{
    name: string;
    count: number;
  }>;
}

export interface PEOReportSummaryItem {
  peoId: string;
  target: number;
  achieved: number | null;
}

export interface PEOReportSummary {
  targetThreshold: number;
  overallStatus: 'achieved' | 'cqi_required';
  chartData: PEOReportSummaryItem[];
}

export interface PEOCQIRecord {
  id: string;
  peo?: string;
  peo_id: string;
  peo_code?: string | null;
  peo_title?: string | null;
  batch?: string;
  batch_id: string;
   root_cause: string | null;
   status: string;
  is_locked: boolean;
  submitted_by: any;
  implemented_in_batch?: string | null;
  implemented_in_batch_name?: string | null;
  action_taken_description?: string | null;
  resulting_attainment?: number | null;
  closed_by?: any | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
}

export interface PEOReportMatrixItem {
  peoId: string;
  peoCode?: string;
  description: string;
  mappedQuestions: string[];
  directPercentage: number | null;
  indirectPercentage: number | null;
  indirectBreakdown?: PEOIndirectMeta;
  indirectQuestionRows?: Array<PEOQuestionBreakdownItem & { source?: string; legacy?: boolean }>;
  combinedAttainmentPercentage: number | null;
  targetPercentage: number;
  status: 'Achieved' | 'CQI Triggered';
  cqiRecordId: string | null;
  cqiStatus: string | null;
   cqiIsLocked: boolean;
   rootCause?: string | null;
   implementedInBatch?: string | null;
  actionTaken?: string | null;
}

export interface PEOQuestionBreakdownItem {
  questionText: string;
  avgScore: number | null;
  percentage: number | null;
  label: string;
  source?: 'Alumni Survey' | 'Employer Survey' | string;
  legacy?: boolean;
  responseCount?: number;
}

export interface PEOReportQuestionBreakdown {
  peoId: string;
  questions: PEOQuestionBreakdownItem[];
}

export interface PEOCQISection {
  peoId: string;
  rootCause: string | null;
  cqiStatus: 'Closed' | 'Open';
  hodApprovedBy: string | null;
  hodApprovedDate: string | null;
  cqiPending: boolean;
  implementedInBatch?: string | null;
  actionTaken?: string | null;
}

export interface PEOReportSignatures {
  generatedBy: string;
  hodApprovedBy: string | null;
  hodApprovedDate: string | null;
}

export interface PEOEmployerComment {
  id: string;
  peoId: string | null;
  peoCode: string | null;
  peoTitle: string | null;
  questionText: string;
  comment: string;
  employerIdentifier: string | null;
  employerOrganization: string | null;
  employeeName: string | null;
  submittedAt: string | null;
}

export interface PEOReportData {
  header: PEOReportHeader;
  employmentStats: PEOEmploymentStats;
  employerComments?: PEOEmployerComment[];
  indirectWeightConfig?: PEOIndirectWeightConfig;
  summary: PEOReportSummary;
  matrix: PEOReportMatrixItem[];
  questionBreakdown?: PEOReportQuestionBreakdown[];
  cqiSections?: PEOCQISection[];
  signatures: PEOReportSignatures;
}
