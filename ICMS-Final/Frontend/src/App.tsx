import React from 'react';
import { AuthProvider } from './context/AuthContext';
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
        <AllocationProvider>
          <AppRoutes />
        </AllocationProvider>
      </AuthProvider>
    </>
  );
};

export default App;
