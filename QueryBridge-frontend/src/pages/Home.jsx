import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InputBox from '../components/InputBox';
import QueryCard from '../components/QueryCard';
import ResultTable from '../components/ResultTable';
import Loader from '../components/Loader';
import { generateSqlQuery } from '../services/api';
import { RiDatabaseLine, RiCpuLine, RiNodeTree, RiBrainLine, RiMicLine, RiDownloadLine, RiFlashlightLine, RiSearchEyeLine, RiAlertLine } from 'react-icons/ri';

const DATABASE_SCHEMA = [
  { name: 'users',       count: 188,  columns: ['id (PK)', 'name', 'email', 'state', 'created_at'] },
  { name: 'products',    count: 45,   columns: ['product_id (PK)', 'name', 'price', 'category'] },
  { name: 'orders',      count: 890,  columns: ['order_id (PK)', 'user_id (FK)', 'order_date', 'total_amount', 'status'] },
  { name: 'order_items', count: 2410, columns: ['item_id (PK)', 'order_id (FK)', 'product_id (FK)', 'quantity', 'total_price'] },
];

const MAX_ROWS = 2410; // for progress bar scaling

const FEATURE_PILLS = [
  { icon: RiBrainLine,    label: 'NLP → SQL',       color: 'neon-cyan'   },
  { icon: RiMicLine,      label: 'Voice Input',      color: 'neon-purple' },
  { icon: RiFlashlightLine, label: 'Instant Results', color: 'neon-cyan'  },
  { icon: RiDownloadLine, label: 'CSV Export',        color: 'neon-purple' },
  { icon: RiSearchEyeLine,label: 'Schema-Aware',      color: 'neon-cyan'  },
];

const Home = ({ prompt, setPrompt, queryResult, setQueryResult, isPending, setIsPending }) => {
  const resultsRef = useRef(null);
  const resultsTableRef = useRef(null);
  const [showTable, setShowTable] = useState(false);

  const handleSubmit = async (overridePrompt) => {
    const activePrompt = typeof overridePrompt === 'string' ? overridePrompt : prompt;
    if (!activePrompt.trim()) return;
    setIsPending(true);
    setQueryResult(null);
    setShowTable(false);

    // Smooth scroll to results/loader area
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    const result = await generateSqlQuery(activePrompt);
    setQueryResult(result);
    setIsPending(false);

    if (result && result.success) {
      const history = JSON.parse(localStorage.getItem('QUERYBRIDGE_HISTORY') || '[]');
      const newHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
        query: activePrompt,
        sql: result.sql,
        latency: result.latency,
        rowsCount: result.rows.length,
        database: result.database,
      };
      localStorage.setItem('QUERYBRIDGE_HISTORY', JSON.stringify([newHistoryItem, ...history]));
    }
  };

  const handleTypingComplete = () => {
    setTimeout(() => {
      setShowTable(true);
      setTimeout(() => {
        resultsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }, 1500);
  };

  const handleColumnClick = (colName) => {
    const clean = colName.replace(/\s*\(.*?\)/g, '').trim();
    setPrompt((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} ${clean}` : clean;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">

      {/* Title & Introduction */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="inline-block"
        >
          <h1 className="font-display font-extrabold text-6xl md:text-8xl tracking-tight brand-title-main mb-3">
            QueryBridge
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="font-display text-sm md:text-base text-theme-muted tracking-widest uppercase font-light mb-6"
        >
          Bridge Between Human Language and Databases
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {FEATURE_PILLS.map((pill, i) => {
            const Icon = pill.icon;
            const isCyan = pill.color === 'neon-cyan';
            return (
              <motion.div
                key={pill.label}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.07, duration: 0.4 }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold border transition-all duration-300 ${
                  isCyan
                    ? 'bg-neon-cyan/5 border-neon-cyan/20 text-neon-cyan'
                    : 'bg-neon-purple/5 border-neon-purple/20 text-neon-purple'
                }`}
              >
                <Icon className="text-xs" />
                <span>{pill.label}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Grid: Schema Sidebar + Input */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start mb-16">

        {/* Schema Sidebar */}
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="lg:col-span-1 glass-panel rounded-2xl p-5 border border-theme-text/5 shadow-[0_10px_20px_rgba(0,0,0,0.4)] animate-float-delayed"
        >
          <div className="flex items-center gap-2 border-b border-theme-text/10 pb-3 mb-4">
            <RiDatabaseLine className="text-neon-purple text-lg" />
            <h3 className="font-display font-bold text-xs text-theme-text tracking-wider uppercase">
              Target Schema Info
            </h3>
          </div>

          <div className="space-y-4">
            {DATABASE_SCHEMA.map((table) => {
              const pct = Math.round((table.count / MAX_ROWS) * 100);
              return (
                <div
                  key={table.name}
                  className="bg-theme-code/15 border border-theme-text/5 rounded-lg p-3 hover:border-neon-purple/20 transition-colors duration-250 group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-neon-purple font-semibold">
                      {table.name}
                    </span>
                    <span className="font-mono text-[9px] text-theme-dim uppercase">
                      {table.count.toLocaleString()} rows
                    </span>
                  </div>

                  {/* Row-count progress bar */}
                  <div className="w-full h-0.5 bg-theme-text/5 rounded-full mb-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-neon-purple/60 to-neon-cyan/60 rounded-full"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {table.columns.map((col) => (
                      <button
                        key={col}
                        onClick={() => handleColumnClick(col)}
                        title={`Insert "${col.replace(/\s*\(.*?\)/g, '').trim()}" into query`}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-theme-text/5 text-theme-muted group-hover:text-theme-text hover:!bg-neon-purple/20 hover:!text-neon-purple hover:border-neon-purple/30 border border-transparent transition-all duration-150 cursor-pointer"
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-3 border-t border-theme-text/5 flex items-center justify-between font-mono text-[9px] text-theme-dim">
            <span className="flex items-center gap-1">
              <RiCpuLine className="text-neon-cyan" /> DB: POSTGRESQL
            </span>
            <span className="flex items-center gap-1">
              <RiNodeTree className="text-neon-purple" /> SCHEMAS: 1
            </span>
          </div>
        </motion.div>

        {/* Input + Results */}
        <div className="lg:col-span-3">
          <InputBox
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSubmit}
            isPending={isPending}
          />

          <div ref={resultsRef} className="scroll-mt-10" />

          <AnimatePresence mode="wait">
            {isPending && (
              <motion.div
                key="loader"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                <Loader />
              </motion.div>
            )}

            {!isPending && !queryResult && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="mt-12 flex flex-col items-center gap-4 text-center select-none pointer-events-none"
              >
                {/* Animated rings */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full border border-neon-cyan/30"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.25, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut', delay: 0.4 }}
                    className="absolute inset-0 rounded-full border border-neon-purple/20 m-[-8px]"
                  />
                  <RiDatabaseLine className="text-3xl text-neon-cyan/40" />
                </div>

                <p className="font-display font-semibold text-sm text-theme-muted tracking-wide">
                  Ask anything about your database
                </p>
                <p className="font-mono text-[10px] text-theme-dim max-w-xs leading-relaxed">
                  Type a question in plain English above — or click a suggestion chip — and QueryBridge will translate it to SQL and run it instantly.
                </p>

                {/* Hint row */}
                <div className="flex items-center gap-3 mt-1">
                  {['users', 'orders', 'products'].map((t) => (
                    <span key={t} className="font-mono text-[9px] px-2 py-1 rounded bg-theme-text/5 border border-theme-text/5 text-theme-dim">
                      {t}
                    </span>
                  ))}
                  <span className="font-mono text-[9px] text-theme-dim">← available tables</span>
                </div>
              </motion.div>
            )}

            {queryResult && queryResult.success && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <QueryCard queryResult={queryResult} onTypingComplete={handleTypingComplete} />
                <div ref={resultsTableRef} className="scroll-mt-10" />
                {showTable && <ResultTable queryResult={queryResult} />}
              </motion.div>
            )}

            {queryResult && !queryResult.success && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-3xl mx-auto mt-8 glass-panel border border-red-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(239,68,68,0.08)]"
              >
                <div className="flex items-center gap-3 border-b border-theme-text/10 pb-4 mb-4">
                  <RiAlertLine className="text-2xl text-red-400 animate-pulse" />
                  <div>
                    <h4 className="font-display font-bold text-sm text-theme-text tracking-wide uppercase">
                      Query Translation Refused
                    </h4>
                    <p className="text-[10px] font-mono text-theme-dim mt-0.5">
                      SCHEMA RESOLVER ERROR
                    </p>
                  </div>
                </div>
                <div className="mb-4 bg-theme-code/15 border border-theme-text/5 rounded-lg p-3">
                  <span className="font-mono text-[9px] text-theme-dim block mb-1 uppercase tracking-wider">
                    Source Language Request:
                  </span>
                  <p className="text-sm font-medium text-theme-text italic">
                    "{queryResult.query}"
                  </p>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex flex-col gap-2">
                  <p className="font-mono text-[10px] text-red-400 font-bold uppercase tracking-wider">
                    Error Description:
                  </p>
                  <p className="font-sans text-sm text-theme-muted">
                    {queryResult.error || "The query is not relevant to the current database tables. Please query database concepts (users, products, orders, or revenues)."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Home;
