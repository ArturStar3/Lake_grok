import ThemeToggle from '../../components/common/ThemeToggle/ThemeToggle';

export default function AuthPage({ children }) {
  return (
    <div className="auth-page">
      <ThemeToggle compact className="theme-toggle--auth" />
      {children}
    </div>
  );
}
