import React, { useState } from 'react';
import Navbar from './components/Navbar';
import FloatingBackground from './components/FloatingBackground';
import Home from './pages/Home';
import History from './pages/History';
import About from './pages/About';
import { generateSqlQuery } from './services/api';

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [prompt, setPrompt] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isPending, setIsPending] = useState(false);

  // Reruns a historical query: updates text input, navigates back home, and executes
  const handleReRun = async (queryText) => {
    setPrompt(queryText);
    setCurrentPage('home');
    setQueryResult(null);
    setIsPending(true);

    const result = await generateSqlQuery(queryText);
    
    setQueryResult(result);
    setIsPending(false);

    if (result && result.success) {
      const history = JSON.parse(localStorage.getItem('QUERYBRIDGE_HISTORY') || '[]');
      const newHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
        query: queryText,
        sql: result.sql,
        latency: result.latency,
        rowsCount: result.rows.length,
        database: result.database,
      };
      localStorage.setItem('QUERYBRIDGE_HISTORY', JSON.stringify([newHistoryItem, ...history]));
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Home
            prompt={prompt}
            setPrompt={setPrompt}
            queryResult={queryResult}
            setQueryResult={setQueryResult}
            isPending={isPending}
            setIsPending={setIsPending}
          />
        );
      case 'history':
        return <History onReRun={handleReRun} />;
      case 'about':
        return <About />;
      default:
        return (
          <Home
            prompt={prompt}
            setPrompt={setPrompt}
            queryResult={queryResult}
            setQueryResult={setQueryResult}
            isPending={isPending}
            setIsPending={setIsPending}
          />
        );
    }
  };

  return (
    <div className="relative min-h-screen grid-overlay text-white">
      {/* Dynamic Star Canvas Background */}
      <FloatingBackground />

      {/* Cybernetic header */}
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {/* Page Content Shell */}
      <main className="w-full relative z-10">
        {renderPage()}
      </main>

      {/* Small design accent footer */}
      <footer className="w-full py-6 border-t border-white/5 bg-black/10 backdrop-blur-sm relative z-10 text-center font-mono text-[9px] text-white/20 tracking-wider">
        © 2026 QUERYBRIDGE QUANTUM CORE. ALL PROTOCOLS ENFORCED.
      </footer>
    </div>
  );
};

export default App;
