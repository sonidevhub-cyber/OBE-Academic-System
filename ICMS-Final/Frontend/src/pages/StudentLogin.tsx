import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const StudentLogin = () => {
  const { login, error: authError, loading } = useAuth();
  const navigate = useNavigate();
  
  // ✅ use registration_number instead of username
  const [form, setForm] = useState({ registration_number: "", password: "" });
  const [isAnimating, setIsAnimating] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ✅ login using registration_number
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(form.registration_number, form.password, "student");
      navigate("/student/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-600 to-emerald-900 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-green-400 rounded-bl-full opacity-10"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-emerald-500 rounded-tr-full opacity-10"></div>
      </div>

      <div className="w-full flex justify-center items-center">
        <div
          className={`relative transform ${
            isAnimating ? "translate-y-10 opacity-0" : "translate-y-0 opacity-100"
          } transition-all duration-700 ease-out`}
        >
          <form
            onSubmit={handleSubmit}
            className="p-10 bg-white rounded-lg shadow-2xl w-96 backdrop-blur-sm bg-opacity-95 border border-green-100"
          >
            <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">
              Student Login
            </h2>

            {authError && (
              <p className="text-red-600 mb-6 text-center bg-red-50 p-3 rounded-lg border border-red-100">
                {authError}
              </p>
            )}

            {/* Registration Number */}
            <div className="mb-6 relative group">
              <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                Registration Number
              </label>
              <input
                type="text"
                name="registration_number"
                placeholder="Enter your registration number"
                value={form.registration_number}
                onChange={handleChange}
                className="w-full p-3 pl-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                required
              />
            </div>

            {/* Password */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                className="w-full p-3 pl-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white py-3 rounded-lg font-medium shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300"
            >
              {loading ? "Logging in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;