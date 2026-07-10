import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {

  apiClient,

  clearAuth,

  getAccessToken,

  getRefreshToken,

  getStoredUser,

  initAxiosAuth,

  refreshAccessToken,

  storeAuth,

} from '../config/axios';



const AuthContext = createContext(null);



export function AuthProvider({ children }) {

  const [user, setUser] = useState(getStoredUser);

  // Блокируем UI только если есть токен — его нужно проверить через /me.

  const [loading, setLoading] = useState(() => Boolean(getAccessToken()));

  const refreshSeqRef = useRef(0);



  const logout = useCallback(async () => {

    refreshSeqRef.current += 1;

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

      setLoading(false);

    }

  }, []);



  const refreshMe = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    const seq = refreshSeqRef.current + 1;
    refreshSeqRef.current = seq;

    const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { data } = await apiClient.get('/auth/me/');
        if (seq !== refreshSeqRef.current) return null;
        storeAuth({ user: data });
        setUser(data);
        if (seq === refreshSeqRef.current) setLoading(false);
        return data;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 && attempt < 2) {
          const newToken = await refreshAccessToken();
          if (newToken) continue;
        }

        const isNetworkError = !err?.response;
        if (isNetworkError && attempt < 2) {
          await sleep(1000);
          continue;
        }
        if (seq !== refreshSeqRef.current) return null;
        // Если это сетевой сбой (например, ERR_EMPTY_RESPONSE), не очищаем auth,
        // чтобы не устроить каскад 401 после временной проблемы на сервере.
        if (isNetworkError) {
          if (seq === refreshSeqRef.current) setLoading(false);
          return null;
        }

        clearAuth();
        setUser(null);
        if (seq === refreshSeqRef.current) setLoading(false);
        return null;
      }
    }

    return null;
  }, []);



  useEffect(() => {

    initAxiosAuth(() => {

      refreshSeqRef.current += 1;

      clearAuth();

      setUser(null);

      setLoading(false);

      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.replace('/login');
      }

    });

    refreshMe();

  }, [refreshMe]);

  // Проактивное обновление access-токена (срок жизни 30 мин), если долго нет API-запросов.
  useEffect(() => {
    if (!getAccessToken() || !getRefreshToken()) return undefined;

    const REFRESH_INTERVAL_MS = 25 * 60 * 1000;
    const timer = setInterval(() => {
      if (!getRefreshToken()) return;
      refreshAccessToken().catch(() => {});
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [user]);

  const login = useCallback(async (username, password) => {

    // Отменяем зависший refreshMe (просроченный токен), чтобы не блокировать ProtectedRoute.

    refreshSeqRef.current += 1;

    const { data } = await apiClient.post('/auth/login/', { username, password });

    storeAuth({ access: data.access, refresh: data.refresh, user: data.user });

    setUser(data.user);

    setLoading(true);
    const me = await refreshMe();
    // Если /auth/me не ответил из-за сетевого сбоя — считаем логин успешным,
    // потому что пользователь уже получен из /auth/login/.
    if (!me) {
      setLoading(false);
      return data.user;
    }

    return data.user;

  }, [refreshMe]);



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



// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider

export function useAuth() {

  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error('useAuth must be used within AuthProvider');

  return ctx;

}


