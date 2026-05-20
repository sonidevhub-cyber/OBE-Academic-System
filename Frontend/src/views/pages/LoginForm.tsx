import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const LoginForm = () => {
  const { login, error, loading } = useAuth();
  const [credentials, setCredentials] = useState({ identifier: "", password: "" });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(credentials.identifier, credentials.password);
    } catch (err: any) {
      setLocalError(err.message || "Login failed. Please try again.");
      console.error('Login form error:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Employee ID / Registration No / Email"
          value={credentials.identifier}
          onChange={(e) => setCredentials({ ...credentials, identifier: e.target.value })}
          disabled={loading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="Password"
          value={credentials.password}
          onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
          disabled={loading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      {(error || localError) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error || localError}</p>
        </div>
      )}
      
      <button 
        type="submit" 
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
};

export default LoginForm;
