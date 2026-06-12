import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import FloatingBackground from './components/FloatingBackground';
import Auth from './pages/Auth';
import Home from './pages/Home';
import History from './pages/History';
import About from './pages/About';
import { fetchCurrentUser, generateSqlQuery, getStoredAuth, logoutUser } from './services/api';

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [prompt, setPrompt] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [authUser, setAuthUser] = useState(() => getStoredAuth()?.user || null);
  const [isAuthChecking, setIsAuthChecking] = useState(Boolean(getStoredAuth()));

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

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth) return;

    let isMounted = true;
    fetchCurrentUser().then((result) => {
      if (!isMounted) return;
      setAuthUser(result.success ? result.user : null);
      setIsAuthChecking(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    logoutUser();
    setAuthUser(null);
    setCurrentPage('home');
    setPrompt('');
    setQueryResult(null);
  };

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

  if (isAuthChecking) {
    return (
      <div className="relative min-h-screen grid-overlay text-theme-text transition-colors duration-300 flex items-center justify-center">
        <FloatingBackground theme={theme} />
        <div className="relative z-10 glass-panel-cyan rounded-2xl px-8 py-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neon-cyan">
            Validating secure session...
          </p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        <FloatingBackground theme={theme} />
        <Auth onAuthenticated={setAuthUser} theme={theme} toggleTheme={toggleTheme} />
      </>
    );
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
        user={authUser}
        onLogout={handleLogout}
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
