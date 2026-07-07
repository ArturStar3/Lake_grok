import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ allowPasswordChange = false }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--loading">Загрузка…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (user?.status === 'blocked') {
    return <Navigate to="/login" replace state={{ blocked: true }} />;
  }

  if (user?.must_change_password && !allowPasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
