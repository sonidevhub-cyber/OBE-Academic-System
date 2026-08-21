// Import and re-export the actual AdminDashboard component
// Use relative import and silence TypeScript module-not-found in some environments
// (some build/dev toolchains here resolve baseUrl differently)
// @ts-ignore
import AdminDashboard from '../../pages/AdminDashboard';

export default AdminDashboard;
