import React, { useEffect, useState } from 'react';
import obeService, { ExitSurveyQuestion } from '../../../api/obeService';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface StudentExitSurveyProps {
  onSubmitSuccess?: () => void;
}

const StudentExitSurvey: React.FC<StudentExitSurveyProps> = ({ onSubmitSuccess }) => {
  const [questions, setQuestions] = useState<ExitSurveyQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const data = await obeService.getMyExitSurveyQuestions();
      setQuestions(data);
      // Initialize responses with empty values
      const initialResponses: Record<string, number> = {};
      data.forEach(q => {
        initialResponses[q.id] = 0;
      });
      setResponses(initialResponses);
    } catch (error) {
      toast.error('Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRatingChange = (questionId: string, rating: number) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: rating
    }));
  };

  const handleSubmit = async () => {
    // Check if all questions are answered
    const allAnswered = questions.every(q => responses[q.id] > 0);
    if (!allAnswered) {
      toast.error('Please answer all questions');
      return;
    }

    setIsSubmitting(true);
    try {
      const responseData = {
        responses: Object.entries(responses).map(([questionId, ratingValue]) => ({
          question_id: questionId,
          rating_value: ratingValue
        }))
      };
      await obeService.submitExitSurvey(responseData);
      toast.success('Thank you! Your portal is now unlocked.');
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      toast.error('Failed to submit survey');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Exit Survey</h2>
      
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
        <h3 className="text-xl font-bold text-red-800 mb-2">Exit Survey Required</h3>
        <p className="text-red-700">Complete this survey to access your dashboard, marks, and transcript.</p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {questions.map((question, index) => (
          <div key={question.id} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {index + 1}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-800 mb-1">
                  GA-{question.ga.order_number}: {question.ga.title}
                </h4>
                <p className="text-gray-700">{question.question_text}</p>
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => handleRatingChange(question.id, rating)}
                  className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                    responses[question.id] === rating
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-lg'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-3 px-2 text-sm text-gray-500">
              <span>Strongly Disagree</span>
              <span>Strongly Agree</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-4xl">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || questions.some(q => !responses[q.id])}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg transition-all"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Survey'}
        </button>
      </div>
    </motion.div>
  );
};

export default StudentExitSurvey;
