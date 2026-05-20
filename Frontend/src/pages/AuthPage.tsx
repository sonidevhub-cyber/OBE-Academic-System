import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Login from './Login';
import { useAuth } from '../context/AuthContext';

const AuthPage: React.FC = () => {
  const { currentUser, forceLogout } = useAuth();
  return (
    <motion.div
      className="flex items-center justify-center min-h-screen relative"
      style={{
        backgroundImage: `url('https://zsportal.com/images/usersites/fullsize/17534452094220525096883735928898.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 bg-white/50" />
      <div className="absolute inset-0 shimmer" />
      <div className="relative z-10 w-full flex items-center justify-center px-4">
        <motion.div
          className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-2xl"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <motion.div
              className="bg-white w-16 h-16 rounded-full shadow-md flex items-center justify-center overflow-hidden shrink-0"
              animate={{
                rotateY: [0, 180, 180, 360],
                scale: [1, 1.15, 1.15, 1],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                repeatDelay: 0,
              }}
              style={{
                transformStyle: 'preserve-3d',
              }}
            >
              <img
                src="https://www.result.pk/_images/institute/logo/2020-11/_2_32326.jpg"
                alt="Logo"
                className="h-16 w-16 object-contain"
              />
            </motion.div>

            <div className="text-left pt-1.5">
              <h2 className="text-lg font-semibold text-gray-800 leading-tight">
                Post Graduate Collage
              </h2>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">
                For Women (Wah Cantt)
              </p>
            </div>
          </div>

          <motion.div
            className="relative overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <motion.div
              className="w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Login />
            </motion.div>
          </motion.div>

          {currentUser && (
            <motion.div
              className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-xs text-yellow-800 mb-2">
                Debug: You're currently logged in as <strong>{currentUser.username}</strong> ({currentUser.role})
              </p>
              <motion.button
                onClick={forceLogout}
                className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Force Logout & Clear Session
              </motion.button>
            </motion.div>
          )}

          <motion.div
            className="border-t border-gray-200 pt-4 mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <p className="text-xs text-center text-gray-500">
              (c) {new Date().getFullYear()} Collage Management System. All rights reserved.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AuthPage;
