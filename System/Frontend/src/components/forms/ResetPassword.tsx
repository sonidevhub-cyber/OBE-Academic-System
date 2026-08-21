import { useNavigate } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

const ResetPassword = () => {
  const navigate = useNavigate();

  return <ForgotPassword onBack={() => navigate('/login')} />;
};

export default ResetPassword;
