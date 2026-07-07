import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiClient,
  clearAuth,
  getAccessToken,
  getStoredUser,
  initAxiosAuth,
  storeAuth,
} from '../config/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      const refresh = sessionStorage.getItem('infolake_refresh_token');
      if (refresh) {
        await apiClient.post('/auth/logout/', { refresh });
      }
    } catch {
      // ignore offline/logout errors
    } finally {
      clearAuth();
      setUser(null);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await apiClient.get('/auth/me/');
      storeAuth({ user: data });
      setUser(data);
      return data;
    } catch {
      clearAuth();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAxiosAuth(() => {
      clearAuth();
      setUser(null);
      setLoading(false);
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    });
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (username, password) => {
    const { data } = await apiClient.post('/auth/login/', { username, password });
    storeAuth({ access: data.access, refresh: data.refresh, user: data.user });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await apiClient.post('/auth/register/', payload);
    return data;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await apiClient.post('/auth/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    const nextUser = { ...user, must_change_password: false };
    storeAuth({ user: nextUser });
    setUser(nextUser);
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user && getAccessToken()),
    login,
    logout,
    register,
    changePassword,
    refreshMe,
    setUser,
  }), [user, loading, login, logout, register, changePassword, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
