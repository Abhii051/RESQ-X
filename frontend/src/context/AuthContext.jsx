import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
  loginUser,
  registerCitizen,
  fetchCurrentUser,
  logoutUser,
  fetchDemoUsers,
  fetchDatabaseStats
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getStoredToken());
  const [demoUsers, setDemoUsers] = useState([]);
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load initial demo users and verify session
  useEffect(() => {
    async function initAuth() {
      try {
        const demos = await fetchDemoUsers().catch(() => []);
        setDemoUsers(demos);

        const stats = await fetchDatabaseStats().catch(() => null);
        setDbStats(stats);

        if (getStoredToken()) {
          const verified = await fetchCurrentUser();
          if (verified) {
            setUser(verified);
          } else {
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        console.warn("Auth initialization warning:", err);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (username, password, role = null) => {
    const res = await loginUser(username, password, role);
    setUser(res.user);
    setToken(res.token);
    // Refresh stats
    fetchDatabaseStats().then(setDbStats).catch(() => {});
    return res;
  };

  const register = async (formData) => {
    const res = await registerCitizen(formData);
    setUser(res.user);
    setToken(res.token);
    fetchDatabaseStats().then(setDbStats).catch(() => {});
    return res;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setToken(null);
    fetchDatabaseStats().then(setDbStats).catch(() => {});
  };

  const quickLogin = async (demoUser) => {
    return await login(demoUser.username, demoUser.defaultPass, demoUser.role);
  };

  const switchRole = async (targetRole) => {
    const match = demoUsers.find(u => u.role === targetRole);
    if (match) {
      return await quickLogin(match);
    }
  };

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: Boolean(user && token),
    demoUsers,
    dbStats,
    loading,
    login,
    register,
    logout,
    quickLogin,
    switchRole,
    refreshStats: () => fetchDatabaseStats().then(setDbStats).catch(() => {})
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
