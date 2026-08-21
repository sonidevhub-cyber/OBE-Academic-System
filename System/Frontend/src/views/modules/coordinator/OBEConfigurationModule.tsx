import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Award,
  Settings,
  BookOpen,
  Plus,
  Save,
  Trash2,
  Info,
  ChevronRight,
  LayoutGrid,
  Check,
  Lock,
  Unlock,
  GraduationCap,
  Briefcase,
  History,
  X,
} from 'lucide-react';
import obeService, {
  PEO,
  GA,
  ExitSurveyQuestion,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyType,
  VisionResponse,
  MissionResponse,
  VisionKeyword,
  MissionKeyword,
  VisionMissionMappingResponse,
  POKeywordMappingResponse,
  VisionMissionCQIReviewRecord,
} from '../../../api/obeService';
import peoService, { GAPEOMatrixWithWeight } from '../../../api/peoService';
import academicStructureService, { Program, Course } from '../../../api/academicStructureService';
import { curriculumService, CurriculumVersion, CurriculumCourse } from '../../../api/curriculumService';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

export type OBEMappingSubTabId = 'vision-mission' | 'peo' | 'ga' | 'vision-mission-map' | 'po-keywords' | 'ga-peo' | 'clo-pi';

interface OBEConfigurationModuleProps {
  initialSubTab?: OBEMappingSubTabId;
  hideSubTabs?: boolean;
}

interface SurveyQuestionDraft {
  _tempId?: string;
  id?: string;
  peo_id?: string | null;
  is_general: boolean;
  question_text: string;
  question_type: SurveyQuestionType;
  custom_options: string[];
  is_locked: boolean;
  is_active: boolean;
  _dirty?: boolean;
  _deleted?: boolean;
}

const makeTempId = () => `t_${Math.random().toString(36).slice(2, 10)}`;

const ALUMNI_TEMPLATE_PREFIX = 'To what extent are you achieving this objective in your current professional role:';
const EMPLOYER_TEMPLATE_PREFIX = 'To what extent does the graduate demonstrate this objective in their professional role:';
const DEFAULT_SURVEY_OPTIONS = ['Poor', 'Below Average', 'Average', 'Good', 'Excellent'];

const normalizeOptions = (options?: string[] | null) =>
  (Array.isArray(options) ? options : [])
    .map(option => String(option).trim())
    .filter(Boolean);

const getDraftOptions = (draft: SurveyQuestionDraft) =>
  normalizeOptions(draft.custom_options).length > 0
    ? normalizeOptions(draft.custom_options)
    : [...DEFAULT_SURVEY_OPTIONS];

const coerceWeight = (weight: number | string | null | undefined): number => {
  const num = Number(weight);
  return Number.isFinite(num) ? num : 0;
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const splitEvenlyWithRounding = (ids: string[], total: number) => {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;
  if (ids.length === 1) {
    result.set(ids[0], roundToTwo(total));
    return result;
  }

  const base = roundToTwo(total / ids.length);
  let allocated = 0;
  ids.forEach((id, index) => {
    const value = index === ids.length - 1 ? roundToTwo(total - allocated) : base;
    allocated += value;
    result.set(id, value);
  });
  return result;
};

const OBEConfigurationModule: React.FC<OBEConfigurationModuleProps> = ({
  initialSubTab,
  hideSubTabs = false,
}) => {
  const { currentUser } = useAuth();
  const isHOD = currentUser?.effective_role === 'hod' || currentUser?.role === 'hod';
  const [activeSubTab, setActiveSubTab] = useState<OBEMappingSubTabId>(initialSubTab || (isHOD ? 'vision-mission' : 'clo-pi'));
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [versions, setVersions] = useState<CurriculumVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<CurriculumVersion | null>(null);
  const [selectedVersionDetail, setSelectedVersionDetail] = useState<CurriculumVersion | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [clos, setClos] = useState<any[]>([]);

  // Vision & Mission State
  const [vision, setVision] = useState('');
  const [mission, setMission] = useState('');
  const [departmentVision, setDepartmentVision] = useState<VisionResponse | null>(null);
  const [departmentMission, setDepartmentMission] = useState<MissionResponse | null>(null);
  const [visionKeywords, setVisionKeywords] = useState<VisionKeyword[]>([]);
  const [missionKeywords, setMissionKeywords] = useState<MissionKeyword[]>([]);
  const [visionCandidates, setVisionCandidates] = useState<string[]>([]);
  const [missionCandidates, setMissionCandidates] = useState<string[]>([]);
  const [selectedVisionKeywords, setSelectedVisionKeywords] = useState<Set<string>>(new Set());
  const [selectedMissionKeywords, setSelectedMissionKeywords] = useState<Set<string>>(new Set());
  const [manualKeywordInputs, setManualKeywordInputs] = useState<Record<'vision' | 'mission', string>>({
    vision: '',
    mission: '',
  });
  const [visionMissionData, setVisionMissionData] = useState<VisionMissionMappingResponse | null>(null);
  const [poKeywordData, setPoKeywordData] = useState<POKeywordMappingResponse | null>(null);
  const [isSavingVision, setIsSavingVision] = useState(false);
  const [showVisionMissionHistory, setShowVisionMissionHistory] = useState(false);
  const [visionMissionReviews, setVisionMissionReviews] = useState<VisionMissionCQIReviewRecord[]>([]);
  const [loadingVisionMissionHistory, setLoadingVisionMissionHistory] = useState(false);
  const [revisionModal, setRevisionModal] = useState<{
    type: 'vision' | 'mission';
    previousStatement: string;
    newStatement: string;
  } | null>(null);
  const [revisionJustification, setRevisionJustification] = useState('');
  const [revisionTriggerType, setRevisionTriggerType] = useState<'MANUAL' | 'SCHEDULED'>('MANUAL');

  // PEO/GA/CLO States
  const [peos, setPeos] = useState<PEO[]>([]);
  const [gas, setGas] = useState<GA[]>([]);
  const [exitSurveyQuestions, setExitSurveyQuestions] = useState<ExitSurveyQuestion[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'peo' | 'ga' | 'clo'>('peo');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [alumniSurveyDrafts, setAlumniSurveyDrafts] = useState<SurveyQuestionDraft[]>([]);
  const [employerSurveyDrafts, setEmployerSurveyDrafts] = useState<SurveyQuestionDraft[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    order_number: 1,
    kpi_target: 60,
    bloom_level: 'K2',
    performance_indicators: [] as any[],
    alumni_survey_question_text: '',
    exit_survey_question_text: ''
  });

  // Add General Question Modal States
  const [isAddGeneralOpen, setIsAddGeneralOpen] = useState(false);
  const [generalStep, setGeneralStep] = useState<'select' | 'form'>('select');
  const [generalSurveyType, setGeneralSurveyType] = useState<'ALUMNI' | 'EMPLOYER' | null>(null);
  const [generalQuestionText, setGeneralQuestionText] = useState('');
  const [generalQuestionType, setGeneralQuestionType] = useState<SurveyQuestionType>('RATING_SCALE');
  const [generalCustomOptions, setGeneralCustomOptions] = useState<string[]>([...DEFAULT_SURVEY_OPTIONS]);
  const [generalLocked, setGeneralLocked] = useState(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Matrix States
  const [gaPeoMatrix, setGaPeoMatrix] = useState<GAPEOMatrixWithWeight | null>(null);
  const [cloPiMatrix, setCloPiMatrix] = useState<any>(null);
  const [matrixChanges, setMatrixChanges] = useState<Set<string>>(new Set());

  const getGaSelectedPeoIds = (matrix: any, gaId: string, mappings: any) => {
    return (matrix?.peos || [])
      .map((peo: any) => peo.id)
      .filter((peoId: string) => mappings.some((m: any) =>
        (m.ga === gaId || m.ga_id === gaId) && (m.peo === peoId || m.peo_id === peoId)
      ));
  };

  const normalizeGaRowWeights = (matrix: any, gaId: string, mappings: any[]) => {
    const selectedPeoIds = getGaSelectedPeoIds(matrix, gaId, mappings);
    if (selectedPeoIds.length === 0) return mappings;

    const equalWeights = splitEvenlyWithRounding(selectedPeoIds, 100);
    return mappings.map((m: any) => {
      const isRowCell = (m.ga === gaId || m.ga_id === gaId) && selectedPeoIds.includes(m.peo || m.peo_id);
      const peoId = m.peo || m.peo_id;
      return isRowCell && peoId ? { ...m, weight: equalWeights.get(peoId) ?? 0 } : m;
    });
  };

  const gaRowTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    gaPeoMatrix?.gas.forEach(ga => {
      totals[ga.id] = gaPeoMatrix.mappings
        .filter(m => (m.ga === ga.id || m.ga_id === ga.id))
        .reduce((sum, m) => sum + coerceWeight(m.weight), 0);
    });
    return totals;
  }, [gaPeoMatrix]);

  const isGaPeoMatrixValid = useMemo(() => {
    if (!gaPeoMatrix || gaPeoMatrix.gas.length === 0) return false;
    return gaPeoMatrix.gas.every(ga => {
      const selectedCount = gaPeoMatrix.mappings.filter(m => (m.ga === ga.id || m.ga_id === ga.id)).length;
      if (selectedCount === 0) return true;
      return Math.abs((gaRowTotals[ga.id] || 0) - 100) < 0.0001;
    });
  }, [gaPeoMatrix, gaRowTotals]);

  const getExitSurveyGaId = (question: ExitSurveyQuestion) =>
    typeof question.ga === 'string' ? question.ga : question.ga.id;

  const getSurveyQuestionPeoId = (question: SurveyQuestion) => {
    if (question.peo_id) return question.peo_id;
    if (typeof question.peo === 'string') return question.peo;
    return question.peo?.id || null;
  };

  const activeSurveyQuestions = useMemo(
    () => surveyQuestions.filter(question => question.is_active),
    [surveyQuestions]
  );

  const selectedDepartmentId = useMemo(() => {
    const program = selectedProgram as any;
    return program?.department ? String(program.department) : '';
  }, [selectedProgram]);

  useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const getSurveyQuestionPeo = (question: SurveyQuestion) => {
    const peoId = getSurveyQuestionPeoId(question);
    return peoId ? peos.find(peo => peo.id === peoId) || null : null;
  };

  const getSurveyQuestionScopeLabel = (question: SurveyQuestion) => {
    const peo = getSurveyQuestionPeo(question);
    if (!peo) return 'General';
    return `PO-${peo.order_number}`;
  };

  const renderSurveyQuestionList = (surveyType: SurveyType) => {
    const isAlumni = surveyType === 'ALUMNI';
    const questions = activeSurveyQuestions
      .filter(question => question.survey_type === surveyType)
      .sort((a, b) => {
        const aPeo = getSurveyQuestionPeo(a);
        const bPeo = getSurveyQuestionPeo(b);
        const aOrder = aPeo?.order_number ?? 0;
        const bOrder = bPeo?.order_number ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.created_at.localeCompare(b.created_at);
      });

    return (
      <div className={`rounded-2xl border p-5 ${
        isAlumni ? 'border-indigo-100 bg-indigo-50/20' : 'border-emerald-100 bg-emerald-50/20'
      }`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
              isAlumni ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}>
              {isAlumni ? <GraduationCap size={18} /> : <Briefcase size={18} />}
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider">
                {isAlumni ? 'Alumni Survey Questions' : 'Employer Survey Questions'}
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">{questions.length} active questions</p>
            </div>
          </div>
          <span className={`text-xs font-black px-3 py-1 rounded-full ${
            isAlumni ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {questions.filter(question => !getSurveyQuestionPeoId(question)).length} General
          </span>
        </div>

        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm font-semibold text-gray-400">
              No {isAlumni ? 'alumni' : 'employer'} survey questions yet.
            </div>
          ) : (
            questions.map((question, index) => {
              const peo = getSurveyQuestionPeo(question);
              return (
                <div key={question.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                        isAlumni ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        Q{index + 1}
                      </span>
                      <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                        peo ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {getSurveyQuestionScopeLabel(question)}
                      </span>
                      {question.is_locked && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
                          <Lock size={12} />
                          Locked
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
                        {question.question_type === 'TEXT'
                          ? 'Text Box'
                          : question.question_type === 'SINGLE_SELECT'
                            ? 'Custom Options'
                            : 'Rating Options'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-gray-700">{question.question_text}</p>
                  {question.question_type !== 'TEXT' && (
                    <p className="mt-2 text-xs font-semibold text-gray-400">
                      Options: {(question.effective_options?.length ? question.effective_options : question.custom_options || DEFAULT_SURVEY_OPTIONS).join(', ')}
                    </p>
                  )}
                  {peo && (
                    <p className="mt-2 text-xs font-semibold text-gray-400 truncate">
                      Mapped with {peo.title}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const res = await academicStructureService.getPrograms();
      setPrograms(res.data);
      if (res.data.length > 0) {
        setSelectedProgram(res.data[0]);
      }
    } catch (error) {
      toast.error('Failed to load programs');
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedProgram) {
      loadPeosAndGas(selectedProgram.id);
      loadVersions(selectedProgram.id);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (isHOD && selectedDepartmentId) {
      loadVisionMissionData();
    } else {
      setVision('');
      setMission('');
      setDepartmentVision(null);
      setDepartmentMission(null);
      setVisionKeywords([]);
      setMissionKeywords([]);
    }
  }, [isHOD, selectedDepartmentId]);

  useEffect(() => {
    const fetchVersionDetail = async () => {
      if (selectedVersion?.id) {
        try {
          const res = await curriculumService.getVersion(selectedVersion.id);
          const versionData = Array.isArray(res.data) ? res.data[0] : (res.data as any).data || res.data;
          setSelectedVersionDetail(versionData);

          // Extract courses from courses_by_semester and sort by semester number
          const extractedCourses: Course[] = [];
          if (versionData.courses_by_semester) {
            Object.values(versionData.courses_by_semester).forEach((semesterCourses: any) => {
              semesterCourses.forEach((vc: CurriculumCourse) => {
                extractedCourses.push({
                  id: vc.course,
                  name: vc.course_name,
                  code: vc.course_code,
                  course_type: vc.course_type as 'LECTURE' | 'LAB',
                  credit_hours: vc.credit_hours,
                  semester_id: '',
                  program_id: versionData.program.toString(),
                  semester_number: vc.semester_no
                });
              });
            });
          }
          // Sort courses by semester number, then code
          extractedCourses.sort((a, b) => {
            if (a.semester_number !== b.semester_number) {
              return (a.semester_number || 0) - (b.semester_number || 0);
            }
            return a.code.localeCompare(b.code);
          });
          setCourses(extractedCourses);
        } catch (error) {
          console.error('Failed to fetch version detail:', error);
          setCourses([]);
        }
      } else {
        setSelectedVersionDetail(null);
        setCourses([]);
      }
    };
    fetchVersionDetail();
  }, [selectedVersion]);

  useEffect(() => {
    if (selectedCourse && selectedVersion) {
      loadClos(selectedCourse.id, selectedVersion.id);
    }
  }, [selectedCourse, selectedVersion]);

  const loadPeosAndGas = async (programId: string) => {
    if (!programId) return;
    try {
      const [peoRes, gaRes, questionsRes, flexQsRes] = await Promise.all([
        obeService.getPEOs(programId),
        obeService.getGAs(programId),
        obeService.getExitSurveyQuestions(),
        obeService.getSurveyQuestions(programId).catch(() => [] as SurveyQuestion[]),
      ]);
      setPeos(Array.isArray(peoRes) ? peoRes : (peoRes as any).data || []);
      setGas(Array.isArray(gaRes) ? gaRes : (gaRes as any).data || []);
      setExitSurveyQuestions(Array.isArray(questionsRes) ? questionsRes : (questionsRes as any).data || []);
      setSurveyQuestions(Array.isArray(flexQsRes) ? flexQsRes : (flexQsRes as any).data || []);
    } catch (error) {
      console.error('Failed to load POs/GAs:', error);
      setPeos([]);
      setGas([]);
      setExitSurveyQuestions([]);
      setSurveyQuestions([]);
    }
  };

  const buildDraftsForPEO = (peoId: string, survey_type: SurveyType): SurveyQuestionDraft[] => {
    return surveyQuestions
      .filter((q) => q.survey_type === survey_type && (q.peo_id === peoId || (q.peo && (q.peo === peoId || (typeof q.peo === 'object' && (q.peo as any).id === peoId)))))
      .map((q) => ({
        _tempId: makeTempId(),
        id: q.id,
        peo_id: q.peo_id ?? (typeof q.peo === 'object' ? (q.peo as any).id : q.peo) ?? peoId,
        is_general: !q.peo && !q.peo_id,
        question_text: q.question_text,
        question_type: q.question_type || 'RATING_SCALE',
        custom_options: normalizeOptions(q.custom_options || q.effective_options),
        is_locked: q.is_locked,
        is_active: q.is_active,
        _dirty: false,
        _deleted: false,
      }));
  };

  const addBlankQuestionDraft = (drafts: SurveyQuestionDraft[], peoId: string, is_general = false): SurveyQuestionDraft[] => {
    return [
      ...drafts,
      {
        _tempId: makeTempId(),
        peo_id: is_general ? null : peoId,
        is_general,
        question_text: '',
        question_type: 'RATING_SCALE',
        custom_options: [...DEFAULT_SURVEY_OPTIONS],
        is_locked: false,
        is_active: true,
        _dirty: true,
      },
    ];
  };

  const persistSurveyQuestionDrafts = async (
    programId: string,
    peoId: string,
    drafts: SurveyQuestionDraft[],
    survey_type: SurveyType,
  ) => {
    for (const d of drafts) {
      try {
        if (d._deleted && d.id) {
          await obeService.deleteSurveyQuestion(d.id);
        } else if (!d._deleted && !d.id) {
          await obeService.createSurveyQuestion({
            survey_type,
            program: programId,
            peo: d.is_general ? null : peoId,
            question_text: d.question_text,
            question_type: d.question_type,
            custom_options: d.question_type === 'TEXT' ? [] : normalizeOptions(d.custom_options),
            is_locked: d.is_locked,
            is_active: d.is_active,
          });
        } else if (!d._deleted && d.id && d._dirty) {
          await obeService.updateSurveyQuestion(d.id, {
            question_text: d.question_text,
            question_type: d.question_type,
            custom_options: d.question_type === 'TEXT' ? [] : normalizeOptions(d.custom_options),
            is_locked: d.is_locked,
            is_active: d.is_active,
            peo: d.is_general ? null : peoId,
          });
        }
      } catch (err) {
        console.error(`Failed to persist ${survey_type} survey question ${d.id || d._tempId}:`, err);
        toast.error(`Failed to save one ${survey_type} survey question. Review and retry.`);
      }
    }
  };

  const loadVersions = async (programId: string) => {
    if (!programId) return;
    try {
      const res = await curriculumService.getVersions({ program: programId, status: 'draft' });
      const versionData = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setVersions(versionData);
      if (versionData.length > 0) {
        setSelectedVersion(versionData[0]);
      } else {
        setSelectedVersion(null);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
      setVersions([]);
      setSelectedVersion(null);
    }
  };

  const loadCourses = async (programId: string) => {
    if (!programId) return;
    try {
      const res = await academicStructureService.getCourses(programId);
      const courseData = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setCourses(courseData);
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCourses([]);
    }
  };

  const loadClos = async (courseId: string, versionId: string) => {
    if (!courseId || !versionId) return;
    try {
      const res = await obeService.getCLOs(courseId, versionId);
      setClos(Array.isArray(res) ? res : (res as any).data || []);
    } catch (error) {
      console.error('Failed to load CLOs:', error);
      setClos([]);
    }
  };

  const getApiMessage = (error: any, fallback: string) =>
    error?.response?.data?.error || error?.response?.data?.message || fallback;

  const loadVisionMissionData = async () => {
    if (!selectedDepartmentId) return;
    try {
      const [visionRes, missionRes] = await Promise.all([
        obeService.getDepartmentVision(selectedDepartmentId),
        obeService.getDepartmentMission(selectedDepartmentId),
      ]);
      setDepartmentVision(visionRes);
      setDepartmentMission(missionRes);
      setVision(visionRes.statement || '');
      setMission(missionRes.statement || '');
      setVisionKeywords(visionRes.keywords || []);
      setMissionKeywords(missionRes.keywords || []);
      setSelectedVisionKeywords(new Set());
      setSelectedMissionKeywords(new Set());
    } catch (error: any) {
      toast.error(getApiMessage(error, 'You are not authorized to manage Vision and Mission.'));
    }
  };

  const loadVisionMissionHistory = async () => {
    if (!selectedDepartmentId) {
      toast.error('Program information is missing.');
      return;
    }
    setLoadingVisionMissionHistory(true);
    try {
      const reviews = await obeService.getVisionMissionCQIReviews();
      setVisionMissionReviews(
        reviews.filter((review) => String(review.department || '') === selectedDepartmentId)
      );
      setShowVisionMissionHistory(true);
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to load Vision/Mission history'));
    } finally {
      setLoadingVisionMissionHistory(false);
    }
  };

  const loadVisionMissionMappings = async () => {
    if (!selectedDepartmentId) return;
    try {
      const data = await obeService.getVisionMissionMappings(selectedDepartmentId);
      setVisionMissionData(data);
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to load Vision-Mission mappings'));
    }
  };

  const loadPOKeywordMappings = async () => {
    if (!selectedProgram?.id) return;
    try {
      const data = await obeService.getPOKeywordMappings(selectedProgram.id);
      setPoKeywordData(data);
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to load PO keyword mappings'));
    }
  };

  const openStatementRevision = (type: 'vision' | 'mission', previousStatement: string, newStatement: string) => {
    setRevisionModal({ type, previousStatement, newStatement });
    setRevisionJustification('');
    setRevisionTriggerType('MANUAL');
  };

  const handleSaveVision = async () => {
    if (!selectedDepartmentId) {
      toast.error('Department information is missing for this program.');
      return;
    }
    if (!vision.trim()) {
      toast.error('Vision statement cannot be empty.');
      return;
    }
    if (departmentVision?.id) {
      const previous = departmentVision.statement || '';
      if (previous.trim() === vision.trim()) {
        toast.info('Vision statement has no changes to save.');
        return;
      }
      openStatementRevision('vision', previous, vision.trim());
      return;
    }
    setIsSavingVision(true);
    try {
      const saved = await obeService.saveDepartmentVision(selectedDepartmentId, vision.trim());
      setDepartmentVision(saved);
      setVision(saved.statement || '');
      setVisionKeywords(saved.keywords || []);
      toast.success('Vision statement saved');
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save Vision statement'));
    } finally {
      setIsSavingVision(false);
    }
  };

  const handleSaveMission = async () => {
    if (!selectedDepartmentId) {
      toast.error('Department information is missing for this program.');
      return;
    }
    if (!mission.trim()) {
      toast.error('Mission statement cannot be empty.');
      return;
    }
    if (departmentMission?.id) {
      const previous = departmentMission.statement || '';
      if (previous.trim() === mission.trim()) {
        toast.info('Mission statement has no changes to save.');
        return;
      }
      openStatementRevision('mission', previous, mission.trim());
      return;
    }
    setIsSavingVision(true);
    try {
      const saved = await obeService.saveDepartmentMission(selectedDepartmentId, mission.trim());
      setDepartmentMission(saved);
      setMission(saved.statement || '');
      setMissionKeywords(saved.keywords || []);
      toast.success('Mission statement saved');
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save Mission statement'));
    } finally {
      setIsSavingVision(false);
    }
  };

  const handleConfirmStatementRevision = async () => {
    if (!revisionModal || !selectedDepartmentId) return;
    if (!revisionJustification.trim()) {
      toast.error('Revision justification is required.');
      return;
    }

    const statementType = revisionModal.type === 'vision' ? 'VISION' : 'MISSION';
    setIsSavingVision(true);
    try {
      await obeService.createVisionMissionCQIReview({
        department: selectedDepartmentId,
        statement_type: statementType,
        trigger_type: revisionTriggerType,
        decision: 'REVISED',
        justification: revisionJustification.trim(),
        new_statement: revisionModal.newStatement.trim(),
      });

      if (revisionModal.type === 'vision') {
        setVisionCandidates((await obeService.extractKeywords('vision', revisionModal.newStatement)).candidates || []);
        setSelectedVisionKeywords(new Set());
      } else {
        setMissionCandidates((await obeService.extractKeywords('mission', revisionModal.newStatement)).candidates || []);
        setSelectedMissionKeywords(new Set());
      }

      setRevisionModal(null);
      setRevisionJustification('');
      await loadVisionMissionData();
      if (activeSubTab === 'vision-mission-map') await loadVisionMissionMappings();
      if (activeSubTab === 'po-keywords') await loadPOKeywordMappings();
      toast.success(`${statementType === 'VISION' ? 'Vision' : 'Mission'} revised. Review keywords and refresh mappings for the new statement.`);
    } catch (error: any) {
      toast.error(getApiMessage(error, `Failed to revise ${revisionModal.type} statement`));
    } finally {
      setIsSavingVision(false);
    }
  };

  const handleExtractKeywords = async (sourceType: 'vision' | 'mission') => {
    const text = sourceType === 'vision' ? vision : mission;
    if (!text.trim()) {
      toast.error(`${sourceType === 'vision' ? 'Vision' : 'Mission'} statement cannot be empty.`);
      return;
    }
    try {
      const res = await obeService.extractKeywords(sourceType, text);
      if (sourceType === 'vision') setVisionCandidates(res.candidates || []);
      else setMissionCandidates(res.candidates || []);
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to extract keywords'));
    }
  };

  const handleSaveKeywords = async (sourceType: 'vision' | 'mission') => {
    const isVision = sourceType === 'vision';
    const sourceId = isVision ? departmentVision?.id : departmentMission?.id;
    const selected = Array.from(isVision ? selectedVisionKeywords : selectedMissionKeywords);
    if (!sourceId) {
      toast.error(`Save the ${isVision ? 'Vision' : 'Mission'} statement before adding keywords.`);
      return;
    }
    if (selected.length === 0) {
      toast.error('Select at least one keyword.');
      return;
    }
    try {
      const saved = isVision
        ? await obeService.saveVisionKeywords(sourceId, selected)
        : await obeService.saveMissionKeywords(sourceId, selected);
      if (isVision) {
        setVisionKeywords(saved as VisionKeyword[]);
        setSelectedVisionKeywords(new Set());
      } else {
        setMissionKeywords(saved as MissionKeyword[]);
        setSelectedMissionKeywords(new Set());
      }
      await loadVisionMissionData();
      toast.success('Keywords saved');
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save keywords'));
    }
  };

  const handleManualKeywordSubmit = async (sourceType: 'vision' | 'mission') => {
    const isVision = sourceType === 'vision';
    const sourceId = isVision ? departmentVision?.id : departmentMission?.id;
    const text = manualKeywordInputs[sourceType].trim();

    if (!sourceId) {
      toast.error(`Save the ${isVision ? 'Vision' : 'Mission'} statement before adding keywords.`);
      return;
    }

    if (!text) return;

    const existingKeywords = isVision ? visionKeywords : missionKeywords;
    if (existingKeywords.some(keyword => keyword.text.trim().toLowerCase() === text.toLowerCase())) {
      toast.error('This keyword is already approved.');
      return;
    }

    try {
      const saved = isVision
        ? await obeService.saveVisionKeywords(sourceId, [text])
        : await obeService.saveMissionKeywords(sourceId, [text]);

      if (isVision) {
        setVisionKeywords(saved as VisionKeyword[]);
      } else {
        setMissionKeywords(saved as MissionKeyword[]);
      }

      setManualKeywordInputs(prev => ({ ...prev, [sourceType]: '' }));
      await loadVisionMissionData();
      toast.success('Keyword added');
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to add keyword'));
    }
  };

  const handleRemoveKeyword = async (sourceType: 'vision' | 'mission', keywordId: string) => {
    const sourceId = sourceType === 'vision' ? departmentVision?.id : departmentMission?.id;
    if (!sourceId) return;
    try {
      if (sourceType === 'vision') await obeService.removeVisionKeyword(sourceId, keywordId);
      else await obeService.removeMissionKeyword(sourceId, keywordId);
      await loadVisionMissionData();
      toast.success('Keyword removed');
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to remove keyword'));
    }
  };

  const handleOpenModal = (type: 'peo' | 'ga' | 'clo', item?: any) => {
    setModalType(type);
    setEditingItem(item || null);
    
    let alumniSurveyQuestion = '';
    let exitSurveyQuestion = '';
    if (type === 'peo' && item) {
      alumniSurveyQuestion = item.alumni_survey_question_text || (
        item.description
          ? `${ALUMNI_TEMPLATE_PREFIX} ${item.description}`
          : ''
      );
    }

    if (type === 'ga' && item) {
      const question = exitSurveyQuestions.find(q => getExitSurveyGaId(q) === item.id || q.ga_id === item.id);
      if (question) {
        exitSurveyQuestion = question.question_text;
      } else {
        exitSurveyQuestion = `I am confident in ${item.description}`;
      }
    } else if (type === 'ga') {
      exitSurveyQuestion = '';
    }

    if (type === 'peo') {
      if (item && item.id) {
        const existingAlumni = buildDraftsForPEO(item.id, 'ALUMNI');
        const existingEmployer = buildDraftsForPEO(item.id, 'EMPLOYER');
        if (existingAlumni.length > 0) {
          setAlumniSurveyDrafts(existingAlumni);
        } else {
          setAlumniSurveyDrafts([
            {
              _tempId: makeTempId(),
              peo_id: item.id,
              is_general: false,
              question_text: alumniSurveyQuestion || `${ALUMNI_TEMPLATE_PREFIX} ${item.description || ''}`.trim(),
              question_type: 'RATING_SCALE',
              custom_options: [...DEFAULT_SURVEY_OPTIONS],
              is_locked: false,
              is_active: true,
              _dirty: true,
            },
          ]);
        }
        if (existingEmployer.length > 0) {
          setEmployerSurveyDrafts(existingEmployer);
        } else {
          setEmployerSurveyDrafts([
            {
              _tempId: makeTempId(),
              peo_id: item.id,
              is_general: false,
              question_text: item.description ? `${EMPLOYER_TEMPLATE_PREFIX} ${item.description}` : '',
              question_type: 'RATING_SCALE',
              custom_options: [...DEFAULT_SURVEY_OPTIONS],
              is_locked: false,
              is_active: true,
              _dirty: true,
            },
          ]);
        }
      } else {
        setAlumniSurveyDrafts([
          {
            _tempId: makeTempId(),
            is_general: false,
            question_text: '',
            question_type: 'RATING_SCALE',
            custom_options: [...DEFAULT_SURVEY_OPTIONS],
            is_locked: false,
            is_active: true,
            _dirty: true,
          },
        ]);
        setEmployerSurveyDrafts([
          {
            _tempId: makeTempId(),
            is_general: false,
            question_text: '',
            question_type: 'RATING_SCALE',
            custom_options: [...DEFAULT_SURVEY_OPTIONS],
            is_locked: false,
            is_active: true,
            _dirty: true,
          },
        ]);
      }
    } else {
      setAlumniSurveyDrafts([]);
      setEmployerSurveyDrafts([]);
    }

    setFormData(item ? { 
      title: item.title, 
      description: item.description, 
      order_number: item.order_number,
      kpi_target: item.kpi_target || item.kpi_threshold || 60,
      bloom_level: item.bloom_level || 'K2',
      performance_indicators: [],
      alumni_survey_question_text: alumniSurveyQuestion,
      exit_survey_question_text: exitSurveyQuestion
    } : { 
      title: '', 
      description: '', 
      order_number: (type === 'peo' ? peos.length : type === 'ga' ? gas.length : clos.length) + 1,
      kpi_target: 60,
      bloom_level: 'K2',
      performance_indicators: [],
      alumni_survey_question_text: '',
      exit_survey_question_text: ''
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;

    try {
      if (modalType === 'peo') {
        const firstAlumniText = alumniSurveyDrafts.find(d => !d._deleted)?.question_text || '';
        const fallbackLegacyQuestion = firstAlumniText || (formData.description ? `${ALUMNI_TEMPLATE_PREFIX} ${formData.description}` : '');
        const peoData = {
          ...formData,
          kpi_threshold: formData.kpi_target,
          alumni_survey_question_text: fallbackLegacyQuestion,
        };
        let peoId: string;
        let created: PEO | null = null;
        if (editingItem) {
          await obeService.updatePEO(editingItem.id, peoData);
          peoId = editingItem.id;
          toast.success('PO updated');
        } else {
          created = await obeService.createPEO(selectedProgram.id, peoData);
          peoId = created.id;
          toast.success('PO created');
        }
        const alumniPrepared = alumniSurveyDrafts.map(d => ({
          ...d,
          peo_id: peoId,
          is_general: false,
          question_text: (d.question_text || `${ALUMNI_TEMPLATE_PREFIX} ${formData.description || ''}`.trim()),
        }));
        const employerPrepared = employerSurveyDrafts.map(d => ({
          ...d,
          peo_id: peoId,
          is_general: false,
          question_text: (d.question_text || `${EMPLOYER_TEMPLATE_PREFIX} ${formData.description || ''}`.trim()),
        }));
        await persistSurveyQuestionDrafts(selectedProgram.id, peoId, alumniPrepared, 'ALUMNI');
        await persistSurveyQuestionDrafts(selectedProgram.id, peoId, employerPrepared, 'EMPLOYER');
        loadPeosAndGas(selectedProgram.id);
      } else if (modalType === 'ga') {
        // Prepare data with kpi_threshold and exit survey question
        const gaData = {
          ...formData,
          kpi_threshold: formData.kpi_target,
          exit_survey_question_text: formData.exit_survey_question_text || (formData.description ? `I am confident in ${formData.description}` : '')
        };
        if (editingItem) {
          await obeService.updateGA(editingItem.id, gaData);
          toast.success('GA updated');
        } else {
          await obeService.createGA(selectedProgram.id, gaData);
          toast.success('GA created');
        }
        loadPeosAndGas(selectedProgram.id);
      } else if (modalType === 'clo') {
        if (!selectedCourse || !selectedVersion) return;
        if (editingItem) {
          await obeService.updateCLO(editingItem.id, formData);
          toast.success('CLO updated');
        } else {
          await obeService.createCLO(selectedCourse.id, selectedVersion.id, formData);
          toast.success('CLO created');
        }
        loadClos(selectedCourse.id, selectedVersion.id);
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Failed to save item');
    }
  };

  const handleDeleteItem = async (type: 'peo' | 'ga' | 'clo', id: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type.toUpperCase()}?`)) return;
    try {
      if (type === 'peo') await obeService.deletePEO(id);
      else if (type === 'ga') await obeService.deleteGA(id);
      else if (type === 'clo') await obeService.deleteCLO(id);
      toast.success(`${type.toUpperCase()} deleted`);
      if (type === 'clo') loadClos(selectedCourse!.id, selectedVersion!.id);
      else loadPeosAndGas(selectedProgram!.id);
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const openAddGeneralModal = () => {
    setGeneralStep('select');
    setGeneralSurveyType(null);
    setGeneralQuestionText('');
    setGeneralQuestionType('RATING_SCALE');
    setGeneralCustomOptions([...DEFAULT_SURVEY_OPTIONS]);
    setGeneralLocked(false);
    setIsAddGeneralOpen(true);
  };

  const handleSaveGeneralQuestion = async () => {
    if (!selectedProgram || !generalSurveyType || !generalQuestionText.trim()) return;
    const cleanedOptions = normalizeOptions(generalCustomOptions);
    if (generalQuestionType !== 'TEXT' && cleanedOptions.length === 0) {
      toast.error('Please add at least one answer option.');
      return;
    }
    setIsSavingGeneral(true);
    try {
      await obeService.createSurveyQuestion({
        survey_type: generalSurveyType,
        program: selectedProgram.id,
        peo: null,
        question_text: generalQuestionText.trim(),
        question_type: generalQuestionType,
        custom_options: generalQuestionType === 'TEXT' ? [] : cleanedOptions,
        is_locked: generalLocked,
        is_active: true,
      });
      toast.success(`${generalSurveyType.toLowerCase()} general question added`);
      setIsAddGeneralOpen(false);
      setGeneralStep('select');
      setGeneralSurveyType(null);
      setGeneralQuestionText('');
      setGeneralQuestionType('RATING_SCALE');
      setGeneralCustomOptions([...DEFAULT_SURVEY_OPTIONS]);
      setGeneralLocked(false);
      loadPeosAndGas(selectedProgram.id);
    } catch (err) {
      console.error('Failed to create general survey question:', err);
      toast.error('Failed to add general question');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const loadGaPeoMatrix = async () => {
    if (!selectedProgram) return;
    try {
      const res = await peoService.getGAPEOMatrix(selectedProgram.id);
      const normalizedMappings = (res?.mappings || []).reduce((acc: any[], mapping: any) => {
        const gaId = mapping.ga || mapping.ga_id;
        if (!gaId) return acc;
        acc.push({ ...mapping, weight: coerceWeight(mapping.weight) });
        return acc;
      }, []);
      const normalizedMatrix = {
        ...res,
        mappings: normalizedMappings,
      };
      let equalizedMappings = normalizedMatrix.mappings;
      (normalizedMatrix.gas || []).forEach((ga: any) => {
        equalizedMappings = normalizeGaRowWeights(normalizedMatrix, ga.id, equalizedMappings);
      });
      setGaPeoMatrix({ ...normalizedMatrix, mappings: equalizedMappings });
      setMatrixChanges(new Set());
    } catch (error: any) {
      if (error.response?.status === 404) {
        setGaPeoMatrix({ peos: [], gas: [], mappings: [] });
      } else {
        toast.error('Failed to load GA-PO matrix');
      }
    }
  };

  const loadCloGaMatrix = async () => {
    if (!selectedCourse || !selectedVersion) return;
    try {
      const res = await obeService.getMappingMatrix(selectedCourse.id, selectedVersion.id);
      setCloPiMatrix(res);
      setMatrixChanges(new Set());
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Try fallback or show empty
        setCloPiMatrix({ clos: [], gas: [], mappings: [] });
      } else {
        toast.error('Failed to load CLO-GA matrix');
      }
    }
  };

  useEffect(() => {
    if (activeSubTab === 'ga-peo' && selectedProgram) loadGaPeoMatrix();
    if (activeSubTab === 'clo-pi' && selectedCourse && selectedVersion) loadCloGaMatrix();
    if (activeSubTab === 'vision-mission-map' && selectedDepartmentId) loadVisionMissionMappings();
    if (activeSubTab === 'po-keywords' && selectedProgram) loadPOKeywordMappings();
  }, [activeSubTab, selectedProgram, selectedCourse, selectedVersion, selectedDepartmentId]);

  const toggleVisionMissionMapping = (missionKeywordId: string, visionKeywordId: string) => {
    setVisionMissionData(prev => {
      if (!prev) return prev;
      const exists = prev.mappings.some(m =>
        m.mission_keyword === missionKeywordId && m.vision_keyword === visionKeywordId
      );
      return {
        ...prev,
        mappings: exists
          ? prev.mappings.filter(m => !(m.mission_keyword === missionKeywordId && m.vision_keyword === visionKeywordId))
          : [
              ...prev.mappings,
              {
                id: `${missionKeywordId}-${visionKeywordId}`,
                mission_keyword: missionKeywordId,
                mission_keyword_text: '',
                vision_keyword: visionKeywordId,
                vision_keyword_text: '',
                is_active: true,
                created_at: '',
              },
            ],
      };
    });
  };

  const handleSaveVisionMissionMappings = async () => {
    if (!selectedDepartmentId || !visionMissionData) return;
    try {
      await obeService.saveVisionMissionMappings(
        selectedDepartmentId,
        visionMissionData.mappings.map(m => ({
          mission_keyword_id: m.mission_keyword,
          vision_keyword_id: m.vision_keyword,
        }))
      );
      toast.success('Vision-Mission mappings saved');
      loadVisionMissionMappings();
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save Vision-Mission mappings'));
    }
  };

  const togglePOKeywordMapping = (peoId: string, keywordId: string) => {
    setPoKeywordData(prev => {
      if (!prev) return prev;
      const exists = prev.mappings.some(m =>
        m.peo === peoId
        && m.mission_keyword === keywordId
      );
      return {
        ...prev,
        mappings: exists
          ? prev.mappings.filter(m => !(
              m.peo === peoId
              && m.mission_keyword === keywordId
            ))
          : [
              ...prev.mappings,
              {
                id: `${peoId}-mission-${keywordId}`,
                peo: peoId,
                peo_order_number: prev.peos.find(p => p.id === peoId)?.order_number || 0,
                peo_title: prev.peos.find(p => p.id === peoId)?.title || null,
                mission_keyword: keywordId,
                mission_keyword_text: null,
                vision_keyword: null,
                vision_keyword_text: null,
                is_active: true,
                created_at: '',
              },
            ],
      };
    });
  };

  const handleSavePOKeywordMappings = async () => {
    if (!selectedProgram?.id || !poKeywordData) return;
    try {
      await obeService.savePOKeywordMappings(
        selectedProgram.id,
        poKeywordData.mappings
          .filter(m => m.mission_keyword)
          .map(m => ({
            peo_id: m.peo,
            mission_keyword_id: m.mission_keyword,
            vision_keyword_id: null,
          }))
      );
      toast.success('PO keyword mappings saved');
      loadPOKeywordMappings();
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save PO keyword mappings'));
    }
  };

  const handleMatrixChange = (rowId: string, colId: string, type: 'ga-peo' | 'clo-ga', weight?: number) => {
     const changeKey = `${rowId}-${colId}`;
     const newChanges = new Set(matrixChanges);
     if (newChanges.has(changeKey)) newChanges.delete(changeKey);
     else newChanges.add(changeKey);
     setMatrixChanges(newChanges);

       if (type === 'ga-peo') {
          const newMappings = [...gaPeoMatrix!.mappings];
          const existingIdx = newMappings.findIndex(m => (m.ga === rowId && m.peo === colId) || (m.ga_id === rowId && m.peo_id === colId));
          if (existingIdx >= 0) {
            newMappings.splice(existingIdx, 1);
          } else {
            newMappings.push({ id: '', ga: rowId, peo: colId, ga_id: rowId, peo_id: colId, weight: 0 });
          }
          const rebalanceMappings = normalizeGaRowWeights(gaPeoMatrix, rowId, newMappings);
          setGaPeoMatrix({ ...gaPeoMatrix!, mappings: rebalanceMappings });
      } else {
        const newMappings = [...cloPiMatrix!.mappings];
        const existingIdx = newMappings.findIndex(m => (m.clo === rowId && m.ga === colId) || (m.clo_id === rowId && m.ga_id === colId));
        if (existingIdx >= 0) newMappings.splice(existingIdx, 1);
        else newMappings.push({ id: '', clo: rowId, ga: colId, clo_id: rowId, ga_id: colId, weight: 3 });
       setCloPiMatrix({ ...cloPiMatrix!, mappings: newMappings });
     }
   };

   const handleSaveMatrix = async (type: 'ga-peo' | 'clo-ga') => {
      try {
        if (type === 'ga-peo') {
           for (const ga of gaPeoMatrix!.gas) {
             const selectedCount = gaPeoMatrix!.mappings.filter(m => (m.ga === ga.id || m.ga_id === ga.id)).length;
             if (selectedCount === 0) continue;
             const total = gaRowTotals[ga.id] || 0;
             if (Math.abs(total - 100) > 0.0001) {
               toast.error(`Total weight for GA-${ga.order_number} must be exactly 100% (select at least 1 PO)`);
               return;
             }
           }
          const mappings = gaPeoMatrix!.mappings.map(m => ({
            ga_id: (m.ga || m.ga_id)!,
            peo_id: (m.peo || m.peo_id)!,
            weight: coerceWeight(m.weight)
          }));
          await peoService.saveGAPEOMappings(selectedProgram!.id, mappings);
          toast.success('GA-PO mappings saved');
          loadGaPeoMatrix();
        } else {
          const mappings = cloPiMatrix!.mappings.map((m: any) => ({
            clo_id: (m.clo || m.clo_id)!,
            ga_id: (m.ga || m.ga_id)!,
            weight: m.weight || 3
          }));
          await obeService.saveCLOGAMappings(selectedCourse!.id, selectedVersion!.id, mappings);
          toast.success('CLO-GA mappings saved');
          loadCloGaMatrix();
        }
        setMatrixChanges(new Set());
      } catch (error) {
        toast.error('Failed to save mappings');
      }
    };

  // --- Survey Question Draft Helpers (for PEO modal) ---
  const updateDraftQuestion = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    tempId: string,
    patch: Partial<SurveyQuestionDraft>,
  ) => {
    setter(prev => prev.map(d => {
      if (d._tempId !== tempId) return d;
      const newText = patch.question_text !== undefined ? patch.question_text : d.question_text;
      return { ...d, ...patch, question_text: newText, _dirty: true };
    }));
  };

  const removeDraftQuestion = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    tempId: string,
  ) => {
    setter(prev => {
      const target = prev.find(d => d._tempId === tempId);
      if (!target) return prev;
      if (target.id) {
        return prev.map(d => (d._tempId === tempId ? { ...d, _deleted: true, _dirty: true } : d));
      }
      return prev.filter(d => d._tempId !== tempId);
    });
  };

  const appendDraftQuestion = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    peoRef: { id: string } | null,
    is_general = false,
  ) => {
    setter(prev => [
      ...prev.filter(d => !d._deleted),
      {
        _tempId: makeTempId(),
        peo_id: is_general ? null : peoRef?.id,
        is_general,
        question_text: '',
        question_type: 'RATING_SCALE',
        custom_options: [...DEFAULT_SURVEY_OPTIONS],
        is_locked: false,
        is_active: true,
        _dirty: true,
      },
    ]);
  };

  const toggleDraftLock = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    tempId: string,
  ) => {
    setter(prev => prev.map(d => (d._tempId === tempId ? { ...d, is_locked: !d.is_locked, _dirty: true } : d)));
  };

  const updateDraftQuestionType = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    tempId: string,
    question_type: SurveyQuestionType,
  ) => {
    setter(prev => prev.map(d => {
      if (d._tempId !== tempId) return d;
      const currentOptions = normalizeOptions(d.custom_options);
      return {
        ...d,
        question_type,
        custom_options: question_type === 'TEXT'
          ? []
          : currentOptions.length > 0 ? currentOptions : [...DEFAULT_SURVEY_OPTIONS],
        _dirty: true,
      };
    }));
  };

  const updateDraftOption = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    tempId: string,
    optionIndex: number,
    value: string,
  ) => {
    setter(prev => prev.map(d => {
      if (d._tempId !== tempId) return d;
      const options = getDraftOptions(d);
      options[optionIndex] = value;
      return { ...d, custom_options: options, _dirty: true };
    }));
  };

  const addDraftOption = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    tempId: string,
  ) => {
    setter(prev => prev.map(d => (
      d._tempId === tempId
        ? { ...d, custom_options: [...getDraftOptions(d), ''], _dirty: true }
        : d
    )));
  };

  const removeDraftOption = (
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    tempId: string,
    optionIndex: number,
  ) => {
    setter(prev => prev.map(d => {
      if (d._tempId !== tempId) return d;
      const options = getDraftOptions(d).filter((_, idx) => idx !== optionIndex);
      return { ...d, custom_options: options.length > 0 ? options : [''], _dirty: true };
    }));
  };

  const autoSyncDraftDefault = (
    drafts: SurveyQuestionDraft[],
    description: string,
    survey_type: SurveyType,
  ): SurveyQuestionDraft[] => {
    const prefix = survey_type === 'ALUMNI' ? ALUMNI_TEMPLATE_PREFIX : EMPLOYER_TEMPLATE_PREFIX;
    return drafts.map(d => {
      if (d._deleted || d.is_locked || d.is_general) return d;
      const isEmptyOrStillDefault =
        d.question_text === '' ||
        d.question_text.startsWith(prefix) ||
        (!d.id && d.question_text.trim() === '');
      if (isEmptyOrStillDefault) {
        return {
          ...d,
          question_text: description ? `${prefix} ${description}` : '',
          _dirty: true,
        };
      }
      return d;
    });
  };

  const renderDraftQuestionEditor = (
    draft: SurveyQuestionDraft,
    setter: React.Dispatch<React.SetStateAction<SurveyQuestionDraft[]>>,
    surveyType: SurveyType,
  ) => {
    const isAlumni = surveyType === 'ALUMNI';
    const options = getDraftOptions(draft);
    const focusRing = isAlumni ? 'focus:ring-indigo-500' : 'focus:ring-emerald-500';
    return (
      <div className="space-y-3">
        <textarea
          value={draft.question_text}
          disabled={draft.is_locked}
          onChange={(e) => updateDraftQuestion(setter, draft._tempId!, { question_text: e.target.value })}
          placeholder={`Enter ${isAlumni ? 'alumni' : 'employer'} PO question...`}
          className={`w-full h-20 bg-gray-50 border-none rounded-xl px-4 py-3 font-semibold text-sm text-gray-700 focus:ring-2 ${focusRing} transition-all resize-none ${
            draft.is_locked ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([
            ['RATING_SCALE', 'Rating Options'],
            ['SINGLE_SELECT', 'Custom Options'],
            ['TEXT', 'Text Box'],
          ] as Array<[SurveyQuestionType, string]>).map(([type, label]) => (
            <button
              key={type}
              type="button"
              disabled={draft.is_locked}
              onClick={() => updateDraftQuestionType(setter, draft._tempId!, type)}
              className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                draft.question_type === type
                  ? isAlumni
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              } ${draft.is_locked ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {draft.question_type !== 'TEXT' && (
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Answer Options</p>
              <button
                type="button"
                disabled={draft.is_locked}
                onClick={() => addDraftOption(setter, draft._tempId!)}
                className={`text-[11px] font-black px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 ${
                  draft.is_locked ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                Add Option
              </button>
            </div>
            {options.map((option, optionIndex) => (
              <div key={`${draft._tempId}-option-${optionIndex}`} className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={draft.is_locked}
                  value={option}
                  onChange={(e) => updateDraftOption(setter, draft._tempId!, optionIndex, e.target.value)}
                  className={`flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 ${focusRing} ${
                    draft.is_locked ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                />
                <button
                  type="button"
                  disabled={draft.is_locked || options.length <= 1}
                  onClick={() => removeDraftOption(setter, draft._tempId!, optionIndex)}
                  className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Delete option"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const subTabs = [
    ...(isHOD ? [
      { id: 'vision-mission', label: 'Vision & Mission', icon: Target },
      { id: 'peo', label: 'PO Setup', icon: Award },
      { id: 'ga', label: 'GA Setup', icon: Info },
      { id: 'vision-mission-map', label: 'Vision-Mission Mapping', icon: LayoutGrid },
      { id: 'po-keywords', label: 'PO Mission Mapping', icon: LayoutGrid },
      { id: 'ga-peo', label: 'GA-PO Mapping', icon: LayoutGrid },
    ] : [
      { id: 'clo-pi', label: 'CLO-GA Mapping', icon: BookOpen },
    ]),
  ];

  return (
    <div className="space-y-6">
      {/* Selection Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Program</label>
          <select 
            value={selectedProgram?.id || ''} 
            onChange={(e) => setSelectedProgram(programs.find(p => p.id === e.target.value) || null)}
            className="bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
          >
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {!isHOD && activeSubTab === 'clo-pi' && (
          <>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Curriculum Version (Draft)</label>
              <select 
                value={selectedVersion?.id || ''} 
                onChange={(e) => setSelectedVersion(versions.find(v => v.id === e.target.value) || null)}
                className="bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                {versions.length === 0 && <option value="">No Draft Versions</option>}
                {versions.map(v => <option key={v.id} value={v.id}>{v.version_no}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Course</label>
              <select 
                value={selectedCourse?.id || ''} 
                onChange={(e) => setSelectedCourse(courses.find(c => c.id === e.target.value) || null)}
                className="bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>Semester {c.semester_number} - {c.code} - {c.name}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {!hideSubTabs && (
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 gap-1 overflow-x-auto">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as OBEMappingSubTabId)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-white rounded-3xl shadow-xl shadow-indigo-50/50 border border-indigo-50 overflow-hidden"
        >
          {activeSubTab === 'vision-mission' && (
            <div className="p-8 space-y-8">
              {!selectedDepartmentId && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700">
                  Program Vision/Mission cannot be loaded because this program has no linked academic unit.
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-indigo-600">
                    Program-Level Vision & Mission
                  </p>
                  <p className="mt-1 text-sm font-semibold text-indigo-900">
                    {selectedProgram?.name || 'Selected program'} uses this live statement set for snapshots, keyword mapping, and future batches.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadVisionMissionHistory}
                  disabled={loadingVisionMissionHistory || !selectedDepartmentId}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-indigo-700 shadow-sm border border-indigo-100 hover:bg-indigo-100 disabled:opacity-50"
                >
                  <History size={16} />
                  {loadingVisionMissionHistory ? 'Loading...' : 'History'}
                </button>
              </div>

              {([
                {
                  type: 'vision' as const,
                  title: 'Vision Statement',
                  value: vision,
                  setValue: setVision,
                  savedId: departmentVision?.id,
                  keywords: visionKeywords,
                  candidates: visionCandidates,
                  selected: selectedVisionKeywords,
                  setSelected: setSelectedVisionKeywords,
                  manualInput: manualKeywordInputs.vision,
                  saveStatement: handleSaveVision,
                  color: 'indigo',
                },
                {
                  type: 'mission' as const,
                  title: 'Mission Statement',
                  value: mission,
                  setValue: setMission,
                  savedId: departmentMission?.id,
                  keywords: missionKeywords,
                  candidates: missionCandidates,
                  selected: selectedMissionKeywords,
                  setSelected: setSelectedMissionKeywords,
                  manualInput: manualKeywordInputs.mission,
                  saveStatement: handleSaveMission,
                  color: 'emerald',
                },
              ]).map(section => (
                <div key={section.type} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-xl font-black text-gray-900">{section.title}</h3>
                      <p className="text-gray-400 text-sm mt-1">
                        HOD-approved statement and keywords for {selectedProgram?.name || 'this program'}.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={section.saveStatement}
                        disabled={isSavingVision || !selectedDepartmentId}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 ${
                          section.type === 'vision' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        <Save size={18} />
                        Save
                      </button>
                      <button
                        onClick={() => handleExtractKeywords(section.type)}
                        disabled={!section.value.trim()}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <Target size={18} />
                        Extract Keywords
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={section.value}
                    onChange={(e) => section.setValue(e.target.value)}
                    placeholder={`Enter program ${section.type} statement...`}
                    className="w-full h-40 p-5 bg-white border border-gray-100 rounded-2xl text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-black uppercase tracking-widest text-gray-500">Candidate Keywords</h4>
                        <button
                          onClick={() => handleSaveKeywords(section.type)}
                          disabled={!section.savedId || section.selected.size === 0}
                          className="text-xs font-black rounded-lg bg-gray-900 px-3 py-2 text-white disabled:opacity-40"
                        >
                          Save Selected
                        </button>
                      </div>
                      <div className="min-h-[88px] rounded-2xl border border-dashed border-gray-200 bg-white p-3">
                        {section.candidates.length === 0 ? (
                          <p className="py-6 text-center text-xs font-semibold text-gray-400">Extract keywords to review candidates.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {section.candidates.map(candidate => {
                              const active = section.selected.has(candidate);
                              return (
                                <button
                                  key={candidate}
                                  onClick={() => {
                                    const next = new Set(section.selected);
                                    if (next.has(candidate)) next.delete(candidate);
                                    else next.add(candidate);
                                    section.setSelected(next);
                                  }}
                                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                                    active
                                      ? section.type === 'vision'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-emerald-600 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {candidate}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-black uppercase tracking-widest text-gray-500">Approved Keywords</h4>
                      <div className="min-h-[88px] rounded-2xl border border-gray-100 bg-white p-3">
                        {section.keywords.length === 0 ? (
                          <p className="py-6 text-center text-xs font-semibold text-gray-400">No approved keywords saved yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {section.keywords.map(keyword => (
                              <span key={keyword.id} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">
                                {keyword.text}
                                <button
                                  onClick={() => handleRemoveKeyword(section.type, keyword.id)}
                                  className="text-gray-400 hover:text-red-500"
                                  title="Remove keyword"
                                >
                                  <X size={13} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <input
                          type="text"
                          value={section.manualInput}
                          onChange={(e) =>
                            setManualKeywordInputs(prev => ({
                              ...prev,
                              [section.type]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleManualKeywordSubmit(section.type);
                            }
                          }}
                          disabled={!section.savedId}
                          placeholder="Type keyword and press Enter"
                          className="mt-3 w-full rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(activeSubTab === 'peo' || activeSubTab === 'ga') && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    {activeSubTab === 'peo' ? 'Program Outcomes (POs)' : 'Graduate Attributes (GAs)'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Manage the {activeSubTab === 'peo' ? 'POs' : 'GAs'} defined for this program.
                  </p>
                </div>
                {isHOD && (
                  <div className="flex gap-3">
                    {activeSubTab === 'peo' && (
                      <button
                        onClick={openAddGeneralModal}
                        className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all"
                      >
                        <Plus size={18} />
                        Add Question
                      </button>
                    )}
                    <button 
                      onClick={() => handleOpenModal(activeSubTab)}
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-all"
                    >
                      <Plus size={18} />
                      Add {activeSubTab === 'peo' ? 'PO' : activeSubTab.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(activeSubTab === 'peo' ? peos : gas).map((item) => {
                  const question = activeSubTab === 'ga'
                    ? exitSurveyQuestions.find(q => getExitSurveyGaId(q) === item.id || q.ga_id === item.id)
                    : null;

                  return (
                    <div key={item.id} className="group p-6 bg-gray-50 rounded-2xl border border-transparent hover:border-indigo-200 hover:bg-white hover:shadow-xl transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-black">
                            {item.order_number}
                          </span>
                          <h4 className="font-bold text-gray-900 text-lg">{item.title}</h4>
                        </div>
                        {isHOD && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(activeSubTab, item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                              <Settings size={18} />
                            </button>
                            <button onClick={() => handleDeleteItem(activeSubTab, item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed mb-4">{item.description}</p>

                      {activeSubTab === 'ga' && question && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Exit Survey Question</label>
                          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-xl border border-gray-200">
                            <div className={`px-2 py-1 rounded-full text-xs font-bold ${question.is_locked ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {question.is_locked ? 'Locked' : 'Unlocked'}
                            </div>
                            <p className="text-sm text-gray-700 font-medium flex-1">{question.question_text}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {activeSubTab === 'peo' && (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-xl font-black text-gray-900">Survey Questions</h3>
                      <p className="text-gray-400 text-sm mt-1">
                        Alumni and employer questions for this program, marked as General or mapped with a PO.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black">
                        Alumni: {activeSurveyQuestions.filter(question => question.survey_type === 'ALUMNI').length}
                      </span>
                      <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black">
                        Employer: {activeSurveyQuestions.filter(question => question.survey_type === 'EMPLOYER').length}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {renderSurveyQuestionList('ALUMNI')}
                    {renderSurveyQuestionList('EMPLOYER')}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'vision-mission-map' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Mission to Vision Keyword Mapping</h3>
                  <p className="text-gray-400 text-sm mt-1">Manually connect approved Mission keywords with relevant Vision keywords.</p>
                </div>
                {isHOD && (
                  <button
                    onClick={handleSaveVisionMissionMappings}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Save size={18} />
                    Save Mappings
                  </button>
                )}
              </div>

              {visionMissionData && visionMissionData.mission_keywords.length > 0 && visionMissionData.vision_keywords.length > 0 ? (
                <div className="overflow-x-auto rounded-3xl border border-gray-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-5 border-b border-gray-100 font-black text-gray-400 uppercase text-xs tracking-widest w-64">Mission Keyword</th>
                        {visionMissionData.vision_keywords.map(keyword => (
                          <th key={keyword.id} className="p-5 border-b border-gray-100 text-center text-xs font-black uppercase text-indigo-700 min-w-[150px]">
                            {keyword.text}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visionMissionData.mission_keywords.map(missionKeyword => (
                        <tr key={missionKeyword.id} className="hover:bg-indigo-50/30">
                          <td className="p-5 border-b border-gray-50 font-bold text-gray-900">{missionKeyword.text}</td>
                          {visionMissionData.vision_keywords.map(visionKeyword => {
                            const active = visionMissionData.mappings.some(m =>
                              m.mission_keyword === missionKeyword.id && m.vision_keyword === visionKeyword.id
                            );
                            return (
                              <td key={visionKeyword.id} className={`p-5 border-b border-gray-50 text-center ${active ? 'bg-indigo-50/40' : ''}`}>
                                <button
                                  onClick={() => isHOD && toggleVisionMissionMapping(missionKeyword.id, visionKeyword.id)}
                                  disabled={!isHOD}
                                  className={`w-11 h-11 rounded-2xl flex items-center justify-center mx-auto transition-all ${
                                    active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                  } ${!isHOD ? 'cursor-not-allowed opacity-60' : ''}`}
                                >
                                  {active ? <Check size={18} /> : <Plus size={18} />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400 italic">Save Vision and Mission keywords before mapping.</div>
              )}
            </div>
          )}

          {activeSubTab === 'po-keywords' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-900">PO Mission Mapping</h3>
                  <p className="text-gray-400 text-sm mt-1">Map each PO to approved Mission keywords.</p>
                </div>
                {isHOD && (
                  <button
                    onClick={handleSavePOKeywordMappings}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Save size={18} />
                    Save Mappings
                  </button>
                )}
              </div>

              {poKeywordData && poKeywordData.peos.length > 0 ? (
                <div className="space-y-6">
                  {poKeywordData.peos.map(po => (
                    <div key={po.id} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
                      <div className="mb-4">
                        <h4 className="font-black text-gray-900">PO-{po.order_number}: {po.title}</h4>
                        <p className="mt-1 text-sm text-gray-500">{po.description}</p>
                      </div>
                      <div>
                        <div>
                          <h5 className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-600">Mission Keywords</h5>
                          <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 border border-gray-100">
                            {poKeywordData.mission_keywords.length === 0 ? (
                              <span className="text-xs font-semibold text-gray-400">No Mission keywords saved.</span>
                            ) : poKeywordData.mission_keywords.map(keyword => {
                              const active = poKeywordData.mappings.some(m => m.peo === po.id && m.mission_keyword === keyword.id);
                              return (
                                <button
                                  key={keyword.id}
                                  onClick={() => isHOD && togglePOKeywordMapping(po.id, keyword.id)}
                                  disabled={!isHOD}
                                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                    active ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  } ${!isHOD ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  {keyword.text}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400 italic">Create POs and approved keywords before mapping.</div>
              )}
            </div>
          )}

          {activeSubTab === 'ga-peo' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-900">GA to PO Mapping Matrix</h3>
                  <p className="text-gray-400 text-sm mt-1">Map Graduate Attributes to Program Outcomes.</p>
                </div>
                {isHOD && (
                  <button 
                    onClick={() => handleSaveMatrix('ga-peo')}
                    disabled={!isGaPeoMatrixValid}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={18} />
                    Save Mappings
                  </button>
                )}
              </div>

              {gaPeoMatrix ? (
                <div className="overflow-x-auto rounded-3xl border border-gray-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-6 border-b border-gray-100 font-black text-gray-400 uppercase text-xs tracking-widest w-64">Graduate Attribute</th>
                        {gaPeoMatrix.peos.map(peo => (
                            <th key={peo.id} className="p-6 border-b border-gray-100 text-center w-48">
                              <div className="font-black text-indigo-600 text-sm">PO-{peo.order_number}</div>
                              <div className="text-[10px] text-gray-400 mt-1 uppercase truncate max-w-[100px] mx-auto">{peo.title}</div>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gaPeoMatrix.gas.map(ga => (
                        <tr key={ga.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="p-6 border-b border-gray-50">
                            <div className="font-bold text-gray-900">GA-{ga.order_number}</div>
                            <div className="text-sm text-gray-500 truncate max-w-[200px]">{ga.title}</div>
                          </td>
                          {gaPeoMatrix.peos.map(peo => {
                            const mapping = gaPeoMatrix.mappings.find(m => 
                              (m.ga === ga.id || m.ga_id === ga.id) && (m.peo === peo.id || m.peo_id === peo.id)
                            );
                            const active = !!mapping;
                            return (
                              <td key={peo.id} className={`p-6 border-b border-gray-50 text-center ${active ? 'bg-indigo-50/40' : ''}`}>
                                <button
                                  onClick={() => isHOD && handleMatrixChange(ga.id, peo.id, 'ga-peo')}
                                  disabled={!isHOD}
                                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto transition-all transform active:scale-95 ${
                                    active 
                                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                      : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                  } ${!isHOD ? 'cursor-not-allowed opacity-60' : ''}`}
                                >
                                  {active ? <Check size={20} /> : <Plus size={20} />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400 italic">Select a program to view mapping matrix...</div>
              )}
            </div>
          )}

          {activeSubTab === 'clo-pi' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {!selectedCourse ? (
              <div className="bg-white p-12 text-center rounded-[40px] border-2 border-dashed border-gray-100 shadow-xl shadow-gray-50/50">
                <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Select a Course</h3>
                <p className="text-gray-500 font-bold mt-2">Please select a course to define CLOs and map them to GAs</p>
              </div>
            ) : (
              <>
                {/* CLO Definition Section */}
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Course Learning Outcomes</h3>
                      <p className="text-gray-500 font-bold mt-1">Define learning outcomes for {selectedCourse.code}</p>
                    </div>
                    <button 
                      onClick={() => handleOpenModal('clo')}
                      className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-100 transition-all"
                    >
                      <Plus size={18} />
                      Add CLO
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clos.map(clo => (
                      <div key={clo.id} className="group p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-50/50 transition-all relative overflow-hidden">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg shadow-inner">
                            {clo.order_number}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">CLO-{clo.order_number}</span>
                              <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-black uppercase">
                                {clo.bloom_level}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-gray-700 leading-relaxed" title={clo.title}>{clo.title}</p>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleOpenModal('clo', clo)} className="p-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl shadow-sm border border-gray-100">
                            <Settings size={14} />
                          </button>
                          <button onClick={() => handleDeleteItem('clo', clo.id)} className="p-2 bg-white text-red-600 hover:bg-red-50 rounded-xl shadow-sm border border-gray-100">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mapping Matrix Section */}
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">CLO-GA Mapping Matrix</h3>
                      <p className="text-gray-500 font-bold mt-1">Map Course Learning Outcomes to Graduate Attributes</p>
                    </div>
                    <button
                      onClick={() => handleSaveMatrix('clo-ga')}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-indigo-200"
                    >
                      <Save size={18} />
                      Save Mappings
                    </button>
                  </div>

                  {cloPiMatrix && (
                    <div className="overflow-x-auto rounded-[30px] border border-gray-100">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-r border-gray-100 w-48 sticky left-0 bg-gray-50 z-10">CLOs \ GAs</th>
                            {cloPiMatrix.gas.map((ga: any) => (
                              <th 
                                key={ga.id}
                                className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center border-b border-r border-gray-100 bg-indigo-50/50"
                              >
                                GA-{ga.order_number}: {ga.title}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cloPiMatrix.clos.map((clo: any) => (
                            <tr key={clo.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-6 border-b border-r border-gray-100 font-black text-gray-700 text-sm sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                                <div className="flex flex-col">
                                  <span>{clo.title}</span>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">{clo.bloom_level}</span>
                                </div>
                              </td>
                              {cloPiMatrix.gas.map((ga: any) => {
                                const isSelected = cloPiMatrix.mappings.some((m: any) => 
                                  (m.clo === clo.id || m.clo_id === clo.id) && (m.ga === ga.id || m.ga_id === ga.id)
                                );
                                return (
                                  <td key={`${clo.id}-${ga.id}`} className="p-4 border-b border-r border-gray-100 text-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleMatrixChange(clo.id, ga.id, 'clo-ga')}
                                        className="sr-only peer"
                                      />
                                      <div className="w-10 h-10 bg-gray-100 rounded-xl peer-checked:bg-indigo-600 flex items-center justify-center transition-all peer-checked:shadow-lg peer-checked:shadow-indigo-100">
                                        {isSelected && <Check size={20} className="text-white" />}
                                      </div>
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
        </motion.div>
      </AnimatePresence>

      {/* Modal for PEO/GA/CLO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white"
          >
            <div className="p-10">
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                {editingItem ? 'Edit' : 'Add'} {modalType.toUpperCase()}
              </h3>
              <p className="text-gray-400 text-sm mb-8">Fill in the details for the {modalType === 'clo' ? 'course learning outcome' : 'program objective'}.</p>
              
              <form onSubmit={handleSaveItem} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Title / Short Name</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder={`e.g. ${modalType === 'clo' ? 'Design Principles' : 'Fundamental Knowledge'}`}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Order Number</label>
                    <input
                      type="number"
                      required
                      value={formData.order_number}
                      onChange={(e) => setFormData({...formData, order_number: parseInt(e.target.value)})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  {(modalType === 'clo' || modalType === 'ga' || modalType === 'peo') && (
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">KPI Threshold (%)</label>
                      <input
                        type="number"
                        required
                        value={formData.kpi_target}
                        onChange={(e) => setFormData({...formData, kpi_target: parseFloat(e.target.value)})}
                        placeholder="e.g., 70"
                        className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  )}
                  {modalType === 'clo' && (
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Bloom Level</label>
                      <select
                        required
                        value={formData.bloom_level}
                        onChange={(e) => setFormData({...formData, bloom_level: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="K1">K1 - Remembering</option>
                        <option value="K2">K2 - Understanding</option>
                        <option value="K3">K3 - Applying</option>
                        <option value="K4">K4 - Analyzing</option>
                        <option value="K5">K5 - Evaluating</option>
                        <option value="K6">K6 - Creating</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => {
                      const newDescription = e.target.value;
                      const alumniAutoQuestion = `${ALUMNI_TEMPLATE_PREFIX} ${newDescription}`;
                      const exitAutoQuestion = `I am confident in ${newDescription}`;
                      const useAlumniDefault =
                        formData.alumni_survey_question_text === '' ||
                        formData.alumni_survey_question_text.startsWith(ALUMNI_TEMPLATE_PREFIX);
                      const useExitDefault =
                        formData.exit_survey_question_text === '' ||
                        formData.exit_survey_question_text.startsWith('I am confident in ');
                      if (modalType === 'peo') {
                        setAlumniSurveyDrafts(prev => autoSyncDraftDefault(prev, newDescription, 'ALUMNI'));
                        setEmployerSurveyDrafts(prev => autoSyncDraftDefault(prev, newDescription, 'EMPLOYER'));
                      }
                      setFormData({
                        ...formData,
                        description: newDescription,
                        alumni_survey_question_text: useAlumniDefault ? alumniAutoQuestion : formData.alumni_survey_question_text,
                        exit_survey_question_text: useExitDefault ? exitAutoQuestion : formData.exit_survey_question_text,
                      });
                    }}
                    placeholder="Provide a detailed description..."
                    className="w-full h-32 bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                </div>

                {modalType === 'peo' && (
                  <div className="space-y-5 pt-2">
                    {/* Alumni Survey Questions */}
                    <div className="border border-indigo-100 rounded-3xl p-5 bg-indigo-50/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                            <GraduationCap size={18} />
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider">Alumni Survey Questions</h4>
                            <p className="text-[11px] text-gray-500 mt-0.5">PO-specific questions for alumni respondents mapped to this Program Outcome.</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => appendDraftQuestion(setAlumniSurveyDrafts, editingItem || null, false)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-all"
                          >
                            <Plus size={14} /> Add PO Question
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {alumniSurveyDrafts.filter(d => !d._deleted).length === 0 && (
                          <p className="text-xs italic text-gray-400 text-center py-6 bg-white rounded-2xl border border-dashed border-gray-200">
                            No Alumni questions. Click "Add PO Question" to add one.
                          </p>
                        )}
                        {alumniSurveyDrafts.filter(d => !d._deleted).map((draft, idx) => (
                          <div key={draft._tempId} className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                  Alumni Q{idx + 1}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleDraftLock(setAlumniSurveyDrafts, draft._tempId!)}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    draft.is_locked
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                  title={draft.is_locked ? 'Unlock question (editable by alumni)' : 'Lock question (prevents alumni-side edits)'}
                                >
                                  {draft.is_locked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeDraftQuestion(setAlumniSurveyDrafts, draft._tempId!)}
                                  className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"
                                  title="Delete question"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {renderDraftQuestionEditor(draft, setAlumniSurveyDrafts, 'ALUMNI')}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Employer Survey Questions */}
                    <div className="border border-emerald-100 rounded-3xl p-5 bg-emerald-50/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                            <Briefcase size={18} />
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider">Employer Survey Questions</h4>
                            <p className="text-[11px] text-gray-500 mt-0.5">PO-specific questions asked to employers of graduates, mapped to this Program Outcome.</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => appendDraftQuestion(setEmployerSurveyDrafts, editingItem || null, false)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 hover:bg-emerald-50 transition-all"
                          >
                            <Plus size={14} /> Add PO Question
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {employerSurveyDrafts.filter(d => !d._deleted).length === 0 && (
                          <p className="text-xs italic text-gray-400 text-center py-6 bg-white rounded-2xl border border-dashed border-gray-200">
                            No Employer questions. Click "Add PO Question" to add one.
                          </p>
                        )}
                        {employerSurveyDrafts.filter(d => !d._deleted).map((draft, idx) => (
                          <div key={draft._tempId} className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                  Employer Q{idx + 1}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleDraftLock(setEmployerSurveyDrafts, draft._tempId!)}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    draft.is_locked
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                  title={draft.is_locked ? 'Unlock question' : 'Lock question'}
                                >
                                  {draft.is_locked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeDraftQuestion(setEmployerSurveyDrafts, draft._tempId!)}
                                  className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"
                                  title="Delete question"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {renderDraftQuestionEditor(draft, setEmployerSurveyDrafts, 'EMPLOYER')}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {modalType === 'ga' && (
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Exit Survey Question</label>
                    <textarea
                      required
                      value={formData.exit_survey_question_text}
                      onChange={(e) => setFormData({...formData, exit_survey_question_text: e.target.value})}
                      placeholder="Enter the exit survey question for this GA..."
                      className="w-full h-24 bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-2">This question will be shown to students during exit survey.</p>
                  </div>
                )}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-500 px-6 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Save {modalType.toUpperCase()}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {showVisionMissionHistory && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border border-white overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-indigo-50 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600">
                  Vision / Mission History
                </p>
                <h3 className="mt-1 text-2xl font-black text-gray-900">
                  {selectedProgram?.name || 'Program'} Review Register
                </h3>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  Statement revision decisions saved from OBE Configuration are retained here for audit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVisionMissionHistory(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-white hover:text-gray-700"
              >
                <X size={22} />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6">
              {visionMissionReviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
                  <History className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="font-bold text-gray-500">No Vision/Mission reviews recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visionMissionReviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-gray-600">
                            {review.statement_type}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                              review.decision === 'REVISED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {review.decision}
                          </span>
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-indigo-700">
                            {review.trigger_type}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-gray-400">
                          {review.review_date ? new Date(review.review_date).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl bg-white p-4">
                          <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-400">
                            Previous Snapshot
                          </p>
                          <p className="text-sm font-medium leading-relaxed text-gray-700 whitespace-pre-wrap">
                            {review.previous_statement_snapshot || '—'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-4">
                          <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-400">
                            Justification
                          </p>
                          <p className="text-sm font-medium leading-relaxed text-gray-700 whitespace-pre-wrap">
                            {review.justification || '—'}
                          </p>
                          {review.decision === 'REVISED' && (
                            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                              <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-amber-700">
                                New Live Statement
                              </p>
                              <p className="text-sm font-semibold text-amber-900 whitespace-pre-wrap">
                                {review.new_statement || '—'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {revisionModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-white overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-amber-50 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                  Statement Revision Review
                </p>
                <h3 className="mt-1 text-2xl font-black text-gray-900">
                  Revise {revisionModal.type === 'vision' ? 'Vision' : 'Mission'} Statement
                </h3>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  This will create a new live statement version and reset its keyword/mapping work to the new text.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevisionModal(null)}
                disabled={isSavingVision}
                className="rounded-xl p-2 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-50"
              >
                <X size={22} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-400">
                    Current Statement
                  </p>
                  <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-gray-700">
                    {revisionModal.previousStatement || '-'}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-amber-700">
                    Proposed Revision
                  </p>
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-amber-900">
                    {revisionModal.newStatement || '-'}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">
                  Review Trigger
                </label>
                <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                  {(['MANUAL', 'SCHEDULED'] as const).map(trigger => (
                    <button
                      key={trigger}
                      type="button"
                      onClick={() => setRevisionTriggerType(trigger)}
                      className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${
                        revisionTriggerType === trigger
                          ? 'bg-gray-900 text-white shadow-sm'
                          : 'text-gray-500 hover:bg-white'
                      }`}
                    >
                      {trigger}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">
                  Revision Justification
                </label>
                <textarea
                  value={revisionJustification}
                  onChange={(e) => setRevisionJustification(e.target.value)}
                  placeholder="Document why this statement is being revised..."
                  className="h-32 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium text-gray-700 outline-none transition-all placeholder:text-gray-400 focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => setRevisionModal(null)}
                  disabled={isSavingVision}
                  className="rounded-xl bg-gray-100 px-5 py-3 text-sm font-black text-gray-500 transition-all hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStatementRevision}
                  disabled={isSavingVision || !revisionJustification.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-100 transition-all hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save size={18} />
                  {isSavingVision ? 'Saving...' : 'Save Revision'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add General Question Modal */}
      {isAddGeneralOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl border border-white"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-1">
                    Add General Question
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {generalStep === 'select'
                      ? 'Choose the survey type for this general question.'
                      : `Enter the ${generalSurveyType?.toLowerCase()} general question below.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddGeneralOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X size={22} />
                </button>
              </div>

              {generalStep === 'select' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneralSurveyType('ALUMNI');
                      setGeneralStep('form');
                    }}
                    className="w-full flex items-center gap-4 p-6 rounded-3xl border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                      <GraduationCap size={26} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-black text-gray-900 text-lg">Alumni General Question</div>
                      <div className="text-xs text-gray-500 mt-1">Add an unscored feedback question shown to all alumni survey respondents.</div>
                    </div>
                    <ChevronRight size={22} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGeneralSurveyType('EMPLOYER');
                      setGeneralStep('form');
                    }}
                    className="w-full flex items-center gap-4 p-6 rounded-3xl border-2 border-emerald-100 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Briefcase size={26} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-black text-gray-900 text-lg">Employer General Question</div>
                      <div className="text-xs text-gray-500 mt-1">Add an unscored feedback question shown to all employer survey respondents.</div>
                    </div>
                    <ChevronRight size={22} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  </button>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => setIsAddGeneralOpen(false)}
                      className="w-full bg-gray-100 text-gray-500 px-6 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {generalStep === 'form' && generalSurveyType && (
                <div className="space-y-6">
                  <div className={`rounded-3xl p-4 flex items-center gap-3 ${
                    generalSurveyType === 'ALUMNI' ? 'bg-indigo-50 border border-indigo-100' : 'bg-emerald-50 border border-emerald-100'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                      generalSurveyType === 'ALUMNI' ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}>
                      {generalSurveyType === 'ALUMNI' ? <GraduationCap size={18} /> : <Briefcase size={18} />}
                    </div>
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-widest ${
                        generalSurveyType === 'ALUMNI' ? 'text-indigo-600' : 'text-emerald-600'
                      }`}>Survey Type</div>
                      <div className="font-bold text-gray-800 text-sm">
                        {generalSurveyType === 'ALUMNI' ? 'Alumni Survey — General Question' : 'Employer Survey — General Question'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Question Text</label>
                    <textarea
                      autoFocus
                      required
                      value={generalQuestionText}
                      onChange={(e) => setGeneralQuestionText(e.target.value)}
                      placeholder={generalSurveyType === 'ALUMNI'
                        ? 'e.g. How satisfied are you with the overall quality of education you received?'
                        : 'e.g. How well do graduates from this program adapt to professional work environments?'}
                      className="w-full h-32 bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Answer Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        ['RATING_SCALE', 'Rating Options'],
                        ['SINGLE_SELECT', 'Custom Options'],
                        ['TEXT', 'Text Box'],
                      ] as Array<[SurveyQuestionType, string]>).map(([type, label]) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setGeneralQuestionType(type);
                            setGeneralCustomOptions(prev => {
                              const current = normalizeOptions(prev);
                              return type === 'TEXT' ? [] : current.length > 0 ? current : [...DEFAULT_SURVEY_OPTIONS];
                            });
                          }}
                          className={`px-4 py-3 rounded-2xl text-xs font-black border transition-all ${
                            generalQuestionType === type
                              ? generalSurveyType === 'ALUMNI'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {generalQuestionType !== 'TEXT' && (
                      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Answer Options</p>
                          <button
                            type="button"
                            onClick={() => setGeneralCustomOptions(prev => [...(normalizeOptions(prev).length > 0 ? normalizeOptions(prev) : [...DEFAULT_SURVEY_OPTIONS]), ''])}
                            className="text-[11px] font-black px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                          >
                            Add Option
                          </button>
                        </div>
                        {(normalizeOptions(generalCustomOptions).length > 0 ? generalCustomOptions : [...DEFAULT_SURVEY_OPTIONS]).map((option, optionIndex) => (
                          <div key={`general-option-${optionIndex}`} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => setGeneralCustomOptions(prev => {
                                const options = normalizeOptions(prev).length > 0 ? [...prev] : [...DEFAULT_SURVEY_OPTIONS];
                                options[optionIndex] = e.target.value;
                                return options;
                              })}
                              className={`flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 ${
                                generalSurveyType === 'ALUMNI' ? 'focus:ring-indigo-500' : 'focus:ring-emerald-500'
                              }`}
                            />
                            <button
                              type="button"
                              disabled={(normalizeOptions(generalCustomOptions).length || DEFAULT_SURVEY_OPTIONS.length) <= 1}
                              onClick={() => setGeneralCustomOptions(prev => {
                                const options = (normalizeOptions(prev).length > 0 ? [...prev] : [...DEFAULT_SURVEY_OPTIONS])
                                  .filter((_, idx) => idx !== optionIndex);
                                return options.length > 0 ? options : [''];
                              })}
                              className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Delete option"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={generalLocked}
                        onChange={(e) => setGeneralLocked(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-bold text-gray-800 text-sm">Lock this question</div>
                        <div className="text-[11px] text-gray-500">Prevent alumni/employer-side edits when active.</div>
                      </div>
                    </label>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGeneralStep('select');
                        setGeneralSurveyType(null);
                        setGeneralQuestionText('');
                        setGeneralQuestionType('RATING_SCALE');
                        setGeneralCustomOptions([...DEFAULT_SURVEY_OPTIONS]);
                        setGeneralLocked(false);
                      }}
                      className="flex-1 bg-gray-100 text-gray-500 px-6 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGeneralQuestion}
                      disabled={!generalQuestionText.trim() || isSavingGeneral}
                      className={`flex-1 px-6 py-4 rounded-2xl font-black shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                        generalSurveyType === 'ALUMNI'
                          ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                      }`}
                    >
                      {isSavingGeneral ? 'Saving...' : 'Add Question'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default OBEConfigurationModule;
