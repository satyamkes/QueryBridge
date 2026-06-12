import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiAlertLine, RiCheckLine, RiCloseLine, RiLoader4Line } from 'react-icons/ri';
import { executeConfirmedSql } from '../services/api';

const ConfirmationModal = ({ isOpen, onClose, sql, actionType, onExecuted }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setIsExecuting(true);
    setError(null);
    try {
      const data = await executeConfirmedSql(sql);
      setResult(data);
      if (onExecuted) onExecuted(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg glass-panel rounded-2xl border border-red-500/30 shadow-[0_20px_60px_rgba(239,68,68,0.15)] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 bg-red-500/10 border-b border-red-500/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <RiAlertLine className="text-red-400 text-xl animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-theme-text tracking-wide">
                    Confirm Destructive Operation
                  </h3>
                  <p className="font-mono text-[10px] text-red-400 tracking-wider uppercase">
                    {actionType} QUERY — REQUIRES CONFIRMATION
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div>
                  <p className="font-mono text-[10px] text-theme-dim tracking-wider uppercase mb-2">
                    Generated SQL Statement:
                  </p>
                  <div className="bg-theme-code border border-theme-code-border rounded-lg p-4 font-mono text-sm text-red-300 whitespace-pre-wrap break-all">
                    {sql}
                  </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                  <p className="text-xs text-theme-muted">
                    <span className="text-red-400 font-bold">⚠ Warning:</span> This operation will modify your database. This action may be irreversible. An entry will be logged in the audit trail.
                  </p>
                </div>

                {/* Result / Error */}
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg p-3 font-mono text-xs text-neon-cyan"
                    >
                      ✓ {result.message || 'Query executed successfully.'}
                      {result.rows_affected !== undefined && (
                        <span className="block mt-1 text-theme-muted">
                          Rows affected: {result.rows_affected} | Latency: {result.latency}
                        </span>
                      )}
                    </motion.div>
                  )}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 font-mono text-xs text-red-400"
                    >
                      ✗ {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer Buttons */}
              <div className="px-6 py-4 border-t border-theme-text/5 flex items-center justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-lg border border-theme-text/20 text-theme-muted hover:text-theme-text hover:border-theme-text/40 font-display text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer"
                >
                  <RiCloseLine className="inline mr-1" />
                  {result ? 'CLOSE' : 'CANCEL'}
                </motion.button>
                
                {!result && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    disabled={isExecuting}
                    className="px-5 py-2.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-display text-xs font-bold tracking-wide transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] cursor-pointer"
                  >
                    {isExecuting ? (
                      <RiLoader4Line className="inline mr-1 animate-spin" />
                    ) : (
                      <RiCheckLine className="inline mr-1" />
                    )}
                    {isExecuting ? 'EXECUTING...' : 'CONFIRM EXECUTION'}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ConfirmationModal;
