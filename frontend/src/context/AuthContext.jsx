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

import defaultDemoUsers from '../demoUsers.json';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getStoredToken());
  // Pre-seed synchronously so 1-click profiles are instantly visible on standalone Vercel
  const [demoUsers, setDemoUsers] = useState(defaultDemoUsers);
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load initial demo users and verify session
  useEffect(() => {
    async function initAuth() {
      try {
        const demos = await fetchDemoUsers().catch(() => []);
        if (demos && demos.length > 0) {
          setDemoUsers(demos);
        }

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
    try {
      const res = await loginUser(username, password, role);
      setUser(res.user);
      setToken(res.token);
      fetchDatabaseStats().then(setDbStats).catch(() => {});
      return res;
    } catch (err) {
      // Offline fallback: check bundled demo users for match
      const demoMatch = demoUsers.find(
        u => u.username === username && (!role || u.role === role)
      );
      if (demoMatch) {
        const fallbackUser = {
          id: demoMatch.id,
          username: demoMatch.username,
          role: demoMatch.role,
          name: demoMatch.name,
          entity_id: demoMatch.entity_id,
          metadata: demoMatch.metadata
        };
        const fallbackToken = 'resqx_demo_token_' + demoMatch.id;
        setUser(fallbackUser);
        setToken(fallbackToken);
        setStoredUser(fallbackUser);
        setStoredToken(fallbackToken);
        return { user: fallbackUser, token: fallbackToken };
      }
      throw err;
    }
  };

  const register = async (formData) => {
    try {
      const res = await registerCitizen(formData);
      setUser(res.user);
      setToken(res.token);
      fetchDatabaseStats().then(setDbStats).catch(() => {});
      return res;
    } catch (err) {
      // Offline fallback
      const mockUser = {
        id: 'cit-' + Date.now().toString(36),
        username: formData.username,
        role: 'citizen',
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        metadata: {
          blood_group: formData.blood_group,
          allergies: formData.allergies,
          emergency_contact_phone: formData.emergency_contact_phone
        }
      };
      const mockToken = 'resqx_demo_token_' + mockUser.id;
      setUser(mockUser);
      setToken(mockToken);
      setStoredUser(mockUser);
      setStoredToken(mockToken);
      return { user: mockUser, token: mockToken };
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // Ignore
    }
    setUser(null);
    setToken(null);
    setStoredUser(null);
    setStoredToken(null);
    fetchDatabaseStats().then(setDbStats).catch(() => {});
  };

  const quickLogin = async (demoUser) => {
    // Instant client-side login without waiting for remote server roundtrip
    const instantUser = {
      id: demoUser.id,
      username: demoUser.username,
      role: demoUser.role,
      name: demoUser.name,
      entity_id: demoUser.entity_id,
      metadata: demoUser.metadata
    };
    const instantToken = 'resqx_demo_' + demoUser.id;
    setUser(instantUser);
    setToken(instantToken);
    setStoredUser(instantUser);
    setStoredToken(instantToken);
    return { user: instantUser, token: instantToken };
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
