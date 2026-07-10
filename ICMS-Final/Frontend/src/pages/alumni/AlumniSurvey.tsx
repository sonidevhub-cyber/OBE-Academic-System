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
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
];

const AlumniSurvey: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [alumniData, setAlumniData] = useState<AlumniDashboardResponse | null>(null);
  const [activeCycle, setActiveCycle] = useState<SurveyCycle | null>(null);
  const [questions, setQuestions] = useState<AlumniSurveyQuestion[]>([]);
  const [questionsSource, setQuestionsSource] = useState<'cycle' | 'peo' | null>(null);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [employmentStatus, setEmploymentStatus] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [currentDesignation, setCurrentDesignation] = useState('');
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
        setHasSubmitted(
          cycle ? localStorage.getItem(storageKey(cycle.id, String(studentId || 'guest'))) === 'true' : false
        );

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
            console.log("[AlumniSurvey] Loading PEOs for effectiveProgramId: ", effectiveProgramId);
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
          const initialResponses: Record<string, number> = {};
          cycleQuestions.forEach((question) => {
            initialResponses[question.id] = 0;
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
        const initialResponses: Record<string, number> = {};
        peoQuestions.forEach((question) => {
          initialResponses[question.id] = 0;
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

  const answeredCount = useMemo(
    () => questions.filter((question) => (responses[question.id] || 0) > 0).length,
    [questions, responses]
  );
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const isComplete = questions.length > 0 && questions.every((question) => (responses[question.id] || 0) > 0);

  const handleRating = (questionId: string, rating: number) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: rating,
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

    if (!isComplete) {
      toast.error('Please answer all survey questions.');
      return;
    }

    setIsSubmitting(true);
    try {
      await obeService.submitAlumniSurvey(String(activeCycle.id), String(studentId), {
        employment_status: employmentStatus ?? undefined,
        organization_name: organizationName || undefined,
        current_designation: currentDesignation || undefined,
        responses: questions.map((question) => ({
          question: question.id,
          score: responses[question.id],
        })),
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
                <h1 className="text-3xl md:text-5xl font-black text-gray-900">100% Complete</h1>
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

          {(employmentStatus === 'EMPLOYED' || employmentStatus === 'SELF_EMPLOYED') && (
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
            </div>
          )}
        </motion.section>

        <div className="space-y-6">
          {questions.map((question, index) => (
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
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-[#F7C948]/10 text-[#F7C948] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-[#F7C948]/20 flex items-center gap-2">
                        <Award className="w-3 h-3" />
                        {question.peo_title || 'PEO'}
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-500/20 flex items-center gap-2">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white leading-tight">
                      {question.question_text}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-center flex-wrap">
                {ratingLabels.map((rating) => (
                  <button
                    key={rating.value}
                    onClick={() => handleRating(question.id, rating.value)}
                    className={`px-4 py-3 rounded-xl border-2 flex items-center justify-center font-semibold transition-all ${
                      responses[question.id] === rating.value
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-lg'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                    }`}
                  >
                    {rating.label}
                  </button>
                ))}
              </div>
            </motion.section>
          ))}
        </div>

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
