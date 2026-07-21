import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Header from './components/Header/Header';
import Formular from './components/Formular/Formular';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import './config/axios';

function AppShell() {
  const [mapFullscreen, setMapFullscreen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('fullscreen-mode', mapFullscreen);
    return () => document.body.classList.remove('fullscreen-mode');
  }, [mapFullscreen]);

  return (
    <div className={`app${mapFullscreen ? ' app--map-fullscreen' : ''}`}>
      {!mapFullscreen && <Header />}
      <main className={mapFullscreen ? 'main--map-fullscreen' : undefined}>
        <Formular onMapFullscreenChange={setMapFullscreen} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/pending" element={<PendingApprovalPage />} />
          <Route element={<ProtectedRoute allowPasswordChange />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<AppShell />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
