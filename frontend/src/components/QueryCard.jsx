import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiFileCopyLine, RiCheckLine, RiTerminalBoxLine, RiTimerLine, RiCpuLine } from 'react-icons/ri';

const QueryCard = ({ queryResult }) => {
  const { query, sql, latency, tokensUsed, database, mode } = queryResult;
  const [copied, setCopied] = useState(false);
  const [typedSql, setTypedSql] = useState('');

  // Typewriter effect for simulated AI compilation output
  useEffect(() => {
    setTypedSql('');
    let index = 0;
    const interval = setInterval(() => {
      setTypedSql((prev) => prev + sql.charAt(index));
      index++;
      if (index >= sql.length) {
        clearInterval(interval);
      }
    }, 4); // fast typing speed

    return () => clearInterval(interval);
  }, [sql]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-3xl mx-auto mt-8 glass-panel-cyan rounded-2xl p-6 relative border border-neon-cyan/30 shadow-[0_0_30px_rgba(0,240,255,0.08)] overflow-hidden"
    >
      {/* Top Header details */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <RiTerminalBoxLine className="text-xl text-neon-cyan" />
          <div>
            <h4 className="font-display font-bold text-sm text-white tracking-wide uppercase">
              SQL AST Compilation
            </h4>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              TARGET DATABASE: <span className="text-neon-cyan">{database}</span>
            </p>
          </div>
        </div>

        {/* Diagnostic Metadata stats */}
        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-md px-2 py-1 text-[10px] font-mono text-white/50">
            <RiTimerLine className="text-neon-cyan" />
            <span>LATENCY: <strong className="text-white">{latency}</strong></span>
          </div>
          <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-md px-2 py-1 text-[10px] font-mono text-white/50">
            <RiCpuLine className="text-neon-purple" />
            <span>TOKENS: <strong className="text-white">{tokensUsed}</strong></span>
          </div>
          <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-md px-2 py-1 text-[10px] font-mono">
            {mode === 'simulated' ? (
              <span className="text-neon-purple shadow-[0_0_10px_rgba(171,0,255,0.3)] font-bold">SIMULATION</span>
            ) : (
              <span className="text-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)] font-bold">LIVE CORE</span>
            )}
          </div>
        </div>
      </div>

      {/* Natural language query block */}
      <div className="mb-5 bg-black/30 border border-white/5 rounded-lg p-3">
        <span className="font-mono text-[9px] text-white/30 block mb-1 uppercase tracking-wider">
          Source Language Request:
        </span>
        <p className="text-sm font-medium text-white/90 italic">
          "{query}"
        </p>
      </div>

      {/* Generated SQL editor panel */}
      <div className="relative rounded-xl overflow-hidden bg-[#02000e] border border-white/10">
        {/* Editor Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="text-[10px] font-mono text-white/40 ml-2">sql_output.sql</span>
          </div>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-neon-cyan/20 border border-white/10 hover:border-neon-cyan/50 text-[10px] font-mono text-white/80 hover:text-white transition-all duration-200 cursor-pointer"
          >
            {copied ? (
              <>
                <RiCheckLine className="text-xs text-neon-cyan" />
                <span className="text-neon-cyan">COPIED</span>
              </>
            ) : (
              <>
                <RiFileCopyLine className="text-xs" />
                <span>COPY SQL</span>
              </>
            )}
          </button>
        </div>

        {/* SQL Code Block */}
        <pre className="p-5 overflow-x-auto text-left text-sm font-mono text-[#e2e8f0] leading-relaxed max-h-56 select-all scrollbar-thin">
          <code className="text-neon-cyan">{typedSql}</code>
          {typedSql.length < sql.length && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="inline-block w-1.5 h-4 bg-neon-cyan ml-0.5"
            />
          )}
        </pre>
      </div>
    </motion.div>
  );
};

export default QueryCard;
