import React, { useState, useEffect, useRef } from 'react';
import { motion, PanInfo } from 'framer-motion';
import './MobileAttendanceMarker.css';

const MobileAttendanceMarker = ({ students, onMarkAttendance, classInfo }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attendance, setAttendance] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardRef = useRef(null);

  const statusColors = {
    Present: '#10B981',
    Absent: '#EF4444',
    Late: '#F59E0B',
    Excused: '#6366F1'
  };

  const handleSwipe = (direction) => {
    const student = students[currentIndex];
    const status = direction === 'right' ? 'Present' : 'Absent';
    
    setAttendance(prev => ({
      ...prev,
      [student.id]: status
    }));

    if (currentIndex < students.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleStatusSelect = (status) => {
    const student = students[currentIndex];
    setAttendance(prev => ({
      ...prev,
      [student.id]: status
    }));
    
    if (currentIndex < students.length - 1) {
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onMarkAttendance(attendance);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentIndex + 1) / students.length) * 100;
  const currentStudent = students[currentIndex];

  if (!currentStudent) {
    return (
      <div className="mobile-attendance-complete">
        <div className="complete-icon">✓</div>
        <h2>Attendance Marked!</h2>
        <p>{Object.keys(attendance).length} students processed</p>
        <button onClick={handleSubmit} disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Submitting...' : 'Submit Attendance'}
        </button>
      </div>
    );
  }

  return (
    <div className="mobile-attendance-container">
      <div className="attendance-header">
        <div className="class-info">
          <h3>{classInfo.course}</h3>
          <p>{classInfo.time} • {classInfo.room}</p>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-text">{currentIndex + 1}/{students.length}</span>
      </div>

      <motion.div
        ref={cardRef}
        className="student-card"
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        onDragEnd={(event, info) => {
          if (info.offset.x > 100) handleSwipe('right');
          else if (info.offset.x < -100) handleSwipe('left');
        }}
        whileDrag={{ scale: 1.05, rotate: info => info.offset.x * 0.1 }}
        animate={{ x: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="student-photo">
          <img src={currentStudent.photo || '/default-avatar.png'} alt={currentStudent.name} />
        </div>
        <div className="student-info">
          <h2>{currentStudent.name}</h2>
          <p className="student-id">{currentStudent.student_id}</p>
          <p className="student-program">{currentStudent.program}</p>
        </div>
        
        <div className="swipe-indicators">
          <div className="swipe-left">
            <span>←</span>
            <p>Absent</p>
          </div>
          <div className="swipe-right">
            <span>→</span>
            <p>Present</p>
          </div>
        </div>
      </motion.div>

      <div className="status-buttons">
        {Object.keys(statusColors).map(status => (
          <motion.button
            key={status}
            className={`status-btn ${attendance[currentStudent.id] === status ? 'active' : ''}`}
            style={{ '--status-color': statusColors[status] }}
            onClick={() => handleStatusSelect(status)}
            whileTap={{ scale: 0.95 }}
          >
            {status}
          </motion.button>
        ))}
      </div>

      <div className="navigation-controls">
        <button 
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="nav-btn"
        >
          ← Previous
        </button>
        <button 
          onClick={() => setCurrentIndex(Math.min(students.length - 1, currentIndex + 1))}
          disabled={currentIndex === students.length - 1}
          className="nav-btn"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default MobileAttendanceMarker;