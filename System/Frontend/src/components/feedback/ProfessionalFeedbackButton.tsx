import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Star, Send, X } from 'lucide-react';
import axios from 'axios';

const AnimatedCheck = () => (
  <motion.svg
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 12 }}
    className="w-20 h-20 text-green-600 mx-auto mb-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <motion.circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.6 }}
    />
    <motion.path
      d="M8 12l3 3 5-6"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    />
  </motion.svg>
);

const FeedbackButton = ({ darkMode = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    feedback_type: "general",
    title: "",
    message: "",
    rating: 3,
    semester: "",
    subject_area: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle");

  const feedbackTypes = [
    { value: "teaching", label: "Teaching Quality" },
    { value: "communication", label: "Communication" },
    { value: "support", label: "Student Support" },
    { value: "management", label: "Department Management" },
    { value: "general", label: "General" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;

      await axios.post(
        "http://127.0.0.1:8000/api/feedback/submit/",
        formData,
        { headers: { Authorization: `Token ${token}` } }
      );

      setSubmitStatus("success");

      setTimeout(() => {
        setShowModal(false);
        setSubmitStatus("idle");
      }, 1800);

    } catch (err) {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <motion.button
        onClick={() => setShowModal(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full 
        bg-blue-600 text-white shadow-xl hover:shadow-2xl transition-all"
      >
        <MessageSquare size={18} />
        Feedback
      </motion.button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm 
            flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 40 }}
              className={`w-full max-w-md rounded-2xl shadow-2xl p-6
                ${darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"} 
                bg-opacity-80 backdrop-blur-lg`}
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-blue-600">Submit Feedback</h2>
                <button onClick={() => setShowModal(false)}>
                  <X className="text-gray-500 hover:text-gray-700" size={20} />
                </button>
              </div>

              {/* SUCCESS SCREEN */}
              {submitStatus === "success" ? (
                <div className="text-center py-5">
                  <AnimatedCheck />
                  <h3 className="text-lg font-semibold text-green-600">Submitted!</h3>
                  <p className="text-gray-500 text-sm">
                    Thank you for your valuable feedback.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Feedback Type */}
                  <select
                    value={formData.feedback_type}
                    onChange={(e) =>
                      setFormData({ ...formData, feedback_type: e.target.value })
                    }
                    className="w-full p-3 rounded-lg border bg-white"
                  >
                    {feedbackTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  {/* Title */}
                  <input
                    type="text"
                    placeholder="Title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full p-3 rounded-lg border"
                    required
                  />

                 

                  {/* Message */}
                  <textarea
                    className="w-full border p-3 rounded-lg h-24"
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    placeholder="Write feedback..."
                    required
                  />

                  {/* Semester + Subject Row */}
                  <div className="grid grid-cols-2 gap-3">
                   
                    <input
                      type="text"
                      placeholder="Semester (optional)"
                      value={formData.semester}
                      onChange={(e) =>
                        setFormData({ ...formData, semester: e.target.value })
                      }
                      className="w-full p-3 rounded-lg border"
                    />

                    <input
                      type="text"
                      placeholder="Teacher(optional)"
                      value={formData.subject_area}
                      onChange={(e) =>
                        setFormData({ ...formData, subject_area: e.target.value })
                      }
                      className="w-full p-3 rounded-lg border"
                    />
                  </div>
                  {/* Rating (Centered Glowing Stars) */}
<div className="flex justify-center mt-2 mb-2">
  <div className="flex gap-3">
    {[1, 2, 3, 4, 5].map((star) => (
      <motion.button
        key={star}
        type="button"
        whileHover={{ scale: 1.2 }}
        onClick={() =>
          setFormData({ ...formData, rating: star })
        }
        className="relative"
      >
        <Star
          size={32}
          className={
            star <= formData.rating
              ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(255,215,0,0.7)]"
              : "text-gray-300"
          }
        />

        {/* Glow Pulse Effect */}
        {star <= formData.rating && (
          <span className="absolute inset-0 animate-ping bg-yellow-400 rounded-full opacity-30 scale-75"></span>
        )}
      </motion.button>
    ))}
  </div>
</div>


                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.05 }}
                    className="w-full bg-blue-600 hover:bg-blue-700 
                      text-white py-3 rounded-lg font-medium shadow-lg"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Send size={18} /> Submit
                      </div>
                    )}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FeedbackButton;
