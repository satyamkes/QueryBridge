import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiHistoryLine, RiDeleteBin5Line, RiTerminalBoxLine, RiFileCopyLine, RiCheckLine, RiPlayLine, RiDatabaseLine } from 'react-icons/ri';

const History = ({ onReRun }) => {
  const [historyItems, setHistoryItems] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('QUERYBRIDGE_HISTORY') || '[]');
    setHistoryItems(items);
  }, []);

  const handleDeleteItem = (id) => {
    const updated = historyItems.filter(item => item.id !== id);
    setHistoryItems(updated);
    localStorage.setItem('QUERYBRIDGE_HISTORY', JSON.stringify(updated));
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear the system compilation log history?")) {
      setHistoryItems([]);
      localStorage.setItem('QUERYBRIDGE_HISTORY', '[]');
    }
  };

  const handleCopySql = (id, sqlText) => {
    navigator.clipboard.writeText(sqlText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-text/10 pb-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan shadow-[0_0_15px_rgba(0,240,255,0.1)]">
            <RiHistoryLine className="text-xl" />
          </div>
          <div>
            <h2 className="font-display font-black text-3xl text-theme-text tracking-wide">
              AST COMPILATION LOGS
            </h2>
            <p className="text-xs font-mono text-theme-dim mt-1 uppercase tracking-wider">
              Review previously translated database transactions
            </p>
          </div>
        </div>

        {historyItems.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/50 text-xs font-mono text-red-400 hover:text-red-300 transition-all duration-200 cursor-pointer"
          >
            <RiDeleteBin5Line />
            <span>PURGE LOGS</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {historyItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-theme-text/2 border border-dashed border-theme-text/10 rounded-2xl max-w-xl mx-auto"
        >
          <RiHistoryLine className="text-5xl text-theme-dim/50 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-theme-text mb-2">No Records Found</h3>
          <p className="text-xs text-theme-muted max-w-sm mx-auto leading-relaxed">
            Your query transaction records are currently empty. Return to the workspace terminal and generate SQL queries to populate this deck.
          </p>
        </motion.div>
      ) : (
        /* History Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {historyItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -6, borderColor: 'rgba(0, 240, 255, 0.25)', boxShadow: '0 10px 25px rgba(0, 240, 255, 0.05)' }}
                className="glass-panel rounded-xl p-5 border border-theme-text/5 shadow-[0_5px_15px_rgba(0,0,0,0.3)] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header metadata */}
                  <div className="flex items-center justify-between border-b border-theme-text/5 pb-3 mb-4 font-mono text-[9px] text-theme-dim">
                    <span className="flex items-center gap-1">
                      <RiDatabaseLine className="text-neon-cyan" /> {item.database || 'PostgreSQL'}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>

                  {/* Natural language statement */}
                  <div className="mb-4">
                    <span className="font-mono text-[9px] text-theme-dim block mb-1 uppercase tracking-wider">
                      English Query:
                    </span>
                    <p className="text-sm font-semibold text-theme-text leading-snug">
                      "{item.query}"
                    </p>
                  </div>

                  {/* SQL Preview block */}
                  <div className="bg-theme-code border border-theme-code-border rounded-lg p-3.5 mb-4 relative group">
                    <span className="font-mono text-[8px] text-theme-dim block mb-1 uppercase tracking-wider">
                      Compiled SQL:
                    </span>
                    <pre className="text-xs font-mono text-neon-cyan/90 overflow-x-auto whitespace-pre leading-relaxed select-all pr-8 scrollbar-none max-h-24">
                      {item.sql}
                    </pre>

                    {/* Copy action */}
                    <button
                      onClick={() => handleCopySql(item.id, item.sql)}
                      className="absolute right-2 top-2 p-1.5 rounded bg-theme-text/5 border border-theme-text/10 hover:border-neon-cyan/50 text-[10px] text-theme-muted hover:text-neon-cyan transition-all duration-200 cursor-pointer"
                      title="Copy SQL Code"
                    >
                      {copiedId === item.id ? (
                        <RiCheckLine className="text-neon-cyan" />
                      ) : (
                        <RiFileCopyLine />
                      )}
                    </button>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="flex items-center justify-between border-t border-theme-text/5 pt-3.5 mt-2">
                  <div className="font-mono text-[9px] text-theme-dim uppercase">
                    RESULTS: <strong className="text-theme-muted">{item.rowsCount} Rows</strong> | SPEED: <strong className="text-theme-muted">{item.latency}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 rounded bg-theme-text/5 border border-theme-text/10 hover:border-red-500/40 text-theme-muted hover:text-red-400 transition-colors duration-200 cursor-pointer"
                      title="Delete log record"
                    >
                      <RiDeleteBin5Line className="text-xs" />
                    </button>
                    
                    <button
                      onClick={() => onReRun(item.query)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-gradient-to-r from-neon-cyan to-neon-blue text-black font-display font-bold text-[10px] hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all duration-200 cursor-pointer"
                    >
                      <RiPlayLine className="text-xs" />
                      <span>RERUN</span>
                    </button>
                  </div>
                </div>

              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
};

export default History;
