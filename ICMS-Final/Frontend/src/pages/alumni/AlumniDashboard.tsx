import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Building,
  ClipboardList,
  Download,
  GraduationCap,
  Info,
  LayoutDashboard,
  LogOut,
  Lock,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import obeService, { AlumniDashboardResponse, AlumniSurveyQuestion, PEO } from '../../api/obeService';

type TabId = 'dashboard' | 'transcript';
type AlumniAnswerValue = {
  score?: number;
  selected_option_label?: string;
  text_answer?: string;
};

const sidebarGradient = 'from-purple-800 via-indigo-800 to-blue-800';
const headerGradient = 'from-pink-500 via-purple-500 to-indigo-500';

const surveyStorageKey = (cycleId: string, studentId: string) =>
  `alumni_survey_submitted:${cycleId}:${studentId}`;

const resolveAlumniStudentIdentifier = (user: any, alumni: AlumniDashboardResponse | null) =>
  user?.student_id ||
  user?.studentId ||
  user?.custom_id ||
  user?.registration_number ||
  user?.student_profile?.student_id ||
  user?.student_profile?.custom_id ||
  alumni?.roll_no ||
  user?.id ||
  null;

const defaultRatingOptions = ['Poor', 'Below Average', 'Average', 'Good', 'Excellent'];

const getQuestionType = (question: AlumniSurveyQuestion) => question.question_type || 'RATING_SCALE';

const getQuestionOptions = (question: AlumniSurveyQuestion) => {
  if (getQuestionType(question) === 'TEXT') return [];
  const options = question.effective_options?.length
    ? question.effective_options
    : question.custom_options?.length
      ? question.custom_options
      : defaultRatingOptions;
  return options.map(option => String(option));
};

const getQuestionScopeLabel = (question: AlumniSurveyQuestion) => {
  const isGeneral =
    question.is_general === true ||
    ((question as any).peo_id == null && !question.peo_title && !(question as any).peo_description);
  if (isGeneral) return 'GENERAL';
  if (question.peo_order_number) return `PEO-${question.peo_order_number}`;
  return question.peo_title || question.peo_description || 'PEO';
};

const QUESTION_OPTIONAL_EMPLOYMENT_STATUSES = ['UNEMPLOYED', 'HOUSEWIFE'];

const AlumniDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [alumniData, setAlumniData] = useState<AlumniDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [surveyCycleId, setSurveyCycleId] = useState<string | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<AlumniSurveyQuestion[]>([]);
  const [surveyQuestionsSource, setSurveyQuestionsSource] = useState<'cycle' | 'peo' | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<Record<string, AlumniAnswerValue>>({});
  const [surveyLoading, setSurveyLoading] = useState(true);
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [employmentStatus, setEmploymentStatus] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [currentDesignation, setCurrentDesignation] = useState('');
  const [employerContactName, setEmployerContactName] = useState('');
  const [employerContactEmail, setEmployerContactEmail] = useState('');
  const isSurveyRoute = location.pathname.includes('/alumni/survey');
  const showSurveyModal = !hasSubmitted && (Boolean(surveyCycleId) || isSurveyRoute);

  useEffect(() => {
    let cancelled = false;

    const fetchAlumniData = async () => {
      try {
        setLoading(true);

        const dashboard = await obeService.getAlumniDashboard();

        if (cancelled) return;

        setAlumniData(dashboard);

        const resolvedBatchId =
          dashboard?.batch_id ||
          currentUser?.batch_id ||
          currentUser?.batch?.id ||
          currentUser?.batchId ||
          currentUser?.original_batch?.id ||
          null;
        const resolvedProgramId = dashboard?.program_id || currentUser?.program_id || null;

        const cycles = resolvedBatchId
          ? await obeService.getAlumniSurveyCycles(String(resolvedBatchId)).catch(() => [])
          : [];

        if (cancelled) return;

        const studentIdentifier = resolveAlumniStudentIdentifier(currentUser, dashboard) || 'guest';
        const statusPayload = resolvedBatchId
          ? await obeService
              .getAlumniSurveyStatus(String(resolvedBatchId), String(studentIdentifier))
              .catch(() => null)
          : null;

        const activeCycle = cycles.find((cycle: any) => cycle.status === 'ACTIVE') || null;
        const cycleId = statusPayload?.cycle_id || activeCycle?.id || null;
        setSurveyCycleId(cycleId);

        const submitted = Boolean(statusPayload?.submitted);
        if (cycleId) {
          const key = surveyStorageKey(cycleId, String(studentIdentifier));
          if (submitted) {
            localStorage.setItem(key, 'true');
          } else {
            localStorage.removeItem(key);
          }
        }
        setHasSubmitted(submitted);

        const loadCycleQuestions = async () => {
          if (!cycleId || submitted) return [];
          try {
            const questionData = await obeService.getAlumniSurveyQuestions(String(cycleId));
            return Array.isArray(questionData) ? questionData : [];
          } catch (error) {
            return [];
          }
        };

        const loadPeoQuestions = async () => {
          if (!resolvedProgramId) return [];
          const unified = await obeService.getSurveyQuestions(String(resolvedProgramId), 'ALUMNI').catch(() => []);
          if (Array.isArray(unified) && unified.length > 0) {
            return unified as AlumniSurveyQuestion[];
          }
          const peos: PEO[] = await obeService.getProgramPEOs(String(resolvedProgramId)).catch(() => []);
          const questionGroups = await Promise.all(
            peos.map((peo) => obeService.getPEOAlumniSurveyQuestions(peo.id).catch(() => []))
          );
          return questionGroups.flat();
        };

        setSurveyLoading(true);
        const cycleQuestions = await loadCycleQuestions();
        if (cancelled) return;

        if (cycleQuestions.length > 0) {
          setSurveyQuestionsSource('cycle');
          setSurveyQuestions(cycleQuestions);
          const initialResponses: Record<string, AlumniAnswerValue> = {};
          cycleQuestions.forEach((question) => {
            initialResponses[question.id] = {};
          });
          setSurveyResponses(initialResponses);
        } else {
          const fallbackQuestions = await loadPeoQuestions();
          if (cancelled) return;

          setSurveyQuestionsSource(fallbackQuestions.length > 0 ? 'peo' : null);
          setSurveyQuestions(fallbackQuestions);
          const initialResponses: Record<string, AlumniAnswerValue> = {};
          fallbackQuestions.forEach((question) => {
            initialResponses[question.id] = {};
          });
          setSurveyResponses(initialResponses);
        }
      } catch (error) {
        console.error('Failed to fetch alumni data:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSurveyLoading(false);
        }
      }
    };

    fetchAlumniData();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const headerName =
    alumniData?.name ||
    currentUser?.full_name ||
    currentUser?.name ||
    currentUser?.username ||
    'Alumni';

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transcript', label: 'Academic Transcript', icon: BookOpen },
  ];

  const openSurvey = () => navigate('/alumni/survey');
  const isQuestionAnswered = (question: AlumniSurveyQuestion) => {
    const answer = surveyResponses[question.id] || {};
    if (getQuestionType(question) === 'TEXT') {
      return Boolean(answer.text_answer?.trim());
    }
    return Boolean(answer.selected_option_label?.trim()) || Boolean(answer.score && answer.score > 0);
  };
  const shouldShowSurveyQuestions = employmentStatus
    ? !QUESTION_OPTIONAL_EMPLOYMENT_STATUSES.includes(employmentStatus)
    : true;
  const visibleSurveyQuestions = shouldShowSurveyQuestions ? surveyQuestions : [];
  const answeredCount = useMemo(
    () => visibleSurveyQuestions.filter(isQuestionAnswered).length,
    [visibleSurveyQuestions, surveyResponses]
  );
  const totalItems = visibleSurveyQuestions.length + 1; // +1 for employment status
  const answeredItems = (employmentStatus ? 1 : 0) + answeredCount;
  const progressPercent = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;
  const isComplete = Boolean(employmentStatus) && (
    shouldShowSurveyQuestions
      ? visibleSurveyQuestions.length > 0 && visibleSurveyQuestions.every(isQuestionAnswered)
      : true
  );
  const needsEmployerContact = employmentStatus === 'EMPLOYED' || employmentStatus === 'SELF_EMPLOYED';

  const handleSurveyOptionSelect = (questionId: string, option: string, optionIndex: number) => {
    setSurveyResponses((prev) => ({
      ...prev,
      [questionId]: {
        score: optionIndex + 1,
        selected_option_label: option,
      },
    }));
  };

  const handleSurveyTextAnswer = (questionId: string, text: string) => {
    setSurveyResponses((prev) => ({
      ...prev,
      [questionId]: {
        text_answer: text,
      },
    }));
  };

  const handleSurveySubmit = async () => {
    if (!surveyCycleId) {
      toast.error('Survey is in preview mode. Please activate the cycle before submitting.');
      return;
    }

    const studentIdentifier = resolveAlumniStudentIdentifier(currentUser, alumniData);
    if (!studentIdentifier) {
      toast.error('Your alumni profile was not found. Please sign in again.');
      return;
    }

    if (!employmentStatus) {
      toast.error('Please select your Employment Status.');
      return;
    }

    if (needsEmployerContact && !organizationName.trim()) {
      toast.error('Please enter your organization or company name.');
      return;
    }

    if (needsEmployerContact && !employerContactName.trim()) {
      toast.error('Please enter employer contact person name.');
      return;
    }

    if (needsEmployerContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employerContactEmail.trim())) {
      toast.error('Please enter a valid employer contact email.');
      return;
    }

    if (!isComplete) {
      toast.error('Please answer all survey questions.');
      return;
    }

    setSurveySubmitting(true);
    try {
      await obeService.submitAlumniSurvey(String(surveyCycleId), String(studentIdentifier), {
        responses: visibleSurveyQuestions.map((question) => ({
          question: question.id,
          score: surveyResponses[question.id]?.score,
          selected_option_label: surveyResponses[question.id]?.selected_option_label,
          text_answer: surveyResponses[question.id]?.text_answer,
        })),
        employment_status: employmentStatus,
        organization_name: organizationName.trim(),
        current_designation: currentDesignation.trim(),
        employer_contact_name: employerContactName.trim(),
        employer_contact_email: employerContactEmail.trim(),
      });

      localStorage.setItem(surveyStorageKey(String(surveyCycleId), String(studentIdentifier)), 'true');
      setHasSubmitted(true);
      toast.success('Thank you. Your survey is now locked.');
      navigate('/alumni', { replace: true });
    } catch (error) {
      console.error('Failed to submit alumni survey:', error);
      toast.error('Failed to submit survey');
    } finally {
      setSurveySubmitting(false);
    }
  };

  const renderLoading = () => (
    <div className="flex items-center justify-center h-64">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
    </div>
  );

  const renderDashboard = () => {
    if (loading || !alumniData) return renderLoading();

    return (
      <div className="space-y-6">
        <section className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-8 rounded-2xl text-white shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider">
                  Alumni
                </span>
                <span className="text-blue-100 text-xs font-bold">Class of {alumniData.graduation_year}</span>
              </div>
              <h2 className="text-3xl font-bold mb-1">{alumniData.name}</h2>
              <p className="text-blue-100">
                {alumniData.program} • {alumniData.batch}
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur px-8 py-5 rounded-xl text-center border border-white/20">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">CGPA</p>
              <p className="text-4xl font-bold">{alumniData.cgpa.toFixed(2)}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'CGPA', value: alumniData.cgpa.toFixed(2), icon: Award, color: 'text-pink-500', bg: 'bg-pink-50' },
            { label: 'Program', value: alumniData.program, icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Courses', value: alumniData.completed_courses, icon: ClipboardList, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            {
              label: 'Survey',
              value: hasSubmitted ? 'Submitted' : surveyQuestions.length > 0 ? 'Pending' : 'Closed',
              icon: Send,
              color: hasSubmitted ? 'text-emerald-500' : 'text-amber-500',
              bg: hasSubmitted ? 'bg-emerald-50' : 'bg-amber-50',
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </motion.div>
          ))}
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Building className="w-5 h-5 text-pink-500" />
                Professional Details
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Your alumni profile stays aligned with the official alumni records.
              </p>
            </div>
            <button
              onClick={openSurvey}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Open Survey
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Employer</p>
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-blue-500" />
                <span className="text-lg font-semibold text-gray-800">{alumniData.current_employer || 'N/A'}</span>
              </div>
            </div>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Designation</p>
              <div className="flex items-center gap-3">
                <BriefcaseIcon />
                <span className="text-lg font-semibold text-gray-800">{alumniData.designation || 'N/A'}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-3 text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">
              Professional details are managed by the Alumni Office. To request an update, please contact alumni-relations@eduobe.edu
            </p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
                Survey Status
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Complete the locked PEO survey to keep the alumni portal fully available.
              </p>
            </div>
            <button
              onClick={openSurvey}
              className="inline-flex items-center gap-2 bg-pink-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-pink-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              Open Survey
            </button>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-pink-50 border border-indigo-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Current Status</p>
              <p className="text-lg font-bold text-gray-900">
                {hasSubmitted
                  ? 'Survey submitted'
                  : surveyQuestions.length > 0
                    ? surveyQuestionsSource === 'peo'
                      ? 'Preview available'
                      : 'Survey pending'
                    : 'No active cycle'}
              </p>
              <p className="text-sm text-gray-600">
                {hasSubmitted
                  ? 'Your response has been recorded and the portal is unlocked.'
                  : surveyQuestions.length > 0
                    ? surveyQuestionsSource === 'peo'
                      ? 'The questions are loaded from the locked PEO definitions. Activate the cycle to submit responses.'
                      : 'The portal follows the same locked workflow as the student exit survey.'
                    : 'A survey cycle will appear here when the coordinator activates one.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white border border-indigo-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Cycle</p>
                <p className="font-bold text-gray-900 mt-1">{surveyCycleId || (surveyQuestionsSource === 'peo' ? 'Preview' : 'Closed')}</p>
              </div>
              <div className="rounded-xl bg-white border border-indigo-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">State</p>
                <p className="font-bold text-gray-900 mt-1">
                  {hasSubmitted ? 'Unlocked' : surveyQuestions.length > 0 ? 'Locked' : 'Idle'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderTranscript = () => {
    if (loading || !alumniData) return renderLoading();

    return (
      <section className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/60">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-blue-600" />
                Academic Transcript
              </h3>
              <p className="text-gray-500 text-sm mt-1">Official record of academic performance</p>
            </div>
            <button
              disabled
              className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-200 flex items-center gap-2 opacity-50 cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {alumniData.transcripts.map((semesterBlock) => (
              <div key={semesterBlock.semester} className="p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Semester</p>
                    <h4 className="text-lg font-bold text-gray-900 mt-1">{semesterBlock.semester}</h4>
                  </div>
                  <div className="rounded-full bg-blue-50 text-blue-700 px-4 py-2 text-sm font-semibold">
                    {semesterBlock.courses_count} Courses
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                        <th className="px-4 py-3">Course</th>
                        <th className="px-4 py-3">Credits</th>
                        <th className="px-4 py-3 text-right">GPA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {semesterBlock.courses.map((course, index) => (
                        <tr key={`${semesterBlock.semester}-${course.course_code}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {course.course_code} - {course.course_name}
                              </p>
                              <p className="text-sm text-gray-500">{course.percentage.toFixed(1)}% overall</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-600">{course.credits}</td>
                          <td className="px-4 py-4 text-right font-bold text-blue-600 text-lg">{course.gpa.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-600 text-white px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <span className="font-bold text-lg">Cumulative GPA</span>
            <span className="font-black text-3xl">{alumniData.cgpa.toFixed(2)}</span>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      <Toaster position="top-right" />
      <AnimatePresence>
        {showSurveyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 8, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-[32px] bg-white shadow-[0_30px_100px_rgba(15,23,42,0.45)] border border-white/60"
            >
              <div className="flex flex-col h-full max-h-[92vh]">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#E8EFF8]">
                  <section className="bg-white rounded-[32px] p-8 shadow-lg border border-gray-100">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-slate-500 text-xs font-black uppercase tracking-widest">
                          Alumni PEO Survey
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-[#F7C948]/10 border border-[#F7C948]/20 px-4 py-2 text-[#F7C948] text-xs font-black uppercase tracking-widest">
                          <Lock className="w-4 h-4" />
                          {hasSubmitted ? 'Survey Submitted' : 'Locked'}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-6 flex-wrap">
                        <div>
                          <h2 className="text-3xl md:text-4xl font-black text-gray-900">{progressPercent}% Complete</h2>
                          <p className="text-gray-500 font-medium mt-1">
                            {surveyQuestionsSource === 'peo'
                              ? 'Loaded from the locked PEO definition.'
                              : `Locked PEO survey cycle ${surveyCycleId || ''}`.trim()}
                          </p>
                        </div>
                        <div className="w-full md:w-72 space-y-2">
                          <div className="flex justify-between text-xs font-black uppercase tracking-tight">
                            <span className="text-gray-400">Completion Progress</span>
                            <span className="text-indigo-600">{progressPercent}%</span>
                          </div>
                          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercent}%` }}
                              className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Employment Status Section */}
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 bg-white rounded-[28px] p-8 border border-gray-100 shadow-sm"
                  >
                    <h3 className="text-xl font-bold text-gray-800 mb-6">Section 1: Employment Status (Basic Information)</h3>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">
                        Employment Status
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { value: 'EMPLOYED', label: 'Employed' },
                          { value: 'SELF_EMPLOYED', label: 'Self-Employed / Entrepreneur' },
                          { value: 'HIGHER_STUDIES', label: 'Higher Studies' },
                          { value: 'UNEMPLOYED', label: 'Unemployed / Looking for Job' },
                          { value: 'HOUSEWIFE', label: 'Housewife / Homemaker' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setEmploymentStatus(option.value)}
                            className={`px-4 py-3 rounded-xl border-2 flex items-center justify-center font-semibold transition-all ${
                              employmentStatus === option.value
                                ? 'bg-gradient-to-r from-pink-500 to-indigo-500 text-white border-indigo-600 shadow-lg'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {needsEmployerContact && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">
                            Organization / Company Name
                          </label>
                          <input
                            type="text"
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
                            placeholder="e.g., Systems Ltd, NetSol"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">
                            Current Designation
                          </label>
                          <input
                            type="text"
                            value={currentDesignation}
                            onChange={(e) => setCurrentDesignation(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
                            placeholder="e.g., Software Engineer, SQA, Team Lead"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">
                            Employer Contact Person
                          </label>
                          <input
                            type="text"
                            value={employerContactName}
                            onChange={(e) => setEmployerContactName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
                            placeholder="e.g., HR manager or direct supervisor"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">
                            Employer Contact Email
                          </label>
                          <input
                            type="email"
                            value={employerContactEmail}
                            onChange={(e) => setEmployerContactEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
                            placeholder="e.g., hr@company.com"
                          />
                        </div>
                      </div>
                    )}
                  </motion.section>

                  {surveyLoading ? (
                    <div className="mt-8 rounded-[28px] bg-white p-8 border border-gray-100 shadow-sm flex items-center justify-center">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
                    </div>
                  ) : !shouldShowSurveyQuestions ? (
                    <section className="mt-8 bg-white rounded-[28px] p-8 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between gap-4 flex-col md:flex-row">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-black text-gray-900">Ready to submit</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              PEO questions are not required for this employment status.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleSurveySubmit}
                          disabled={surveySubmitting || !isComplete}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-500 px-6 py-4 font-black text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                          {surveySubmitting ? 'Submitting...' : 'Submit Survey'}
                        </button>
                      </div>
                    </section>
                  ) : surveyQuestions.length === 0 ? (
                    <section className="mt-8 bg-white rounded-[28px] p-8 border border-gray-100 shadow-sm text-center">
                      <h2 className="text-2xl font-black text-gray-900">
                        {surveyQuestionsSource === 'peo' ? 'Preview mode' : 'Survey not ready yet'}
                      </h2>
                      <p className="text-gray-600 mt-2">
                        {surveyQuestionsSource === 'peo'
                          ? 'The locked PEO questions are available now. Activate the cycle to enable submission.'
                          : 'The coordinator has enabled alumni feedback, but the PEO question set is still syncing. Please refresh in a moment.'}
                      </p>
                    </section>
                  ) : (
                    <>
                      <div className="mt-8 space-y-5">
                        {visibleSurveyQuestions.map((question, index) => {
                          const selected = surveyResponses[question.id] || {};
                          const questionType = getQuestionType(question);
                          const questionOptions = getQuestionOptions(question);
                          return (
                            <motion.article
                              key={question.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-white rounded-[26px] border border-gray-100 shadow-sm p-6"
                            >
                              <div className="flex items-start gap-4 mb-5">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-500 text-white font-black flex items-center justify-center flex-shrink-0 shadow-lg">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500 mb-2">
                                    {getQuestionScopeLabel(question)}
                                  </p>
                                  <p className="text-gray-700 leading-relaxed text-lg font-medium">
                                    {question.question_text}
                                  </p>
                                </div>
                              </div>
                              {questionType === 'TEXT' ? (
                                <textarea
                                  value={selected.text_answer || ''}
                                  onChange={(event) => handleSurveyTextAnswer(question.id, event.target.value)}
                                  rows={4}
                                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 transition-all focus:border-indigo-400 focus:outline-none"
                                  placeholder="Write your answer..."
                                />
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                  {questionOptions.map((option, optionIndex) => {
                                    const isSelected = selected.selected_option_label === option || selected.score === optionIndex + 1;
                                    return (
                                      <button
                                        key={`${question.id}-${optionIndex}`}
                                        onClick={() => handleSurveyOptionSelect(question.id, option, optionIndex)}
                                        className={`rounded-2xl border-2 px-4 py-3 font-semibold transition-all ${
                                          isSelected
                                            ? 'bg-gradient-to-r from-indigo-600 to-pink-500 text-white border-transparent shadow-lg'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                        }`}
                                      >
                                        {option}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </motion.article>
                          );
                        })}
                      </div>
                      <section className="mt-8 bg-white rounded-[28px] p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between gap-4 flex-col md:flex-row">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-black text-gray-900">100% Complete</h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {answeredCount} of {visibleSurveyQuestions.length} questions answered
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleSurveySubmit}
                            disabled={surveySubmitting || !isComplete}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-500 px-6 py-4 font-black text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="w-4 h-4" />
                            {surveySubmitting ? 'Submitting...' : 'Submit Survey'}
                          </button>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className={`w-72 bg-gradient-to-b ${sidebarGradient} text-white p-6 space-y-2 min-h-screen shadow-xl flex flex-col ${
          showSurveyModal ? 'opacity-40 pointer-events-none blur-[1px]' : ''
        }`}
      >
        <div className="mb-12 text-center">
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-4 flex items-center justify-center border border-white/30 shadow-inner">
            <GraduationCap className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">Alumni Portal</h3>
          <p className="text-xs text-blue-200 font-bold uppercase tracking-widest mt-1">
            Class of {alumniData?.graduation_year || ''}
          </p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-5 py-4 rounded-[18px] transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-white text-blue-600 shadow-xl border border-white'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mr-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-blue-200'}`} />
                    <span className="font-black text-sm">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center px-5 py-4 rounded-[18px] text-red-100 bg-red-500/20 hover:bg-red-500/40 transition-all duration-300 border border-red-500/20"
          >
            <LogOut className="h-5 w-5 mr-4" />
            <span className="font-black text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      <div className={`flex-1 flex flex-col h-screen overflow-hidden ${showSurveyModal ? 'opacity-40 pointer-events-none blur-[1px]' : ''}`}>
        <header className={`bg-gradient-to-r ${headerGradient} p-8 shadow-xl border-b border-white/10 z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white shadow-lg overflow-hidden">
                <span className="text-2xl font-black text-white">{headerName.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">
                  {tabs.find((tab) => tab.id === activeTab)?.label}
                </h1>
                <p className="text-blue-100 text-sm font-medium mt-1">Welcome back, {headerName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <TopbarProfileMenu userData={currentUser} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              >
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'transcript' && renderTranscript()}
              </motion.div>
          </AnimatePresence>

          <footer className="mt-16 py-8 border-t border-gray-200 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 opacity-30 grayscale">
              <GraduationCap className="w-5 h-5" />
              <span className="text-xs font-black tracking-widest uppercase">EduOBE Alumni Network</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
              © 2026 Higher Education Portal • Engineering Excellence
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

const BriefcaseIcon = () => <Building className="w-5 h-5 text-indigo-500" />;

export default AlumniDashboard;
