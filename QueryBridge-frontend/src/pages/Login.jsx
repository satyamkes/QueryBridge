import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiLoginCircleLine, RiUserAddLine, RiLockLine, RiUserLine, RiShieldLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { loginUser, registerUser } from '../services/api';
import FloatingBackground from '../components/FloatingBackground';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      let data;
      if (isRegister) {
        data = await registerUser(username, password, 'user');
        setSuccess('Account created successfully!');
      } else {
        data = await loginUser(username, password);
      }
      
      if (data.status === 'ok') {
        login(data.user, data.access_token, data.refresh_token);
      } else {
        setError(data.message || 'Authentication failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Something went wrong.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen grid-overlay flex items-center justify-center px-4">
      <FloatingBackground theme="dark" />
      
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-neon-cyan/20 via-neon-purple/10 to-neon-cyan/20 rounded-3xl blur-xl opacity-50" />
        
        <div className="relative glass-panel rounded-2xl p-8 border border-neon-cyan/15 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="font-display font-extrabold text-4xl tracking-tight brand-title-main mb-2"
            >
              QueryBridge
            </motion.h1>
            <p className="font-mono text-[10px] text-theme-muted tracking-widest uppercase">
              {isRegister ? 'Create New Account' : 'Authenticate to Continue'}
            </p>
          </div>

          {/* Error / Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono"
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 p-3 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs font-mono"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block font-mono text-[10px] text-theme-muted tracking-wider uppercase mb-2">
                Username
              </label>
              <div className="relative">
                <RiUserLine className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-dim text-lg" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-theme-input border border-theme-input-border rounded-lg pl-10 pr-4 py-3 text-sm font-mono text-theme-text placeholder:text-theme-dim/50 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/30 transition-all duration-300"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block font-mono text-[10px] text-theme-muted tracking-wider uppercase mb-2">
                Password
              </label>
              <div className="relative">
                <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-dim text-lg" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-theme-input border border-theme-input-border rounded-lg pl-10 pr-4 py-3 text-sm font-mono text-theme-text placeholder:text-theme-dim/50 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/30 transition-all duration-300"
                  required
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
              </div>
            </div>

            {/* Role Info (Register only) */}
            <AnimatePresence>
              {isRegister && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/15"
                >
                  <RiShieldLine className="text-neon-cyan text-lg" />
                  <span className="font-mono text-[10px] text-theme-muted tracking-wide">
                    You will be registered as a <span className="text-neon-cyan font-bold">User (Read-Only)</span>. Admin accounts can only be created by an existing admin.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-neon-cyan to-neon-blue text-black font-display font-bold text-sm py-3.5 rounded-lg hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? <RiUserAddLine className="text-lg" /> : <RiLoginCircleLine className="text-lg" />}
                  {isRegister ? 'CREATE ACCOUNT' : 'AUTHENTICATE'}
                </>
              )}
            </motion.button>
          </form>

          {/* Toggle Login / Register */}
          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
              className="font-mono text-xs text-theme-muted hover:text-neon-cyan transition-colors duration-300 cursor-pointer"
            >
              {isRegister
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
            </button>
          </div>

          {/* Footer accent */}
          <div className="mt-6 pt-4 border-t border-theme-text/5 text-center">
            <span className="font-mono text-[9px] text-theme-dim tracking-widest">
              QUERYBRIDGE SECURE AUTH v1.0
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
