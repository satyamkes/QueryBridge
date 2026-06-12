import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiHome5Line, RiHistoryLine, RiInformationLine, RiSettings4Line, RiCpuLine, RiSunLine, RiMoonLine, RiDatabase2Line, RiLogoutCircleRLine, RiShieldUserLine } from 'react-icons/ri';
import logo from '../assets/logo.svg';
import { getApiUrl, setApiUrl, getCustomTables, addCustomTable, removeCustomTable } from '../services/api';

const Navbar = ({ currentPage, setCurrentPage, theme, toggleTheme, user, onLogout }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
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
        className="sticky top-0 left-0 w-full z-40 px-4 md:px-8 py-4 backdrop-blur-md border-b border-theme-text/5 bg-space-dark/65 transition-colors duration-300"
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
              <span className="font-display font-extrabold text-xl tracking-wider brand-title-navbar">
                QueryBridge
              </span>
              <span className="text-[9px] text-theme-muted font-mono tracking-widest -mt-1 uppercase">
                AI Trans-SQL Engine
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-theme-text/5 border border-theme-text/5 rounded-full p-1.5 backdrop-blur-lg">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`relative flex items-center gap-2 px-5 py-2 rounded-full font-display text-xs font-semibold tracking-wide transition-all duration-300 ${
                    isActive 
                      ? 'text-theme-text' 
                      : 'text-theme-muted hover:text-theme-text hover:bg-theme-text/5'
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

            {user && (
              <div className="hidden lg:flex items-center gap-2 bg-theme-text/5 border border-theme-text/10 rounded-lg px-3 py-1.5 font-mono text-[10px] tracking-wide text-theme-muted">
                <RiShieldUserLine className="text-neon-cyan" />
                <span className="max-w-32 truncate">{user.name}</span>
              </div>
            )}

            {/* Theme Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="p-2.5 rounded-lg bg-theme-text/5 hover:bg-neon-cyan/10 border border-theme-text/10 hover:border-neon-cyan/40 text-theme-text/80 hover:text-neon-cyan transition-all duration-300 shadow-[0_0_10px_rgba(0,240,255,0.05)] cursor-pointer"
              title={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {theme === 'dark' ? <RiSunLine className="text-lg" /> : <RiMoonLine className="text-lg" />}
            </motion.button>

            {/* Config Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsConfigOpen(true)}
              className="p-2.5 rounded-lg bg-theme-text/5 hover:bg-neon-purple/10 border border-theme-text/10 hover:border-neon-purple/40 text-theme-text/80 hover:text-neon-purple transition-all duration-300 shadow-[0_0_10px_rgba(171,0,255,0.05)] cursor-pointer"
              title="API Configuration"
            >
              <RiSettings4Line className="text-lg" />
            </motion.button>
            
            {/* Custom Tables Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCustomOpen(true)}
              className="p-2.5 rounded-lg bg-theme-text/5 hover:bg-neon-purple/10 border border-theme-text/10 hover:border-neon-purple/40 text-theme-text/80 hover:text-neon-purple transition-all duration-300 shadow-[0_0_10px_rgba(171,0,255,0.05)] cursor-pointer"
              title="Manage Custom Tables"
            >
              <RiDatabase2Line className="text-lg" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLogout}
              className="p-2.5 rounded-lg bg-theme-text/5 hover:bg-red-500/10 border border-theme-text/10 hover:border-red-400/40 text-theme-text/80 hover:text-red-300 transition-all duration-300 shadow-[0_0_10px_rgba(255,0,80,0.05)] cursor-pointer"
              title="Logout"
            >
              <RiLogoutCircleRLine className="text-lg" />
            </motion.button>
          </div>
        </div>

        {/* Small screen mobile navigation overlay */}
        <div className="flex md:hidden justify-center items-center gap-6 mt-4 pt-3 border-t border-theme-text/5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex flex-col items-center gap-1 text-[11px] font-semibold tracking-wider font-display transition-all duration-300 ${
                  isActive ? 'text-neon-cyan' : 'text-theme-muted'
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
                <div className="flex items-center justify-between border-b border-theme-text/10 pb-4 mb-6">
                  <h3 className="font-display font-bold text-lg text-theme-text tracking-wide">
                    SYSTEM SETTINGS
                  </h3>
                  <button 
                    onClick={() => setIsConfigOpen(false)}
                    className="text-theme-muted hover:text-theme-text text-sm cursor-pointer"
                  >
                    CLOSE [ESC]
                  </button>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-6">
                  <div>
                    <label className="block font-mono text-[11px] text-theme-muted tracking-wider mb-2 uppercase">
                      AI Bridge Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={(e) => setApiUrlState(e.target.value)}
                      placeholder="e.g. http://localhost:5000/api"
                      className="w-full bg-theme-input border border-theme-input-border rounded-lg p-3 text-sm font-mono text-theme-text focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/30 transition-all duration-300"
                      required
                    />
                    <p className="text-[10px] font-mono text-theme-dim mt-2 leading-relaxed">
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

              <div className="border-t border-theme-text/5 pt-6 font-mono text-[10px] text-theme-dim space-y-1">
                <div>QUERYBRIDGE ENGINE v1.0.0-PROTOTYPE</div>
                <div>SYSTEM LOG LEVEL: VERBOSE</div>
                <div>THEME: {theme.toUpperCase()}</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Tables Drawer */}
      <AnimatePresence>
        {isCustomOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomOpen(false)}
              className="fixed inset-0 bg-black z-50 pointer-events-auto"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-space-deep border-l border-neon-cyan/20 p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 overflow-y-auto flex flex-col"
            >
              <div>
                <div className="flex items-center justify-between border-b border-theme-text/10 pb-4 mb-6">
                  <h3 className="font-display font-bold text-lg text-theme-text tracking-wide">
                    CUSTOM TABLES
                  </h3>
                  <button 
                    onClick={() => setIsCustomOpen(false)}
                    className="text-theme-muted hover:text-theme-text text-sm cursor-pointer"
                  >
                    CLOSE [ESC]
                  </button>
                </div>

                <CustomTablesPanel />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const CustomTablesPanel = () => {
  const [name, setName] = useState('');
  const [columns, setColumns] = useState('');
  const [rowsJson, setRowsJson] = useState('');
  const [message, setMessage] = useState('');
  const [customTables, setCustomTables] = useState(getCustomTables());

  const handleAdd = (e) => {
    e.preventDefault();
    let parsedRows = [];
    if (rowsJson.trim()) {
      try {
        parsedRows = JSON.parse(rowsJson);
        if (!Array.isArray(parsedRows)) throw new Error('Rows must be an array');
      } catch {
        setMessage('Invalid JSON for rows (must be an array of objects).');
        return;
      }
    }

    const cols = columns.split(',').map(c => c.trim()).filter(Boolean);
    const ok = addCustomTable({ name: name.trim(), columns: cols, rows: parsedRows });
    if (ok) {
      setMessage('Custom table added.');
      setCustomTables(getCustomTables());
      setName(''); setColumns(''); setRowsJson('');
    } else {
      setMessage('Table exists or invalid input.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRemove = (tableName) => {
    removeCustomTable(tableName);
    setCustomTables(getCustomTables());
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="space-y-4">
        <div>
          <label className="block font-mono text-[11px] text-theme-muted mb-2 uppercase">Table Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-theme-input border border-theme-input-border rounded-lg p-3 text-sm" required />
        </div>
        <div>
          <label className="block font-mono text-[11px] text-theme-muted mb-2 uppercase">Columns (comma separated)</label>
          <input value={columns} onChange={(e) => setColumns(e.target.value)} className="w-full bg-theme-input border border-theme-input-border rounded-lg p-3 text-sm" placeholder="id, name, grade" />
        </div>
        <div>
          <label className="block font-mono text-[11px] text-theme-muted mb-2 uppercase">Rows (JSON array, optional)</label>
          <textarea value={rowsJson} onChange={(e) => setRowsJson(e.target.value)} rows={4} className="w-full bg-theme-input border border-theme-input-border rounded-lg p-3 text-sm font-mono" placeholder='[{"id":1,"name":"Ada"}]' />
        </div>
        <div>
          <button type="submit" className="bg-neon-cyan text-black px-4 py-2 rounded-lg font-bold">Add Table</button>
        </div>
      </form>

      {message && <div className="text-sm font-mono text-neon-cyan">{message}</div>}

      <div className="border-t border-theme-text/5 pt-4">
        <h4 className="font-display text-sm text-theme-text mb-3">Existing Custom Tables</h4>
        {customTables.length === 0 && <div className="text-theme-muted text-[13px]">No custom tables added yet.</div>}
        <ul className="space-y-3 mt-2">
          {customTables.map((t) => (
            <li key={t.name} className="flex items-center justify-between bg-space-deep/40 p-3 rounded-lg">
              <div>
                <div className="font-mono text-sm text-theme-text">{t.name}</div>
                <div className="text-theme-muted text-[12px]">{(t.columns || []).join(', ')}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(t.rows || []))} className="text-theme-muted hover:text-theme-text">Copy Rows</button>
                <button onClick={() => handleRemove(t.name)} className="text-red-400 hover:text-red-500 font-bold">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Navbar;
