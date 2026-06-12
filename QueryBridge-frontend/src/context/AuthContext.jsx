import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore from localStorage on mount
    const storedUser = localStorage.getItem('QB_USER');
    const storedAccess = localStorage.getItem('QB_ACCESS_TOKEN');
    const storedRefresh = localStorage.getItem('QB_REFRESH_TOKEN');
    if (storedUser && storedAccess) {
      setUser(JSON.parse(storedUser));
      setAccessToken(storedAccess);
      setRefreshToken(storedRefresh);
    }
    setLoading(false);
  }, []);

  const login = (userData, access, refresh) => {
    setUser(userData);
    setAccessToken(access);
    setRefreshToken(refresh);
    localStorage.setItem('QB_USER', JSON.stringify(userData));
    localStorage.setItem('QB_ACCESS_TOKEN', access);
    localStorage.setItem('QB_REFRESH_TOKEN', refresh);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('QB_USER');
    localStorage.removeItem('QB_ACCESS_TOKEN');
    localStorage.removeItem('QB_REFRESH_TOKEN');
  };

  const updateTokens = (access, refresh) => {
    setAccessToken(access);
    setRefreshToken(refresh);
    localStorage.setItem('QB_ACCESS_TOKEN', access);
    localStorage.setItem('QB_REFRESH_TOKEN', refresh);
  };

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      refreshToken,
      loading,
      login,
      logout,
      updateTokens,
      isAdmin: user?.role === 'admin',
      isAuthenticated: !!user && !!accessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};
