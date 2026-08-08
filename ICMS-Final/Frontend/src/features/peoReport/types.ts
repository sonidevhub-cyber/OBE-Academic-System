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
  achieved: number;
}

export interface PEOReportSummary {
  targetThreshold: number;
  overallStatus: 'achieved' | 'cqi_required';
  chartData: PEOReportSummaryItem[];
}

export interface PEOCQIRecord {
  id: string;
  peo_id: string;
  batch_id: string;
  root_cause: string | null;
  remedial_plan: string | null;
  status: string;
  is_locked: boolean;
  submitted_by: any;
}

export interface PEOReportMatrixItem {
  peoId: string;
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
}

export interface PEOQuestionBreakdownItem {
  questionText: string;
  avgScore: number | null;
  percentage: number | null;
  label: string;
  source?: 'Alumni Survey' | 'Employer Survey' | string;
  legacy?: boolean;
}

export interface PEOReportQuestionBreakdown {
  peoId: string;
  questions: PEOQuestionBreakdownItem[];
}

export interface PEOCQISection {
  peoId: string;
  rootCause: string | null;
  remedialPlan: string | null;
  cqiStatus: 'Closed' | 'Open';
  hodApprovedBy: string | null;
  hodApprovedDate: string | null;
  cqiPending: boolean;
}

export interface PEOReportSignatures {
  generatedBy: string;
  hodApprovedBy: string | null;
  hodApprovedDate: string | null;
}

export interface PEOReportData {
  header: PEOReportHeader;
  employmentStats: PEOEmploymentStats;
  indirectWeightConfig?: PEOIndirectWeightConfig;
  summary: PEOReportSummary;
  matrix: PEOReportMatrixItem[];
  questionBreakdown?: PEOReportQuestionBreakdown[];
  cqiSections?: PEOCQISection[];
  signatures: PEOReportSignatures;
}
