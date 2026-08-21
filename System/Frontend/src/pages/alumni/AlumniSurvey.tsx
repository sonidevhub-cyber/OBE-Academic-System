import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  Lock,
  Send,
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext';
import obeService, {
  AlumniDashboardResponse,
  AlumniSurveyQuestion,
  PEO,
} from '../../api/obeService';

type SurveyCycle = {
  id: string;
  survey_window: string;
  status: string;
  due_at?: string | null;
  batch: string;
  batch_name?: string;
};

type AlumniAnswerValue = {
  score?: number;
  selected_option_label?: string;
  text_answer?: string;
};

const storageKey = (cycleId: string, studentId: string) =>
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

const ratingLabels = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Below Average' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
];

const getQuestionType = (question: AlumniSurveyQuestion) => question.question_type || 'RATING_SCALE';
const getQuestionOptions = (question: AlumniSurveyQuestion) => {
  if (getQuestionType(question) === 'TEXT') return [];
  const options = question.effective_options?.length
    ? question.effective_options
    : question.custom_options?.length
      ? question.custom_options
      : ratingLabels.map(item => item.label);
  return options.map(option => String(option));
};

const AlumniSurvey: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [alumniData, setAlumniData] = useState<AlumniDashboardResponse | null>(null);
  const [activeCycle, setActiveCycle] = useState<SurveyCycle | null>(null);
  const [questions, setQuestions] = useState<AlumniSurveyQuestion[]>([]);
  const [questionsSource, setQuestionsSource] = useState<'cycle' | 'peo' | null>(null);
  const [responses, setResponses] = useState<Record<string, AlumniAnswerValue>>({});
  const [employmentStatus, setEmploymentStatus] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [currentDesignation, setCurrentDesignation] = useState('');
  const [employerContactName, setEmployerContactName] = useState('');
  const [employerContactEmail, setEmployerContactEmail] = useState('');
  const [higherStudiesUniversity, setHigherStudiesUniversity] = useState('');
  const [higherStudiesDegree, setHigherStudiesDegree] = useState('');
  const [higherStudiesCountry, setHigherStudiesCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const batchId =
    currentUser?.batch_id ||
    currentUser?.batch?.id ||
    currentUser?.batchId ||
    currentUser?.original_batch?.id ||
    null;
  useEffect(() => {
    let cancelled = false;

    const loadSurvey = async () => {
      try {
        setLoading(true);
        console.log("[AlumniSurvey] Starting loadSurvey...");
        
        const dashboard = await obeService.getAlumniDashboard().catch((err) => {
          console.error("[AlumniSurvey] Error loading dashboard:", err);
          return null;
        });
        console.log("[AlumniSurvey] Dashboard data:", dashboard);

        if (cancelled) return;
        if (dashboard) {
          setAlumniData(dashboard);
        }

        const effectiveBatchId = batchId || dashboard?.batch_id || null;
        let effectiveProgramId = dashboard?.program_id || currentUser?.program_id || null;
        // Also try to get programId from batch if we have batchId
        if (!effectiveProgramId && effectiveBatchId) {
          // We don't have a direct API for that, but let's rely on dashboard
          console.log("[AlumniSurvey] No programId yet, hoping dashboard provides it");
        }
        console.log("[AlumniSurvey] effectiveBatchId:", effectiveBatchId);
        console.log("[AlumniSurvey] effectiveProgramId:", effectiveProgramId);
        console.log("[AlumniSurvey] currentUser:", currentUser);
        
        const cycles = effectiveBatchId
          ? await obeService.getAlumniSurveyCycles(String(effectiveBatchId)).catch((err) => {
              console.error("[AlumniSurvey] Error loading cycles:", err);
              return [];
            })
          : [];
        console.log("[AlumniSurvey] Cycles data:", cycles);

        if (cancelled) return;

        const cycle = cycles.find((item: SurveyCycle) => item.status === 'ACTIVE') || null;
        console.log("[AlumniSurvey] Found active cycle:", cycle);
        setActiveCycle(cycle);

        const studentId = resolveAlumniStudentIdentifier(currentUser, dashboard);
        console.log("[AlumniSurvey] studentId:", studentId);
        let submitted = false;
        if (cycle && effectiveBatchId) {
          const statusPayload = await obeService
            .getAlumniSurveyStatus(String(effectiveBatchId), studentId ? String(studentId) : undefined)
            .catch((err) => {
              console.error("[AlumniSurvey] Error loading survey status:", err);
              return null;
            });
          submitted = Boolean(statusPayload?.submitted);
          const key = storageKey(cycle.id, String(studentId || 'guest'));
          if (submitted) {
            localStorage.setItem(key, 'true');
          } else {
            localStorage.removeItem(key);
          }
        }
        setHasSubmitted(submitted);

        const loadCycleQuestions = async () => {
          if (!cycle) return [];
          try {
            console.log("[AlumniSurvey] Loading cycle questions for cycle.id: ", cycle.id);
            const questionData = await obeService.getAlumniSurveyQuestions(cycle.id);
            console.log("[AlumniSurvey] Cycle question data: ", questionData);
            return Array.isArray(questionData) ? questionData : [];
          } catch (error) {
            console.error("[AlumniSurvey] Error loading cycle questions: ", error);
            return [];
          }
        };

        const loadPeoQuestions = async () => {
          if (!effectiveProgramId) return [];
          try {
            console.log("[AlumniSurvey] Loading unified ALUMNI SurveyQuestions for program:", effectiveProgramId);
            const unified = await obeService.getSurveyQuestions(String(effectiveProgramId), 'ALUMNI').catch((err) => {
              console.error("[AlumniSurvey] Error loading unified alumni survey questions:", err);
              return [];
            });
            console.log("[AlumniSurvey] Unified ALUMNI questions:", unified);
            if (Array.isArray(unified) && unified.length > 0) {
              return unified as any;
            }

            console.log("[AlumniSurvey] Falling back to per-PEO alumni survey questions.");
            const peos: PEO[] = await obeService.getProgramPEOs(String(effectiveProgramId)).catch((err) => {
              console.error("[AlumniSurvey] Error loading PEOs:", err);
              return [];
            });
            console.log("[AlumniSurvey] Loaded PEOs: ", peos);
            const questionGroups = await Promise.all(
              peos.map((peo) => obeService.getPEOAlumniSurveyQuestions(peo.id).catch((err) => {
                console.error("[AlumniSurvey] Error loading questions for PEO", peo.id, ":", err);
                return [];
              }))
            );
            console.log("[AlumniSurvey] PEO question groups: ", questionGroups);
            return questionGroups.flat();
          } catch (err) {
            console.error("[AlumniSurvey] Error in loadPeoQuestions:", err);
            return [];
          }
        };

        const cycleQuestions = await loadCycleQuestions();
        if (cancelled) return;

        console.log("[AlumniSurvey] Cycle questions length: ", cycleQuestions.length);

        if (cycleQuestions.length > 0) {
          setQuestionsSource('cycle');
          setQuestions(cycleQuestions);
          const initialResponses: Record<string, AlumniAnswerValue> = {};
          cycleQuestions.forEach((question) => {
            initialResponses[question.id] = {};
          });
          setResponses(initialResponses);
          return;
        }

        const peoQuestions = await loadPeoQuestions();
        if (cancelled) return;

        console.log("[AlumniSurvey] PEO questions length: ", peoQuestions.length);
        console.log("[AlumniSurvey] PEO questions: ", peoQuestions);

        setQuestionsSource(peoQuestions.length > 0 ? 'peo' : null);
        setQuestions(peoQuestions);
        const initialResponses: Record<string, AlumniAnswerValue> = {};
        peoQuestions.forEach((question: AlumniSurveyQuestion) => {
          initialResponses[question.id] = {};
        });
        setResponses(initialResponses);
      } catch (error) {
        console.error('[AlumniSurvey] Failed to load alumni survey:', error);
        toast.error('Failed to load alumni survey');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSurvey();

    return () => {
      cancelled = true;
    };
  }, [batchId, currentUser?.program_id]);

  const needsEmployerContact = employmentStatus === 'EMPLOYED' || employmentStatus === 'SELF_EMPLOYED';
  const needsHigherStudiesDetails = employmentStatus === 'HIGHER_STUDIES';
  const shouldShowSurveyQuestions = employmentStatus === 'EMPLOYED' || employmentStatus === 'SELF_EMPLOYED' || employmentStatus === 'HIGHER_STUDIES';
  const visibleQuestions = shouldShowSurveyQuestions ? questions : [];
  const isQuestionAnswered = (question: AlumniSurveyQuestion) => {
    const answer = responses[question.id] || {};
    if (getQuestionType(question) === 'TEXT') {
      return Boolean(answer.text_answer?.trim());
    }
    return Boolean(answer.selected_option_label?.trim()) || Boolean(answer.score && answer.score > 0);
  };
  const answeredCount = useMemo(
    () => visibleQuestions.filter(isQuestionAnswered).length,
    [visibleQuestions, responses]
  );
  const isComplete = shouldShowSurveyQuestions
    ? visibleQuestions.length > 0 && visibleQuestions.every(isQuestionAnswered)
    : employmentStatus === 'UNEMPLOYED' || employmentStatus === 'HOUSEWIFE';
  const progressPercent = shouldShowSurveyQuestions
    ? visibleQuestions.length ? Math.round((answeredCount / visibleQuestions.length) * 100) : 0
    : isComplete ? 100 : 0;

  const handleOptionSelect = (question: AlumniSurveyQuestion, option: string, optionIndex: number) => {
    setResponses((prev) => ({
      ...prev,
      [question.id]: {
        score: optionIndex + 1,
        selected_option_label: option,
      },
    }));
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { text_answer: text },
    }));
  };

  const handleSubmit = async () => {
    if (!activeCycle) {
      toast.error('Survey is not activated yet. The questions are visible, but submission is locked.');
      return;
    }

    const studentId = resolveAlumniStudentIdentifier(currentUser, alumniData);
    if (!studentId) {
      toast.error('Your alumni profile was not found. Please sign in again.');
      return;
    }

    if (!employmentStatus) {
      toast.error('Please select your employment status.');
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

    if (needsHigherStudiesDetails && !higherStudiesUniversity.trim()) {
      toast.error('Please enter your university or institution name.');
      return;
    }

    if (needsHigherStudiesDetails && !higherStudiesDegree.trim()) {
      toast.error('Please enter your degree or program name.');
      return;
    }

    if (!isComplete) {
      toast.error(shouldShowSurveyQuestions ? 'Please answer all survey questions.' : 'Please select a valid status.');
      return;
    }

    setIsSubmitting(true);
    try {
      await obeService.submitAlumniSurvey(String(activeCycle.id), String(studentId), {
        employment_status: employmentStatus ?? undefined,
        organization_name: organizationName.trim() || undefined,
        current_designation: currentDesignation.trim() || undefined,
        employer_contact_name: employerContactName.trim() || undefined,
        employer_contact_email: employerContactEmail.trim() || undefined,
        higher_studies_university: higherStudiesUniversity.trim() || undefined,
        higher_studies_degree: higherStudiesDegree.trim() || undefined,
        higher_studies_country: higherStudiesCountry.trim() || undefined,
        responses: visibleQuestions.map((question) => {
          const answer = responses[question.id] || {};
          return {
            question: question.id,
            score: answer.score,
            selected_option_label: answer.selected_option_label,
            text_answer: answer.text_answer,
          };
        }),
      });

      localStorage.setItem(storageKey(activeCycle.id, String(studentId)), 'true');
      setHasSubmitted(true);
      toast.success('Thank you. Your survey is now locked.');
    } catch (error) {
      console.error('Failed to submit alumni survey:', error);
      toast.error('Failed to submit survey');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-6">
        <Toaster position="top-right" />
        <div className="text-[#E6F1FF] font-bold">Loading survey...</div>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-6">
        <Toaster position="top-right" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-[#112240] rounded-[40px] p-10 text-center border border-[#233554] shadow-2xl"
        >
          <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4">Jazakallah!</h2>
          <p className="text-[#8892B0] text-lg leading-relaxed mb-10 font-medium">
            Your alumni PEO survey has been recorded. These responses will support program improvement and CQI review.
          </p>
          <button
            onClick={() => navigate('/alumni')}
            className="w-full bg-[#F7C948] text-[#0A192F] py-4 rounded-2xl font-black text-lg hover:bg-[#F7C948]/90 transition-all shadow-xl shadow-yellow-500/10"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#E8EFF8] text-slate-900 font-sans">
        <Toaster position="top-right" />
        <main className="max-w-5xl mx-auto p-6 py-10">
          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest mb-4">
                  Alumni PEO Survey
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-gray-900">Survey Not Ready</h1>
                <p className="text-gray-500 font-medium mt-3 max-w-3xl">
                  {questionsSource === 'peo'
                    ? 'The locked PEO questions are loaded from the program definition. A live cycle is still required to submit responses.'
                    : 'Complete the alumni PEO survey to unlock the rest of your alumni portal.'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-[220px]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</p>
                <p className="text-2xl font-black text-slate-900 mt-2">{questionsSource === 'peo' ? 'Preview' : 'Locked'}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[28px] p-6 border border-gray-100 shadow-sm mt-8">
            <p className="text-sm text-gray-600 font-medium">
              {questionsSource === 'peo'
                ? 'The locked PEO questions are available now. Activate the cycle to enable submission.'
                : 'The coordinator has enabled alumni feedback, but the PEO question set is still syncing. Please refresh in a moment.'}
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A192F] text-[#E6F1FF] font-sans pb-20">
      <Toaster position="top-right" />

      <main className="max-w-5xl mx-auto p-6 mt-8 space-y-8">
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
                  {questionsSource === 'peo'
                    ? 'Loaded from the locked PEO definition.'
                    : `Locked PEO survey cycle ${activeCycle?.survey_window || ''}`.trim()}
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
          className="bg-[#112240] rounded-[32px] p-8 border border-[#233554] shadow-xl"
        >
          <h3 className="text-xl font-bold text-white mb-6">Section 1: Employment Status (Basic Information)</h3>
          
          <div className="mb-6">
            <label className="block text-sm font-bold text-[#8892B0] mb-3 uppercase tracking-wider">
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
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
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
                <label className="block text-sm font-bold text-[#8892B0] mb-2 uppercase tracking-wider">
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
                <label className="block text-sm font-bold text-[#8892B0] mb-2 uppercase tracking-wider">
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
                <label className="block text-sm font-bold text-[#8892B0] mb-2 uppercase tracking-wider">
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
                <label className="block text-sm font-bold text-[#8892B0] mb-2 uppercase tracking-wider">
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

          {needsHigherStudiesDetails && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#8892B0] mb-2 uppercase tracking-wider">
                  University / Institution Name
                </label>
                <input
                  type="text"
                  value={higherStudiesUniversity}
                  onChange={(e) => setHigherStudiesUniversity(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none text-gray-900"
                  placeholder="e.g., NUST, FAST, University of Lahore"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#8892B0] mb-2 uppercase tracking-wider">
                  Degree / Program
                </label>
                <input
                  type="text"
                  value={higherStudiesDegree}
                  onChange={(e) => setHigherStudiesDegree(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none text-gray-900"
                  placeholder="e.g., MS Computer Science, MBA, PhD"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#8892B0] mb-2 uppercase tracking-wider">
                  Country
                </label>
                <input
                  type="text"
                  value={higherStudiesCountry}
                  onChange={(e) => setHigherStudiesCountry(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none text-gray-900"
                  placeholder="Optional"
                />
              </div>
            </div>
          )}
        </motion.section>

        {!employmentStatus && (
          <section className="bg-[#112240] rounded-[32px] p-8 border border-[#233554] text-center">
            <p className="text-[#8892B0] font-bold">Select employment status to continue.</p>
          </section>
        )}

        {employmentStatus && !shouldShowSurveyQuestions && (
          <section className="bg-[#112240] rounded-[32px] p-8 border border-[#233554] text-center">
            <p className="text-white font-black text-xl mb-2">Survey questions are not required for this status.</p>
            <p className="text-[#8892B0] font-medium">
              Submit your status so the department can keep alumni records accurate.
            </p>
          </section>
        )}

        {shouldShowSurveyQuestions && (
          <div className="space-y-6">
          {visibleQuestions.map((question, index) => (
            <motion.section
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="bg-[#112240] rounded-[32px] p-8 border border-[#233554] shadow-xl relative overflow-hidden group hover:border-[#F7C948]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F7C948] text-[#0A192F] flex items-center justify-center font-black text-lg shadow-lg">
                    {index + 1}
                  </div>
                  <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {(() => {
                        const isGeneral: boolean =
                          (question as any).is_general === true ||
                          ((question as any).peo_id == null && !question.peo_title);
                        if (isGeneral) {
                          return (
                            <span className="bg-indigo-500/15 text-indigo-300 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/30 flex items-center gap-2">
                              <Award className="w-3 h-3" />
                              GENERAL
                            </span>
                          );
                        }
                        const peoLabel = question.peo_title
                          ? `PEO ${(question as any).peo_order_number ? `${(question as any).peo_order_number} · ` : ''}${question.peo_title}`
                          : 'PEO';
                        return (
                          <span className="bg-[#F7C948]/10 text-[#F7C948] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-[#F7C948]/20 flex items-center gap-2">
                            <Award className="w-3 h-3" />
                            {peoLabel}
                          </span>
                        );
                      })()}
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border flex items-center gap-2 ${
                        (question as any).is_locked === false
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      }`}>
                        <Lock className="w-3 h-3" />
                        {(question as any).is_locked === false ? 'Editable' : 'Locked'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white leading-tight">
                      {question.question_text}
                    </h3>
                  </div>
                </div>
              </div>

              {getQuestionType(question) === 'TEXT' ? (
                <textarea
                  value={responses[question.id]?.text_answer || ''}
                  onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                  rows={5}
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-2xl px-5 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Write your answer..."
                />
              ) : (
                <div className="flex gap-2 justify-center flex-wrap">
                  {getQuestionOptions(question).map((option, optionIndex) => {
                    const isSelected = responses[question.id]?.selected_option_label === option
                      || responses[question.id]?.score === optionIndex + 1;
                    return (
                      <button
                        key={`${question.id}-${optionIndex}`}
                        onClick={() => handleOptionSelect(question, option, optionIndex)}
                        className={`px-4 py-3 rounded-xl border-2 flex items-center justify-center font-semibold transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-lg'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.section>
          ))}
          </div>
        )}

        <div className="pt-8 flex flex-col items-center gap-6">
          <button
            onClick={handleSubmit}
            disabled={!activeCycle || !isComplete || isSubmitting}
            className={`w-full max-w-md py-5 rounded-[24px] font-black text-xl transition-all flex items-center justify-center gap-3 shadow-2xl ${
              activeCycle && isComplete && !isSubmitting
                ? 'bg-[#F7C948] text-[#0A192F] hover:bg-[#F7C948]/90 active:scale-95 shadow-yellow-500/20'
                : 'bg-[#112240] text-[#3B4C66] cursor-not-allowed border border-[#233554]'
            }`}
          >
            <Send className="w-6 h-6" />
            {isSubmitting ? 'Submitting...' : activeCycle ? 'Submit Survey' : 'Activation Required'}
          </button>

          <p className="text-[#3B4C66] text-xs font-bold uppercase tracking-widest">
            Locked PEO Definitions • Educational Excellence
          </p>
        </div>
      </main>
    </div>
  );
};

export default AlumniSurvey;
