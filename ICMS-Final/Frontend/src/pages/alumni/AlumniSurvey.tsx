import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Star, 
  Send, 
  CheckCircle,
  ClipboardList,
  Info
} from 'lucide-react';

// --- Dummy Data ---
const dummySurvey = { 
  round: "2025", 
  closeDate: "December 31, 2025", 
  questions: [ 
    { 
      id: "q1", 
      peo: "PEO 1", 
      peoTitle: "Industry Practice", 
      questionText: "How well did the program prepare you to apply CS fundamentals in industry?", 
      type: "rating", 
    }, 
    { 
      id: "q2", 
      peo: "PEO 2", 
      peoTitle: "Higher Education", 
      questionText: "How well did the program prepare you to pursue higher education or research?", 
      type: "rating", 
    }, 
    { 
      id: "q3", 
      peo: "PEO 3", 
      peoTitle: "Leadership & Ethics", 
      questionText: "How well did the program prepare you to demonstrate professional ethics?", 
      type: "rating", 
    }, 
    { 
      id: "q4", 
      peo: "PEO 4", 
      peoTitle: "Lifelong Learning", 
      questionText: "How well did the program prepare you for lifelong learning?", 
      type: "rating", 
    }, 
    { 
      id: "q5", 
      peo: null, 
      peoTitle: null, 
      questionText: "Any suggestions to improve the program?", 
      type: "open_ended", 
    }, 
  ], 
};

const AlumniSurvey: React.FC = () => {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // --- Helpers ---
  const handleRating = (id: string, rating: number) => {
    setAnswers(prev => ({ ...prev, [id]: rating }));
  };

  const handleOpenEnded = (id: string, text: string) => {
    setAnswers(prev => ({ ...prev, [id]: text }));
  };

  const ratingQuestions = dummySurvey.questions.filter(q => q.type === 'rating');
  const answeredCount = ratingQuestions.filter(q => answers[q.id]).length;
  const progressPercent = (answeredCount / ratingQuestions.length) * 100;
  const isComplete = answeredCount === ratingQuestions.length;

  const handleSubmit = () => {
    if (isComplete) {
      setIsSubmitted(true);
      // In a real app, API call would go here
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#112240] rounded-[40px] p-12 text-center max-w-xl border border-[#233554] shadow-2xl"
        >
          <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4">Jazakallah!</h2>
          <p className="text-[#8892B0] text-lg leading-relaxed mb-10 font-medium">
            Your feedback has been recorded. It will be used to improve the <span className="text-[#F7C948]">BS CS program</span> for future generations.
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

  return (
    <div className="min-h-screen bg-[#0A192F] text-[#E6F1FF] font-sans pb-20">
      {/* --- Header --- */}
      <header className="bg-[#112240] border-b border-[#233554] sticky top-0 z-50 px-6 py-6 shadow-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate('/alumni')}
              className="flex items-center gap-2 text-[#8892B0] hover:text-[#F7C948] transition-colors font-bold group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </button>
            <div className="bg-[#F7C948]/10 px-4 py-1.5 rounded-full border border-[#F7C948]/20">
              <span className="text-[#F7C948] text-xs font-black uppercase tracking-widest">Alumni Relations</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
              <h1 className="text-3xl font-black text-white">PEO Survey {dummySurvey.round}</h1>
              <p className="text-[#8892B0] font-medium mt-1 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" /> Closes: {dummySurvey.closeDate}
              </p>
            </div>
            
            <div className="w-full md:w-64 space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-tighter">
                <span className="text-[#8892B0]">Completion Progress</span>
                <span className="text-[#F7C948]">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 w-full bg-[#0A192F] rounded-full overflow-hidden border border-[#233554]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-[#F7C948] rounded-full shadow-[0_0_15px_rgba(247,201,72,0.3)]"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- Survey Questions --- */}
      <main className="max-w-4xl mx-auto p-6 mt-8 space-y-8">
        <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl flex gap-4 items-start">
          <div className="p-2 bg-blue-500/20 rounded-xl">
            <Info className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-sm text-blue-100/80 font-medium leading-relaxed">
            Program Educational Objectives (PEOs) describe the career and professional accomplishments that the program is preparing graduates to achieve. Your honest feedback is crucial for our continuous quality improvement process.
          </p>
        </div>

        {dummySurvey.questions.map((q, idx) => (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={q.id}
            className="bg-[#112240] rounded-[32px] p-8 border border-[#233554] shadow-xl relative overflow-hidden group hover:border-[#F7C948]/30 transition-all"
          >
            {q.peo && (
              <div className="mb-6 flex">
                <span className="bg-[#F7C948]/10 text-[#F7C948] px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-[#F7C948]/20 flex items-center gap-2">
                  <AwardIcon className="w-3 h-3" /> {q.peo} — {q.peoTitle}
                </span>
              </div>
            )}

            <h3 className="text-xl font-bold text-white mb-8 leading-tight">
              {q.questionText}
            </h3>

            {q.type === 'rating' ? (
              <div className="flex flex-wrap items-center gap-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(q.id, star)}
                    className="flex flex-col items-center gap-2 group/star"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      answers[q.id] >= star 
                        ? 'bg-[#F7C948] shadow-[0_0_20px_rgba(247,201,72,0.2)]' 
                        : 'bg-[#0A192F] border border-[#233554] hover:border-[#F7C948]/50'
                    }`}>
                      <Star 
                        className={`w-6 h-6 transition-colors ${
                          answers[q.id] >= star ? 'text-[#0A192F] fill-[#0A192F]' : 'text-[#8892B0] group-hover/star:text-[#F7C948]'
                        }`} 
                      />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${
                      answers[q.id] === star ? 'text-[#F7C948]' : 'text-[#8892B0]'
                    }`}>
                      {star === 1 ? 'Poor' : star === 5 ? 'Excellent' : star}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => handleOpenEnded(q.id, e.target.value)}
                placeholder="Type your suggestions here..."
                className="w-full bg-[#0A192F] border border-[#233554] rounded-2xl p-6 text-[#E6F1FF] placeholder:text-[#3B4C66] focus:outline-none focus:ring-2 focus:ring-[#F7C948]/50 focus:border-[#F7C948] transition-all min-h-[150px] font-medium"
              />
            )}
          </motion.section>
        ))}

        {/* --- Footer / Submit --- */}
        <div className="pt-8 flex flex-col items-center gap-6">
          {!isComplete && (
            <div className="flex items-center gap-2 text-amber-500/80 bg-amber-500/5 px-6 py-3 rounded-full border border-amber-500/10">
              <Info className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Please answer all rating questions to submit</span>
            </div>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={!isComplete}
            className={`w-full max-w-md py-5 rounded-[24px] font-black text-xl transition-all flex items-center justify-center gap-3 shadow-2xl ${
              isComplete 
                ? 'bg-[#F7C948] text-[#0A192F] hover:bg-[#F7C948]/90 active:scale-95 shadow-yellow-500/20' 
                : 'bg-[#112240] text-[#3B4C66] cursor-not-allowed border border-[#233554]'
            }`}
          >
            <Send className="w-6 h-6" />
            Submit Survey
          </button>
          
          <p className="text-[#3B4C66] text-xs font-bold uppercase tracking-widest">
            Confidentiality Guaranteed • Educational Excellence
          </p>
        </div>
      </main>
    </div>
  );
};

// --- Icons ---
const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const AwardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default AlumniSurvey;
