import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InputBox from '../components/InputBox';
import QueryCard from '../components/QueryCard';
import ResultTable from '../components/ResultTable';
import Loader from '../components/Loader';
import { generateSqlQuery } from '../services/api';
import { RiDatabaseLine, RiCpuLine, RiNodeTree } from 'react-icons/ri';

const DATABASE_SCHEMA = [
  { name: 'users', count: 188, columns: ['id (PK)', 'name', 'email', 'state', 'created_at'] },
  { name: 'products', count: 45, columns: ['product_id (PK)', 'name', 'price', 'category'] },
  { name: 'orders', count: 890, columns: ['order_id (PK)', 'user_id (FK)', 'order_date', 'total_amount', 'status'] },
  { name: 'order_items', count: 2410, columns: ['item_id (PK)', 'order_id (FK)', 'product_id (FK)', 'quantity', 'total_price'] }
];

const Home = ({ prompt, setPrompt, queryResult, setQueryResult, isPending, setIsPending }) => {

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setIsPending(true);
    setQueryResult(null);

    // Call translation service (live or simulated fallback)
    const result = await generateSqlQuery(prompt);
    
    setQueryResult(result);
    setIsPending(false);

    // Save search to History page (localStorage)
    if (result && result.success) {
      const history = JSON.parse(localStorage.getItem('QUERYBRIDGE_HISTORY') || '[]');
      const newHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
        query: prompt,
        sql: result.sql,
        latency: result.latency,
        rowsCount: result.rows.length,
        database: result.database,
      };
      localStorage.setItem('QUERYBRIDGE_HISTORY', JSON.stringify([newHistoryItem, ...history]));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      
      {/* Title & Introduction */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="inline-block"
        >
          <h1 className="font-display font-extrabold text-6xl md:text-8xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-[#00ffcc] to-[#00ffa2] filter drop-shadow-[0_0_15px_rgba(0,255,200,0.4)] mb-3">
            QueryBridge
          </h1>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="font-display text-sm md:text-base text-white/70 tracking-widest uppercase font-light"
        >
          Bridge Between Human Language and Databases
        </motion.p>
      </div>

      {/* Grid containing Input + Schema Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start mb-16">
        
        {/* Schema Sidebar - Floating Interactive card */}
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="lg:col-span-1 glass-panel rounded-2xl p-5 border border-white/5 shadow-[0_10px_20px_rgba(0,0,0,0.4)] animate-float-delayed"
        >
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
            <RiDatabaseLine className="text-neon-purple text-lg" />
            <h3 className="font-display font-bold text-xs text-white tracking-wider uppercase">
              Target Schema Info
            </h3>
          </div>

          <div className="space-y-4">
            {DATABASE_SCHEMA.map((table) => (
              <div 
                key={table.name}
                className="bg-black/20 border border-white/5 rounded-lg p-3 hover:border-neon-purple/20 transition-colors duration-250 group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs text-neon-purple font-semibold">
                    {table.name}
                  </span>
                  <span className="font-mono text-[9px] text-white/30 uppercase">
                    {table.count} rows
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {table.columns.map((col) => (
                    <span 
                      key={col} 
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/50 group-hover:text-white/80 transition-colors duration-200"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-white/30">
            <span className="flex items-center gap-1">
              <RiCpuLine className="text-neon-cyan" /> DB: POSTGRESQL
            </span>
            <span className="flex items-center gap-1">
              <RiNodeTree className="text-neon-purple" /> SCHEMAS: 1
            </span>
          </div>
        </motion.div>

        {/* Input box section */}
        <div className="lg:col-span-3">
          <InputBox
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSubmit}
            isPending={isPending}
          />

          {/* Loader or Results display */}
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

            {queryResult && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <QueryCard queryResult={queryResult} />
                <ResultTable queryResult={queryResult} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Home;
