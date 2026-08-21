import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';

interface NotificationToastProps {
  notification: {
    id: number;
    message: string;
    feedback_title: string;
  } | null;
  onClose: () => void;
  onFeedbackClick: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ 
  notification, 
  onClose, 
  onFeedbackClick 
}) => {
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-close after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.8 }}
          className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm cursor-pointer"
          onClick={() => {
            onFeedbackClick();
            onClose();
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bell size={16} className="text-blue-600" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    New Feedback Received
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {notification.message}
                  </p>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
              
              <p className="text-xs text-blue-600 mt-2">
                Click to view feedback
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast;