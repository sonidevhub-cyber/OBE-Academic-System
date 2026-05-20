import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  User,
  Clock,
  MessageSquare,
} from "lucide-react";

interface Props {
  f: any;
  compact?: boolean;
  onMarkReviewed: (id: number) => void;
}

const FeedbackCard: React.FC<Props> = ({ f, compact, onMarkReviewed }) => {
  const [open, setOpen] = useState(false);

  const typeColors: any = {
    teaching: "bg-blue-100 text-blue-700",
    communication: "bg-purple-100 text-purple-700",
    support: "bg-green-100 text-green-700",
    management: "bg-orange-100 text-orange-700",
    general: "bg-gray-100 text-gray-700",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow hover:shadow-lg transition-all"
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div>
          <h4 className="font-semibold text-lg flex items-center gap-2">
            <User size={18} />
            {f.student_name || "Anonymous Student"}
          </h4>

          {!compact && (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Clock size={14} />
              {new Date(f.created_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              typeColors[f.feedback_type] || typeColors["general"]
            }`}
          >
            {f.feedback_type.toUpperCase()}
          </span>

          <button className="p-2">
            {open ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4"
          >
            <div className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-700 p-3 rounded-lg shadow-inner">
              <p className="flex items-start gap-2">
                <MessageSquare className="mt-1" size={16} />
                {f.message}
              </p>
            </div>

            {/* Mark Reviewed Button */}
            {!f.is_reviewed && (
              <button
                onClick={() => onMarkReviewed(f.id)}
                className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow flex items-center gap-2 text-sm"
              >
                <CheckCircle size={16} /> Mark Reviewed
              </button>
            )}

            {f.is_reviewed && (
              <p className="mt-3 text-green-500 text-sm flex items-center gap-2">
                <CheckCircle size={16} /> Reviewed
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FeedbackCard;