import axios from 'axios';

// Load initial API base URL from localStorage or fallback to standard Flask local development port
const DEFAULT_API_URL = 'http://localhost:5000/api';
let apiBaseUrl = localStorage.getItem('QUERYBRIDGE_API_URL') || DEFAULT_API_URL;

export const getApiUrl = () => apiBaseUrl;

export const setApiUrl = (url) => {
  apiBaseUrl = url;
  localStorage.setItem('QUERYBRIDGE_API_URL', url);
};

// Create axios instance
const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds
});

// High-fidelity Mock responses for demonstration and offline mode
const MOCK_QUERIES = [
  {
    keywords: ['user', 'california', 'ca'],
    sql: `SELECT id, name, email, state, created_at \nFROM users \nWHERE state = 'CA' \nORDER BY created_at DESC;`,
    columns: ['id', 'name', 'email', 'state', 'created_at'],
    rows: [
      { id: 104, name: 'Elena Rostova', email: 'elena.r@nebula.io', state: 'CA', created_at: '2026-05-20' },
      { id: 112, name: 'Marcus Vance', email: 'm.vance@orion.org', state: 'CA', created_at: '2026-05-18' },
      { id: 139, name: 'Serah Chen', email: 'schen@quantum.com', state: 'CA', created_at: '2026-05-12' },
      { id: 152, name: 'Jared Leto', email: 'jleto@galaxy.net', state: 'CA', created_at: '2026-05-09' },
      { id: 188, name: 'Tasha Yar', email: 'tyar@starfleet.mil', state: 'CA', created_at: '2026-05-01' }
    ]
  },
  {
    keywords: ['product', 'top', 'sold', '2025', 'best'],
    sql: `SELECT p.product_id, p.name, SUM(o.quantity) as total_sold, SUM(o.total_price) as revenue \nFROM order_items o \nJOIN products p ON o.product_id = p.product_id \nWHERE o.order_date >= '2025-01-01' AND o.order_date <= '2025-12-31' \nGROUP BY p.product_id, p.name \nORDER BY total_sold DESC \nLIMIT 5;`,
    columns: ['product_id', 'name', 'total_sold', 'revenue'],
    rows: [
      { product_id: 'PRD-808', name: 'Hover Propulsion Module v4', total_sold: 1420, revenue: '$283,580.00' },
      { product_id: 'PRD-102', name: 'Quantum Core Reactor', total_sold: 980, revenue: '$1,460,200.00' },
      { product_id: 'PRD-441', name: 'Cybernetic Neural Link', total_sold: 840, revenue: '$335,160.00' },
      { product_id: 'PRD-009', name: 'Sub-space Receiver', total_sold: 720, revenue: '$71,928.00' },
      { product_id: 'PRD-773', name: 'Tachyon Containment Grid', total_sold: 450, revenue: '$899,550.00' }
    ]
  },
  {
    keywords: ['revenue', 'month', 'average'],
    sql: `SELECT DATE_TRUNC('month', order_date) as order_month, \n       ROUND(AVG(total_amount), 2) as avg_revenue, \n       COUNT(order_id) as total_orders \nFROM orders \nGROUP BY order_month \nORDER BY order_month DESC;`,
    columns: ['order_month', 'avg_revenue', 'total_orders'],
    rows: [
      { order_month: '2026-05 (Current)', avg_revenue: '$3,845.20', total_orders: 142 },
      { order_month: '2026-04', avg_revenue: '$4,102.50', total_orders: 198 },
      { order_month: '2026-03', avg_revenue: '$3,920.80', total_orders: 185 },
      { order_month: '2026-02', avg_revenue: '$3,780.00', total_orders: 160 },
      { order_month: '2026-01', avg_revenue: '$4,520.10', total_orders: 210 }
    ]
  },
  {
    keywords: ['count', 'register', 'week', 'new'],
    sql: `SELECT COUNT(*) as user_count \nFROM users \nWHERE created_at >= CURRENT_DATE - INTERVAL '7 days';`,
    columns: ['user_count'],
    rows: [
      { user_count: 87 }
    ]
  },
  {
    keywords: ['order', 'processing', 'status'],
    sql: `SELECT order_id, user_id, order_date, total_amount, status \nFROM orders \nWHERE status = 'processing' \nORDER BY order_date DESC;`,
    columns: ['order_id', 'user_id', 'order_date', 'total_amount', 'status'],
    rows: [
      { order_id: 'ORD-9988', user_id: 112, order_date: '2026-05-26', total_amount: '$149.99', status: 'processing' },
      { order_id: 'ORD-9985', user_id: 104, order_date: '2026-05-26', total_amount: '$1,299.00', status: 'processing' },
      { order_id: 'ORD-9972', user_id: 188, order_date: '2026-05-25', total_amount: '$45.50', status: 'processing' },
      { order_id: 'ORD-9951', user_id: 152, order_date: '2026-05-23', total_amount: '$312.00', status: 'processing' }
    ]
  }
];

// Helper to find match in mock responses
const findMockMatch = (queryText) => {
  const normalized = queryText.toLowerCase();
  for (const mock of MOCK_QUERIES) {
    if (mock.keywords.some(keyword => normalized.includes(keyword))) {
      return mock;
    }
  }
  
  // Generic fallback if no keyword matches
  return {
    sql: `SELECT * \nFROM database_records \nWHERE query_match = '${queryText.replace(/'/g, "''")}' \nLIMIT 10;`,
    columns: ['record_id', 'query_fragment', 'ai_match_score', 'timestamp', 'system_status'],
    rows: [
      { record_id: 1, query_fragment: queryText.length > 30 ? queryText.slice(0, 30) + '...' : queryText, ai_match_score: 0.94, timestamp: new Date().toISOString().split('T')[0], system_status: 'resolved' },
      { record_id: 2, query_fragment: 'Secondary structural lookup', ai_match_score: 0.81, timestamp: new Date().toISOString().split('T')[0], system_status: 'cached' }
    ]
  };
};

/**
 * Sends a natural language query to the AI SQL generation bridge.
 * If backend is offline, simulates backend execution with high-fidelity response.
 * @param {string} prompt The natural language query from the user.
 * @param {boolean} forceSimulation If true, skips trying to call the backend.
 */
export const generateSqlQuery = async (prompt, forceSimulation = false) => {
  if (forceSimulation) {
    return simulateApiCall(prompt);
  }

  try {
    const response = await api.post('/generate', { prompt });
    return {
      success: true,
      query: prompt,
      sql: response.data.sql,
      columns: response.data.columns || [],
      rows: response.data.rows || [],
      latency: response.data.latency || '285ms',
      tokensUsed: response.data.tokensUsed || 342,
      database: response.data.database || 'PostgreSQL (Ollama)',
      mode: 'live'
    };
  } catch (error) {
    console.warn('API error or connection refused. Falling back to Quantum Simulation Engine.', error);
    // Graceful fallback with simulated delay
    return simulateApiCall(prompt);
  }
};

const simulateApiCall = (prompt) => {
  return new Promise((resolve) => {
    const mock = findMockMatch(prompt);
    
    // Simulate typical network and LLM inference latency (800ms - 2500ms)
    const latencyMs = Math.floor(Math.random() * 1200) + 1000;
    
    setTimeout(() => {
      resolve({
        success: true,
        query: prompt,
        sql: mock.sql,
        columns: mock.columns,
        rows: mock.rows,
        latency: `${latencyMs}ms`,
        tokensUsed: Math.floor(Math.random() * 200) + 250,
        database: 'PostgreSQL 16 (Ollama Llama-3)',
        mode: 'simulated'
      });
    }, latencyMs);
  });
};
