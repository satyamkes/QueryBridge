import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import FloatingBackground from './components/FloatingBackground';
import Home from './pages/Home';
import History from './pages/History';
import About from './pages/About';
import Login from './pages/Login';
import { generateSqlQuery } from './services/api';

const App = () => {
  const { isAuthenticated, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [prompt, setPrompt] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isPending, setIsPending] = useState(false);

  // Initialize theme state from localStorage or system preference
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('QUERYBRIDGE_THEME');
    if (savedTheme) return savedTheme;
    return 'dark'; // Default to dark
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('QUERYBRIDGE_THEME', next);
      return next;
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);

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

  // Show loading spinner while auth state is being restored
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030014]">
        <div className="w-8 h-8 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="relative min-h-screen grid-overlay text-theme-text transition-colors duration-300">
      {/* Dynamic Star Canvas Background */}
      <FloatingBackground theme={theme} />

      {/* Cybernetic header */}
      <Navbar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        theme={theme} 
        toggleTheme={toggleTheme} 
      />

      {/* Page Content Shell */}
      <main className="w-full relative z-10">
        {renderPage()}
      </main>

      {/* Small design accent footer */}
      <footer className="w-full py-6 border-t border-theme-text/5 bg-theme-code/15 backdrop-blur-sm relative z-10 text-center font-mono text-[9px] text-theme-dim tracking-wider">
        © 2026 QUERYBRIDGE QUANTUM CORE. ALL PROTOCOLS ENFORCED.
      </footer>
    </div>
  );
};

export default App;
