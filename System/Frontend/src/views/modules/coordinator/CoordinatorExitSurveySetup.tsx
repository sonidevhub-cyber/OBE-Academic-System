import React, { useEffect, useState } from 'react';
import obeService, { ExitSurveyQuestion } from '../../../api/obeService';
import { toast } from 'react-hot-toast';

const CoordinatorExitSurveySetup: React.FC = () => {
  const [questions, setQuestions] = useState<ExitSurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const data = await obeService.getExitSurveyQuestions();
      setQuestions(data);
    } catch (error) {
      toast.error('Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    try {
      await obeService.generateExitSurveyQuestions();
      toast.success('Questions generated successfully');
      loadQuestions();
    } catch (error) {
      toast.error('Failed to generate questions');
    }
  };

  const handleQuestionChange = (id: string, field: 'question_text' | 'is_active', value: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Exit Survey Setup</h1>

      <div className="flex gap-4 mb-6">
        <button
          onClick={handleGenerateQuestions}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Generate Questions
        </button>
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No questions yet. Click "Generate Questions" to get started.</p>
          </div>
        ) : (
          questions.map(question => (
            <div key={question.id} className="p-4 border rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-semibold">
                    {question.ga_code || (question.ga_order_number ? `GA-${question.ga_order_number}` : 'GA')}: {question.ga_title}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">{question.ga_description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${question.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {question.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <textarea
                value={question.question_text}
                onChange={(e) => handleQuestionChange(question.id, 'question_text', e.target.value)}
                className="w-full p-2 border rounded mt-2 disabled:bg-gray-100"
                rows={2}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CoordinatorExitSurveySetup;
