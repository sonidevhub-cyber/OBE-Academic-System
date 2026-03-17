import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface LoginFormProps {
  onLoginSuccess?: (user: any) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isAnimating, setIsAnimating] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(identifier, password);
      console.log('Login successful');
      
      if (onLoginSuccess) {
        // If onLoginSuccess is provided, call it (for custom handling)
        onLoginSuccess({ identifier });
      }
      // Navigation is handled by AuthContext based on user role
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        console.error("Cannot connect to server. Please ensure the backend server is running.");
      } else if (err.response && err.response.data && err.response.data.error) {
        console.error("Server error:", err.response.data.error);
      } else {
        console.error("Login failed:", err.message || 'Unknown error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-blue-400 rounded-bl-full opacity-10"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-indigo-500 rounded-tr-full opacity-10"></div>
        <div className="absolute top-20 left-20 w-40 h-40 border-2 border-blue-300 rounded-full opacity-10"></div>
        <div className="absolute bottom-20 right-20 w-60 h-60 border-2 border-indigo-300 rounded-full opacity-10"></div>
        <div className="absolute top-1/4 right-1/4 w-20 h-1 bg-blue-300 opacity-30 rotate-45"></div>
        <div className="absolute top-1/4 right-1/4 w-1 h-20 bg-blue-300 opacity-30 rotate-45"></div>
        <div className="absolute bottom-1/3 left-1/3 w-16 h-1 bg-indigo-300 opacity-30 -rotate-45"></div>
        <div className="absolute bottom-1/3 left-1/3 w-1 h-16 bg-indigo-300 opacity-30 -rotate-45"></div>
        <div className="absolute top-10 left-10 w-16 h-16 bg-blue-500 rounded-full opacity-10 animate-ping"></div>
        <div className="absolute top-1/2 left-10 w-32 h-8 bg-blue-400 rounded-lg opacity-10 animate-pulse"></div>
        <div className="absolute bottom-20 left-1/3 w-40 h-6 bg-indigo-400 rounded-lg opacity-10 animate-pulse"></div>
      </div>
      
      <div className="w-full flex justify-center items-center">
        <div className={`relative transform ${isAnimating ? 'translate-y-10 opacity-0' : 'translate-y-0 opacity-100'} transition-all duration-1000 ease-out`}>
          <div className="absolute -left-1 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-indigo-500 to-purple-600"></div>
          <div className="absolute -right-1 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-600 via-indigo-500 to-blue-400"></div>
          
          <form onSubmit={handleLogin} className="p-10 bg-white rounded-lg shadow-2xl w-96 backdrop-blur-sm bg-opacity-95 border border-indigo-100">
            <div className="absolute -top-12 left-0 right-0 flex justify-center">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-8 py-4 rounded-t-lg font-bold text-xl shadow-lg">
                <span className="mr-2">✦</span> Educational Portal <span className="ml-2">✦</span>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold mb-8 text-center text-gray-800 mt-4">Welcome Back</h2>
            {authError && <p className="text-red-600 mb-6 text-center bg-red-50 p-3 rounded-lg border border-red-100">{authError}</p>}
            
            <div className="mb-6 relative group">
              <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Employee ID / Registration No / Email</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="e.g., CS001, PGCW001, UG2026-001, or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all group-hover:shadow-md"
                  required
                />
              </div>
            </div>
            
            <div className="mb-8 relative group">
              <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Password</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all group-hover:shadow-md"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-lg font-medium shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <div className="mt-6 text-center">
              <button type="button" className="text-blue-600 hover:text-blue-800 text-sm font-medium">Forgot Password?</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
