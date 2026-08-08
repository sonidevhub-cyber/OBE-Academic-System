import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Briefcase,
  CheckCircle2,
  Send,
  AlertTriangle,
  Loader2,
  User,
  Building2,
  GraduationCap,
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

import obeService, {
  EmployerSurveyPublicQuestion,
  EmployerSurveySubmissionAnswer,
} from '../../api/obeService';

const ratingLabels = [
  { value: 1, label: 'Strongly Disagree', short: '1', hint: 'Poor / Does not demonstrate' },
  { value: 2, label: 'Disagree', short: '2', hint: 'Below expectations' },
  { value: 3, label: 'Neutral', short: '3', hint: 'Meets minimum expectations' },
  { value: 4, label: 'Agree', short: '4', hint: 'Exceeds expectations' },
  { value: 5, label: 'Strongly Agree', short: '5', hint: 'Exceptional / Outstanding' },
];

type EmployerAnswerValue = {
  score?: number;
  selected_option_label?: string;
  text_answer?: string;
};

const getQuestionType = (question: EmployerSurveyPublicQuestion) => question.question_type || 'RATING_SCALE';
const getQuestionOptions = (question: EmployerSurveyPublicQuestion) => {
  if (getQuestionType(question) === 'TEXT') return [];
  const options = question.effective_options?.length
    ? question.effective_options
    : question.custom_options?.length
      ? question.custom_options
      : ratingLabels.map(item => item.label);
  return options.map(option => String(option));
};

const EmployerSurveyPublicPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);

  const [employerEmail, setEmployerEmail] = useState<string>('');
  const [employerOrganization, setEmployerOrganization] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');

  const [questions, setQuestions] = useState<EmployerSurveyPublicQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, EmployerAnswerValue>>({});
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({});
  const [additionalFeedback, setAdditionalFeedback] = useState('');

  const peoGroupedQuestions = useMemo(() => {
    const groups: Array<{
      key: string;
      title: string;
      subtitle?: string;
      items: EmployerSurveyPublicQuestion[];
    }> = [];
    const generalItems: EmployerSurveyPublicQuestion[] = [];

    questions.forEach(q => {
      if (q.is_general || !q.peo_title) {
        generalItems.push(q);
        return;
      }
      const key = `peo-${q.peo_order_number ?? q.peo_title}`;
      let existing = groups.find(g => g.key === key);
      if (!existing) {
        existing = {
          key,
          title: `PEO ${q.peo_order_number ?? ''} · ${q.peo_title}`.trim(),
          subtitle: q.peo_order_number ? `Program Educational Objective #${q.peo_order_number}` : undefined,
          items: [],
        };
        groups.push(existing);
      }
      existing.items.push(q);
    });

    if (generalItems.length > 0) {
      groups.unshift({
        key: 'general',
        title: 'General Feedback',
        subtitle: 'Overall impressions and open feedback',
        items: generalItems,
      });
    }
    return groups;
  }, [questions]);

  const isQuestionAnswered = (question: EmployerSurveyPublicQuestion) => {
    const answer = responses[question.id] || {};
    if (getQuestionType(question) === 'TEXT') {
      return Boolean(answer.text_answer?.trim());
    }
    return Boolean(answer.selected_option_label?.trim()) || Boolean(answer.score && answer.score > 0);
  };
  const answeredCount = useMemo(
    () => questions.filter(isQuestionAnswered).length,
    [questions, responses],
  );
  const requiredCount = questions.length;
  const progressPct = requiredCount === 0 ? 0 : Math.round((answeredCount / requiredCount) * 100);
  const allAnswered = answeredCount >= requiredCount;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setTokenValid(false);
        setInvalidMessage('Missing survey token. Please use the link you received in your email.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const payload = await obeService.getEmployerSurveyPublicQuestions(token);
        if (cancelled) return;
        if (!payload.valid) {
          setTokenValid(false);
          setInvalidMessage(payload.message || 'This survey link is no longer valid. It may have expired or already been used.');
          setLoading(false);
          return;
        }
        setEmployerEmail(payload.employer_email || '');
        setEmployerOrganization(payload.employer_organization || '');
        setEmployeeName(payload.employee_name_at_org || '');
        setQuestions(payload.questions || []);
        setTokenValid(true);
      } catch (err: any) {
        if (cancelled) return;
        console.error(err);
        setTokenValid(false);
        const status = err?.response?.status;
        const serverMessage = err?.response?.data?.message || err?.response?.data?.detail;
        if (status === 404 || status === 410) {
          setInvalidMessage(serverMessage || 'This survey link was not found or has been archived.');
        } else if (status === 409) {
          setInvalidMessage(serverMessage || 'This survey has already been submitted. Thank you!');
        } else {
          setInvalidMessage(serverMessage || 'We could not load this survey. Please try again later or contact the program administration.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [token]);

  const setOptionAnswer = (questionId: string, label: string, value: number) => {
    setResponses(prev => ({ ...prev, [questionId]: { score: value, selected_option_label: label } }));
  };

  const setTextAnswer = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: { text_answer: value } }));
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!allAnswered) {
      toast.error(`Please answer all ${requiredCount} required questions before submitting.`);
      return;
    }
    const answers: EmployerSurveySubmissionAnswer[] = questions
      .filter(isQuestionAnswered)
      .map(q => ({
        question_id: q.id,
        score: responses[q.id]?.score,
        selected_option_label: responses[q.id]?.selected_option_label,
        text_answer: responses[q.id]?.text_answer,
      }));
    try {
      setSubmitting(true);
      await obeService.submitEmployerSurveyByToken(token, answers);
      setHasSubmitted(true);
      toast.success('Thank you! Your employer feedback has been recorded successfully.');
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to submit survey. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/40 to-indigo-50/40">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
              <Briefcase size={22} />
            </div>
            <div>
              <h1 className="font-black text-gray-900 leading-tight">Employer Outcome Survey</h1>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Program Educational Objectives · Employer Feedback
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
          >
            Return to Portal
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-16 text-center"
          >
            <Loader2 size={36} className="mx-auto text-emerald-600 animate-spin mb-5" />
            <h2 className="font-black text-gray-900 text-lg mb-1">Loading your survey…</h2>
            <p className="text-sm text-gray-500">Validating your unique survey token.</p>
          </motion.div>
        )}

        {!loading && !tokenValid && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-10 sm:p-14 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h2 className="font-black text-gray-900 text-2xl mb-3">Survey Not Available</h2>
            <p className="text-gray-600 text-base leading-relaxed max-w-xl mx-auto">
              {invalidMessage || 'This employer survey link could not be loaded. If you believe this is an error, please contact the program administration or the graduate who referred you.'}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all"
              >
                Retry Loading
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all"
              >
                Go to Homepage
              </button>
            </div>
          </motion.div>
        )}

        {!loading && tokenValid && !hasSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Respondent Info */}
            <section className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-7 sm:p-8">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-lg">About This Response</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Confirm the graduate and employer context for this feedback.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                    Graduate / Employee Name
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5">
                    <GraduationCap size={16} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="Name of the graduate you are evaluating"
                      className="flex-1 bg-transparent font-semibold text-sm text-gray-800 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                    Organization / Company
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5">
                    <Building2 size={16} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={employerOrganization}
                      onChange={(e) => setEmployerOrganization(e.target.value)}
                      placeholder="Your organization name"
                      className="flex-1 bg-transparent font-semibold text-sm text-gray-800 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                    Employer Contact Email
                  </label>
                  <input
                    type="email"
                    value={employerEmail}
                    onChange={(e) => setEmployerEmail(e.target.value)}
                    placeholder="you@organization.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-semibold text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            </section>

            {/* Progress */}
            <section className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-7 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-black text-gray-900 text-lg flex items-center gap-2">
                    Your Progress
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Rate the graduate on each item below. All questions are required.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-3xl font-black text-emerald-600 leading-none">{progressPct}%</div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                      {answeredCount} / {requiredCount} answered
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                />
              </div>
            </section>

            {/* Questions by Group */}
            {peoGroupedQuestions.map((group, gIdx) => (
              <motion.section
                key={group.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(gIdx * 0.04, 0.2) }}
                className="bg-white rounded-[32px] shadow-xl border border-slate-100 overflow-hidden"
              >
                <div className={`px-7 sm:px-8 py-5 border-b border-slate-100 ${
                  group.key === 'general'
                    ? 'bg-gradient-to-r from-slate-50 to-white'
                    : 'bg-gradient-to-r from-indigo-50/60 via-white to-emerald-50/40'
                }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                      Section {gIdx + 1}
                    </span>
                    {group.key !== 'general' && (
                      <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        PEO Mapped
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-gray-900 text-lg leading-snug">{group.title}</h3>
                  {group.subtitle && (
                    <p className="text-sm text-gray-500 mt-0.5">{group.subtitle}</p>
                  )}
                </div>
                <div className="p-7 sm:p-8 space-y-6 sm:space-y-7">
                  {group.items.map((q, qIdx) => {
                    const selected = responses[q.id] || {};
                    const questionType = getQuestionType(q);
                    const options = getQuestionOptions(q);
                    return (
                      <div key={q.id} className="border-t border-dashed border-slate-100 first:border-0 pt-6 first:pt-0">
                        <div className="flex items-start gap-3 mb-4">
                          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-black text-xs shrink-0 mt-0.5">
                            Q{qIdx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-gray-900 leading-relaxed">
                              {q.question_text}
                            </p>
                            {!q.is_general && q.peo_title && (
                              <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mt-1.5">
                                Mapped to: PEO {q.peo_order_number ?? ''} · {q.peo_title}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="sm:pl-11">
                          {questionType === 'TEXT' ? (
                            <textarea
                              value={selected.text_answer || ''}
                              onChange={(e) => setTextAnswer(q.id, e.target.value)}
                              placeholder="Write your answer..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all resize-none placeholder:text-slate-400"
                              rows={4}
                            />
                          ) : (
                            <>
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-3 mb-3">
                            {options.map((option, optionIndex) => {
                              const value = optionIndex + 1;
                              const isSelected = selected.selected_option_label === option || selected.score === value;
                              return (
                                <button
                                  key={`${q.id}-${optionIndex}`}
                                  type="button"
                                  onClick={() => setOptionAnswer(q.id, option, value)}
                                  className={`group flex flex-col items-center justify-center py-3.5 sm:py-4 rounded-2xl border-2 transition-all ${
                                    isSelected
                                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200/60 scale-[1.02]'
                                      : 'bg-white border-slate-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                                  }`}
                                >
                                  <span className={`text-lg sm:text-xl font-black leading-none ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                    {value}
                                  </span>
                                  <span className={`mt-1.5 text-[10px] sm:text-[11px] font-bold leading-tight text-center px-1 ${
                                    isSelected ? 'text-emerald-50' : 'text-gray-500'
                                  }`}>
                                    {option}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {selected.score && (
                            <p className="text-[11px] font-bold text-gray-400 mb-2">
                              Hint: {ratingLabels.find(r => r.value === selected.score)?.hint || selected.selected_option_label}
                            </p>
                          )}
                          <textarea
                            value={questionNotes[q.id] || ''}
                            onChange={(e) => setQuestionNotes(prev => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Optional comments or examples to justify this rating…"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all resize-none placeholder:text-slate-400"
                            rows={2}
                          />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            ))}

            {/* Additional Feedback */}
            <section className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-7 sm:p-8">
              <h3 className="font-black text-gray-900 text-lg mb-2">Additional Comments (Optional)</h3>
              <p className="text-sm text-gray-500 mb-4">
                Any other strengths, areas for improvement, or overall feedback on the graduate&apos;s performance and program preparation.
              </p>
              <textarea
                value={additionalFeedback}
                onChange={(e) => setAdditionalFeedback(e.target.value)}
                placeholder="Share any overall thoughts, examples of strengths, or areas where the program could better prepare graduates for your industry…"
                rows={5}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none placeholder:text-slate-400"
              />
            </section>

            {/* Submit */}
            <section className="sticky bottom-4 sm:bottom-6 z-10">
              <div className="bg-white rounded-[28px] shadow-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    allAnswered ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {allAnswered ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
                  </div>
                  <div>
                    <div className="font-black text-gray-900 text-sm">
                      {allAnswered ? 'Ready to Submit' : 'Almost Done'}
                    </div>
                    <div className="text-xs text-gray-500 font-bold">
                      {allAnswered
                        ? 'All required questions answered.'
                        : `Please answer ${requiredCount - answeredCount} more question${requiredCount - answeredCount === 1 ? '' : 's'}.`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!allAnswered || submitting}
                  onClick={handleSubmit}
                  className={`flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-black text-base transition-all ${
                    allAnswered && !submitting
                      ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-xl shadow-emerald-200/60 hover:shadow-emerald-300/70 hover:scale-[1.02]'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      <Send size={20} /> Submit Employer Feedback
                    </>
                  )}
                </button>
              </div>
            </section>
          </motion.div>
        )}

        {!loading && tokenValid && hasSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] shadow-2xl border border-emerald-100 p-10 sm:p-16 text-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 160, damping: 12 }}
              className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-emerald-500 to-indigo-500 text-white flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-200"
            >
              <CheckCircle2 size={52} />
            </motion.div>
            <h2 className="font-black text-gray-900 text-3xl mb-3">Thank You!</h2>
            <p className="text-gray-600 text-base leading-relaxed max-w-xl mx-auto mb-3">
              Your employer feedback has been recorded successfully. It will be combined with other stakeholder responses
              to evaluate Program Educational Objectives and improve the curriculum for future graduates.
            </p>
            <p className="text-sm text-gray-400 max-w-lg mx-auto mb-10">
              On behalf of the program and institution, we greatly appreciate your time and valuable input.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-indigo-600 text-white font-black shadow-xl shadow-emerald-200/60 hover:shadow-emerald-300/70 transition-all"
              >
                Return to Portal
              </button>
              <button
                type="button"
                onClick={() => window.close()}
                className="px-7 py-4 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all"
              >
                Close Window
              </button>
            </div>
          </motion.div>
        )}

        <footer className="mt-16 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider pb-8">
          Secured · Confidential Employer Feedback · OBE Academic System
        </footer>
      </main>
    </div>
  );
};

export default EmployerSurveyPublicPage;
