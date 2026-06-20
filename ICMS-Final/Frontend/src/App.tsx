import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { AllocationProvider } from './context/AllocationContext';
import AppRoutes from './routes';

import SmoothScroll from "./components/SmoothScroll";

// ✅ ADD THIS
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  return (
    <>
      {/* Smooth scrolling */}
      <SmoothScroll />

      <AuthProvider>
        <AllocationProvider>
          <AppRoutes />
        </AllocationProvider>
      </AuthProvider>

      {/* ✅ Toast globally enable */}
      <ToastContainer position="top-right" autoClose={2000} />
    </>
  );
};

export default App;