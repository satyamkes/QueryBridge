import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiHome5Line, RiHistoryLine, RiInformationLine, RiSettings4Line, RiCpuLine } from 'react-icons/ri';
import logo from '../assets/logo.svg';
import { getApiUrl, setApiUrl } from '../services/api';

const Navbar = ({ currentPage, setCurrentPage }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiUrl, setApiUrlState] = useState(getApiUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Home', icon: RiHome5Line },
    { id: 'history', label: 'History', icon: RiHistoryLine },
    { id: 'about', label: 'About', icon: RiInformationLine },
  ];

  const handleSaveConfig = (e) => {
    e.preventDefault();
    setApiUrl(apiUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <>
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="sticky top-0 left-0 w-full z-40 px-4 md:px-8 py-4 backdrop-blur-md border-b border-white/5 bg-space-dark/65"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setCurrentPage('home')}
          >
            <div className="relative w-10 h-10 flex items-center justify-center">
              <motion.img 
                src={logo} 
                alt="QueryBridge Logo" 
                className="w-8 h-8"
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 bg-neon-cyan/20 blur-md rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-[#00ffcc] to-[#00ffa2] filter drop-shadow-[0_0_8px_rgba(0,255,200,0.4)]">
                QueryBridge
              </span>
              <span className="text-[9px] text-white/50 font-mono tracking-widest -mt-1 uppercase">
                AI Trans-SQL Engine
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white/5 border border-white/5 rounded-full p-1.5 backdrop-blur-lg">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`relative flex items-center gap-2 px-5 py-2 rounded-full font-display text-xs font-semibold tracking-wide transition-all duration-300 ${
                    isActive 
                      ? 'text-white' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="text-base" />
                  <span>{item.label}</span>
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute inset-0 rounded-full border border-neon-cyan/50 bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,240,255,0.15)] -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-4">
            {/* System Status - Hidden on extra small screens */}
            <div className="hidden sm:flex items-center gap-2 bg-space-deep border border-neon-cyan/20 rounded-lg px-3 py-1.5 font-mono text-[10px] tracking-wide text-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.05)] animate-pulse-slow">
              <RiCpuLine className="text-xs" />
              <span>CORE: ONLINE</span>
            </div>

            {/* Config Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsConfigOpen(true)}
              className="p-2.5 rounded-lg bg-white/5 hover:bg-neon-purple/10 border border-white/10 hover:border-neon-purple/40 text-white/80 hover:text-neon-purple transition-all duration-300 shadow-[0_0_10px_rgba(171,0,255,0.05)] cursor-pointer"
              title="API Configuration"
            >
              <RiSettings4Line className="text-lg" />
            </motion.button>
          </div>
        </div>

        {/* Small screen mobile navigation overlay */}
        <div className="flex md:hidden justify-center items-center gap-6 mt-4 pt-3 border-t border-white/5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex flex-col items-center gap-1 text-[11px] font-semibold tracking-wider font-display transition-all duration-300 ${
                  isActive ? 'text-neon-cyan' : 'text-white/50'
                }`}
              >
                <Icon className="text-lg" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </motion.header>

      {/* Slide-out Settings Drawer */}
      <AnimatePresence>
        {isConfigOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigOpen(false)}
              className="fixed inset-0 bg-black z-50 pointer-events-auto"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-space-deep border-l border-neon-cyan/20 p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 overflow-y-auto flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <h3 className="font-display font-bold text-lg text-white tracking-wide">
                    SYSTEM SETTINGS
                  </h3>
                  <button 
                    onClick={() => setIsConfigOpen(false)}
                    className="text-white/40 hover:text-white text-sm"
                  >
                    CLOSE [ESC]
                  </button>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-6">
                  <div>
                    <label className="block font-mono text-[11px] text-white/50 tracking-wider mb-2 uppercase">
                      AI Bridge Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={(e) => setApiUrlState(e.target.value)}
                      placeholder="e.g. http://localhost:5000/api"
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm font-mono text-white focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/30 transition-all duration-300"
                      required
                    />
                    <p className="text-[10px] font-mono text-white/40 mt-2 leading-relaxed">
                      By default, QueryBridge runs in <span className="text-neon-cyan">Quantum Simulation</span> mode. Changing this URL routes natural language requests to a real Flask service hosting LLM SQL compilation modules.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-neon-cyan to-neon-blue text-black font-display font-bold text-xs py-3 rounded-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-300 cursor-pointer"
                  >
                    {saveSuccess ? 'SYSTEM CONFIG RE-COMPILATION OK' : 'APPLY CONFIGURATION'}
                  </button>
                </form>
              </div>

              <div className="border-t border-white/5 pt-6 font-mono text-[10px] text-white/30 space-y-1">
                <div>QUERYBRIDGE ENGINE v1.0.0-PROTOTYPE</div>
                <div>SYSTEM LOG LEVEL: VERBOSE</div>
                <div>THEME: QUERYBRIDGE OS</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
