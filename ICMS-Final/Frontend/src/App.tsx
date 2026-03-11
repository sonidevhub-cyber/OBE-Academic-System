import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { DepartmentProvider } from './context/DepartmentContext';
import { AllocationProvider } from './context/AllocationContext';
import AppRoutes from './routes';

// ⭐ Add this
import SmoothScroll from "./components/SmoothScroll";

const App = () => {
  return (
    <>
      {/* ⭐ Smooth scrolling enable hoga */}
      <SmoothScroll />

      <AuthProvider>
        <DepartmentProvider>
          <AllocationProvider>
            <AppRoutes />
          </AllocationProvider>
        </DepartmentProvider>
      </AuthProvider>
    </>
  );
};

export default App;