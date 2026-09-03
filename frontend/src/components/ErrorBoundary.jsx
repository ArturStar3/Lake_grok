import { Component } from 'react';
import AuthPage from '../pages/auth/AuthPage';
import logo from '../assets/images/logo.png';
import '../pages/auth/AuthPages.css';

/**
 * Ловит необработанные ошибки рендера React и показывает дружелюбный экран
 * вместо пустой страницы.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Неизвестная ошибка',
    };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <AuthPage>
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div className="auth-card__logo" style={{ justifyContent: 'center' }}>
              <img src={logo} alt="InfoLake" />
              <div>
                <h1 className="auth-card__title">Что-то пошло не так</h1>
                <p className="auth-card__subtitle">Ошибка приложения</p>
              </div>
            </div>
            <p className="auth-card__hint">
              Произошла ошибка при отображении интерфейса. Обновите страницу.
              Если проблема повторяется, обратитесь к администратору.
            </p>
            <button type="button" className="auth-btn auth-btn--primary" onClick={this.handleReload}>
              Обновить страницу
            </button>
          </div>
        </AuthPage>
      );
    }

    return this.props.children;
  }
}
