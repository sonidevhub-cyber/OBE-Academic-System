export interface PEOReportHeader {
  department: string;
  program: string;
  evaluationCycleYear: string;
  totalSurveyResponses: number;
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

export interface PEOReportMatrixItem {
  peoId: string;
  description: string;
  mappedQuestions: string[];
  directPercentage: number | null;
  indirectPercentage: number | null;
  combinedAttainmentPercentage: number | null;
  targetPercentage: number;
  status: 'Achieved' | 'CQI Triggered';
}

export interface PEOQuestionBreakdownItem {
  questionText: string;
  avgScore: number | null;
  percentage: number | null;
  label: string;
}

export interface PEOReportQuestionBreakdown {
  peoId: string;
  questions: PEOQuestionBreakdownItem[];
}

export interface PEOCQISection {
  peoId: string;
  identifiedWeakness: string;
  correctiveActionPlan: string;
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
  summary: PEOReportSummary;
  matrix: PEOReportMatrixItem[];
  questionBreakdown: PEOReportQuestionBreakdown[];
  cqiSections: PEOCQISection[];
  signatures: PEOReportSignatures;
}
