import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { coordinatorService, CourseAllocation } from '../api/coordinatorService';
import { instructorCourseService } from '../api/instructorCourseService'; // ✅ NEW
import { useAuth } from './AuthContext';

interface AllocationContextType {
  allocations: CourseAllocation[];
  loading: boolean;
  fetchAllocations: () => Promise<void>;
  addAllocation: (allocation: CourseAllocation) => void;
  updateAllocation: (id: number, updates: Partial<CourseAllocation>) => void;
  getProposedAllocations: () => CourseAllocation[];
  getApprovedAllocations: () => CourseAllocation[];
  getInstructorAllocations: (instructorId: number) => CourseAllocation[];
  getAllocationsByBatch: (batchId: string) => CourseAllocation[];
}

const AllocationContext = createContext<AllocationContextType | undefined>(undefined);

export const AllocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllocations = async () => {
    try {
      setLoading(true);

      let data: any[] = [];

      // ✅ ROLE BASED API CALL
      if (currentUser?.role === 'coordinator' || currentUser?.role === 'hod') {
        // 👉 Coordinator / HOD
        const response = await coordinatorService.getCourseAllocations();
        data = response.data.data || [];
      } 
      else if (currentUser?.role === 'instructor') {
        // 👉 Instructor (IMPORTANT FIX)
        const response = await instructorCourseService.getMyCourses();
        data = response.data.data || [];
      }

      if (Array.isArray(data)) {
        setAllocations(data);
      } else {
        setAllocations([]);
      }

    } catch (error) {
      console.error('Error fetching allocations:', error);
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && !authLoading) {
      fetchAllocations(); // ✅ now safe for all roles
    }
  }, [currentUser, authLoading]);

  const addAllocation = (allocation: CourseAllocation) => {
    setAllocations(prev => [...prev, allocation]);
    fetchAllocations();
  };

  const updateAllocation = (id: number, updates: Partial<CourseAllocation>) => {
    setAllocations(prev =>
      prev.map(allocation => {
        if (allocation.allocation_id === id) {
          const updated = { ...allocation, ...updates };

          if (updated.status === 'approved') {
            updated.status = 'active';
          }

          return updated;
        }
        return allocation;
      })
    );

    setTimeout(() => fetchAllocations(), 500);
  };

  const getProposedAllocations = () =>
    allocations.filter(a => a.status === 'proposed');

  const getApprovedAllocations = () =>
    allocations.filter(a => a.status === 'approved' || a.status === 'active');

  // ✅ IMPORTANT FIX: instructor filter properly
  const getInstructorAllocations = (instructorId: number) =>
    allocations.filter(
      a =>
        (a.teacher === instructorId || a.instructor === instructorId) &&
        (a.status === 'active' || a.status === 'approved')
    );

  const getAllocationsByBatch = (batchId: string) =>
    allocations.filter(
      a =>
        a.batch === batchId &&
        (a.status === 'approved' || a.status === 'active')
    );

  return (
    <AllocationContext.Provider
      value={{
        allocations,
        loading,
        fetchAllocations,
        addAllocation,
        updateAllocation,
        getProposedAllocations,
        getApprovedAllocations,
        getInstructorAllocations,
        getAllocationsByBatch
      }}
    >
      {children}
    </AllocationContext.Provider>
  );
};

export const useAllocations = () => {
  const context = useContext(AllocationContext);
  if (!context) {
    throw new Error('useAllocations must be used within AllocationProvider');
  }
  return context;
};