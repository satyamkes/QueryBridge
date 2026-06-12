// QueryBridge AI SQL translation services and mock simulation config
import axios from 'axios';

// Load initial API base URL from localStorage or fallback to standard Flask local development port
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const AUTH_TOKEN_KEY = 'QUERYBRIDGE_AUTH_TOKEN';
const AUTH_USER_KEY = 'QUERYBRIDGE_AUTH_USER';
let apiBaseUrl = localStorage.getItem('QUERYBRIDGE_API_URL') || DEFAULT_API_URL;

export const getApiUrl = () => apiBaseUrl;

export const setApiUrl = (url) => {
  apiBaseUrl = url;
  api.defaults.baseURL = url;
  localStorage.setItem('QUERYBRIDGE_API_URL', url);
};

// Custom tables persistence (stored in localStorage) -------------------------------------------------
const CUSTOM_TABLES_KEY = 'QUERYBRIDGE_CUSTOM_TABLES';

const loadCustomTables = () => {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TABLES_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveCustomTables = (tables) => {
  localStorage.setItem(CUSTOM_TABLES_KEY, JSON.stringify(tables || []));
};

export const getCustomTables = () => loadCustomTables();

export const addCustomTable = (table) => {
  // table: { name: string, columns: string[], rows?: Array<object> }
  if (!table || !table.name || !Array.isArray(table.columns)) return false;
  const tables = loadCustomTables();
  const exists = tables.find(t => t.name.toLowerCase() === table.name.toLowerCase());
  if (exists) return false;
  tables.push({ name: table.name, columns: table.columns, rows: table.rows || [] });
  saveCustomTables(tables);
  return true;
};

export const removeCustomTable = (tableName) => {
  if (!tableName) return false;
  const tables = loadCustomTables();
  const filtered = tables.filter(t => t.name.toLowerCase() !== tableName.toLowerCase());
  saveCustomTables(filtered);
  return filtered.length !== tables.length;
};


// Create axios instance
const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getStoredAuth = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const rawUser = localStorage.getItem(AUTH_USER_KEY);
  if (!token || !rawUser) return null;

  try {
    return { token, user: JSON.parse(rawUser) };
  } catch {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
};

const persistAuth = ({ token, user }) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  return { token, user };
};

const authErrorMessage = (error, fallback) => {
  return error?.response?.data?.message || error?.response?.data?.error || fallback;
};

export const registerUser = async ({ name, email, password }) => {
  try {
    const response = await api.post('/auth/register', { name, email, password });
    return { success: true, ...persistAuth(response.data) };
  } catch (error) {
    return {
      success: false,
      error: authErrorMessage(error, 'Registration failed. Please try again.'),
    };
  }
};

export const loginUser = async ({ email, password }) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    return { success: true, ...persistAuth(response.data) };
  } catch (error) {
    return {
      success: false,
      error: authErrorMessage(error, 'Login failed. Please check your credentials.'),
    };
  }
};

export const fetchCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    const current = getStoredAuth();
    const auth = { token: current?.token, user: response.data.user };
    if (auth.token) persistAuth(auth);
    return { success: true, user: response.data.user };
  } catch (error) {
    logoutUser();
    return {
      success: false,
      error: authErrorMessage(error, 'Your session has expired. Please log in again.'),
    };
  }
};

export const logoutUser = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

// High-fidelity Mock responses for demonstration and offline mode
const MOCK_QUERIES = [
  {
    keywords: ['cse', 'computer', 'student', 'students', 'cgpa'],
    sql: `SELECT s.roll_no, s.name, p.name AS program, d.code AS branch, s.current_year, s.section, s.cgpa\nFROM students s\nJOIN programs p ON p.program_id = s.program_id\nJOIN departments d ON d.department_id = p.department_id\nWHERE d.code = 'CSE' AND s.cgpa >= 8.5\nORDER BY s.cgpa DESC\nLIMIT 100;`,
    columns: ['roll_no', 'name', 'program', 'branch', 'current_year', 'section', 'cgpa'],
    rows: [
      { roll_no: '22UCS002', name: 'Ishita Roy', program: 'Computer Science and Engineering', branch: 'CSE', current_year: 4, section: 'A', cgpa: 9.12 },
      { roll_no: '23UCS012', name: 'Ananya Deb', program: 'Computer Science and Engineering', branch: 'CSE', current_year: 3, section: 'B', cgpa: 8.94 },
      { roll_no: '22UCS001', name: 'Aarav Sharma', program: 'Computer Science and Engineering', branch: 'CSE', current_year: 4, section: 'A', cgpa: 8.82 },
      { roll_no: '24UCS022', name: 'Mitali Chakma', program: 'Computer Science and Engineering', branch: 'CSE', current_year: 2, section: 'A', cgpa: 8.67 }
    ]
  },
  {
    keywords: ['professor', 'faculty', 'hod', 'department'],
    sql: `SELECT d.code AS branch, d.name AS department, p.name, p.designation, p.specialization, p.office_room\nFROM professors p\nJOIN departments d ON d.department_id = p.department_id\nORDER BY d.code, p.designation DESC, p.name\nLIMIT 100;`,
    columns: ['branch', 'department', 'name', 'designation', 'specialization', 'office_room'],
    rows: [
      { branch: 'CSE', department: 'Computer Science and Engineering', name: 'Prof. Anirban Das', designation: 'Professor', specialization: 'Database Systems', office_room: 'CSE-201' },
      { branch: 'CSE', department: 'Computer Science and Engineering', name: 'Dr. Priyanka Sinha', designation: 'Associate Professor', specialization: 'Machine Learning', office_room: 'CSE-214' },
      { branch: 'ECE', department: 'Electronics and Communication Engineering', name: 'Prof. Meera Debbarma', designation: 'Professor', specialization: 'VLSI Design', office_room: 'ECE-301' },
      { branch: 'EE', department: 'Electrical Engineering', name: 'Prof. Rajat Sen', designation: 'Professor', specialization: 'Power Systems', office_room: 'EE-101' }
    ]
  },
  {
    keywords: ['result', 'results', 'marks', 'grade', 'exam'],
    sql: `SELECT s.roll_no, s.name, c.course_code, c.title, ex.exam_type, r.marks_obtained, ex.max_marks, r.grade\nFROM results r\nJOIN exams ex ON ex.exam_id = r.exam_id\nJOIN enrollments e ON e.enrollment_id = r.enrollment_id\nJOIN students s ON s.student_id = e.student_id\nJOIN class_sections cs ON cs.section_id = e.section_id\nJOIN courses c ON c.course_id = cs.course_id\nORDER BY s.roll_no, c.course_code, ex.exam_date\nLIMIT 100;`,
    columns: ['roll_no', 'name', 'course_code', 'title', 'exam_type', 'marks_obtained', 'max_marks', 'grade'],
    rows: [
      { roll_no: '22UCS001', name: 'Aarav Sharma', course_code: 'CS401', title: 'Machine Learning', exam_type: 'Mid Semester', marks_obtained: 24.6, max_marks: 30, grade: 'A' },
      { roll_no: '22UCS001', name: 'Aarav Sharma', course_code: 'CS401', title: 'Machine Learning', exam_type: 'End Semester', marks_obtained: 58.1, max_marks: 70, grade: 'A' },
      { roll_no: '22UCS002', name: 'Ishita Roy', course_code: 'CS401', title: 'Machine Learning', exam_type: 'Mid Semester', marks_obtained: 26.4, max_marks: 30, grade: 'A+' },
      { roll_no: '22UCS002', name: 'Ishita Roy', course_code: 'CS401', title: 'Machine Learning', exam_type: 'End Semester', marks_obtained: 61.6, max_marks: 70, grade: 'A+' }
    ]
  },
  {
    keywords: ['branch', 'branches', 'seat', 'seats', 'program'],
    sql: `SELECT d.code AS branch, d.name AS department, p.degree, p.name AS program, p.total_seats\nFROM programs p\nJOIN departments d ON d.department_id = p.department_id\nORDER BY d.code, p.degree;`,
    columns: ['branch', 'department', 'degree', 'program', 'total_seats'],
    rows: [
      { branch: 'CE', department: 'Civil Engineering', degree: 'B.Tech', program: 'Civil Engineering', total_seats: 90 },
      { branch: 'CSE', department: 'Computer Science and Engineering', degree: 'B.Tech', program: 'Computer Science and Engineering', total_seats: 120 },
      { branch: 'CSE', department: 'Computer Science and Engineering', degree: 'M.Tech', program: 'Data Science and Engineering', total_seats: 30 },
      { branch: 'ECE', department: 'Electronics and Communication Engineering', degree: 'B.Tech', program: 'Electronics and Communication Engineering', total_seats: 120 }
    ]
  },
  {
    keywords: ['attendance', 'section', 'course', 'courses'],
    sql: `SELECT s.roll_no, s.name, d.code AS branch, c.course_code, c.title, cs.section, e.attendance_percent\nFROM enrollments e\nJOIN students s ON s.student_id = e.student_id\nJOIN programs p ON p.program_id = s.program_id\nJOIN departments d ON d.department_id = p.department_id\nJOIN class_sections cs ON cs.section_id = e.section_id\nJOIN courses c ON c.course_id = cs.course_id\nORDER BY e.attendance_percent ASC\nLIMIT 100;`,
    columns: ['roll_no', 'name', 'branch', 'course_code', 'title', 'section', 'attendance_percent'],
    rows: [
      { roll_no: '23UEC013', name: 'Rohan Paul', branch: 'ECE', course_code: 'EC301', title: 'Digital Signal Processing', section: 'A', attendance_percent: 78.0 },
      { roll_no: '24UEE023', name: 'Tanmoy Biswas', branch: 'EE', course_code: 'EE301', title: 'Power Systems', section: 'A', attendance_percent: 79.0 },
      { roll_no: '22UME006', name: 'Arjun Tripathi', branch: 'ME', course_code: 'ME401', title: 'Robotics and Automation', section: 'B', attendance_percent: 81.0 },
      { roll_no: '23UCH018', name: 'Moumita Pal', branch: 'CHE', course_code: 'CH301', title: 'Chemical Reaction Engineering', section: 'A', attendance_percent: 82.0 }
    ]
  }
];

// Helper to find match in mock responses
const findMockMatch = (queryText) => {
  const normalized = queryText.toLowerCase();
  // Check user-defined custom tables first
  try {
    const customTables = loadCustomTables();
    for (const tbl of customTables) {
      const name = tbl.name.toLowerCase();
      if (normalized.includes(name) || (Array.isArray(tbl.columns) && tbl.columns.some(c => normalized.includes(c.toLowerCase())))) {
        const cols = Array.isArray(tbl.columns) && tbl.columns.length ? tbl.columns : ['*'];
        const sql = `SELECT ${cols.join(', ')}\nFROM ${tbl.name} \nLIMIT 10;`;
        const rows = (Array.isArray(tbl.rows) && tbl.rows.length) ? tbl.rows : [];
        return { keywords: [name, ...(tbl.columns || [])], sql, columns: cols, rows };
      }
    }
  } catch {
    // ignore and continue to built-in mocks
  }
  for (const mock of MOCK_QUERIES) {
    if (mock.keywords.some(keyword => normalized.includes(keyword))) {
      return mock;
    }
  }
  
  // Generic fallback if no keyword matches
  return {
    sql: `SELECT s.roll_no, s.name, d.code AS branch, s.current_year, s.section, s.cgpa\nFROM students s\nJOIN programs p ON p.program_id = s.program_id\nJOIN departments d ON d.department_id = p.department_id\nWHERE s.name ILIKE '%${queryText.replace(/'/g, "''")}%' OR d.name ILIKE '%${queryText.replace(/'/g, "''")}%' \nLIMIT 10;`,
    columns: ['roll_no', 'name', 'branch', 'current_year', 'section', 'cgpa'],
    rows: [
      { roll_no: '22UCS002', name: 'Ishita Roy', branch: 'CSE', current_year: 4, section: 'A', cgpa: 9.12 },
      { roll_no: '23UMC019', name: 'Trisha Mandal', branch: 'MNC', current_year: 3, section: 'B', cgpa: 9.04 }
    ]
  };
};

export const isQueryRelevant = (queryText) => {
  const normalized = queryText.trim().toLowerCase();
  if (normalized.length < 3) return false;

  // List of terms that indicate relevance to our database schema
  const schemaTerms = [
    'nit', 'nita', 'agartala', 'institute', 'campus',
    'department', 'departments', 'branch', 'branches', 'program', 'programs',
    'student', 'students', 'roll', 'section', 'year', 'cgpa', 'admission',
    'professor', 'professors', 'faculty', 'hod', 'designation', 'specialization',
    'course', 'courses', 'credit', 'semester', 'class',
    'exam', 'exams', 'result', 'results', 'marks', 'grade', 'attendance',
    'cse', 'ece', 'ee', 'me', 'ce', 'che', 'mnc', 'physics',
    'b.tech', 'btech', 'm.tech', 'mtech', 'count', 'average', 'avg', 'top', 'highest'
  ];

  if (schemaTerms.some(term => normalized.includes(term))) return true;

  // Also consider any user-added custom table names or columns relevant
  try {
    const custom = loadCustomTables();
    for (const tbl of custom) {
      if (normalized.includes(tbl.name.toLowerCase())) return true;
      if (Array.isArray(tbl.columns) && tbl.columns.some(c => normalized.includes(c.toLowerCase()))) return true;
    }
  } catch {
    // ignore errors and fall through
  }

  return false;
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

  // Pre-validate relevance before making network request to keep it snappy
  if (!isQueryRelevant(prompt)) {
    return simulateApiCall(prompt); // Will resolve to the invalid result
  }

  try {
    const response = await api.post('/generate', { prompt });
    if (response.data.error || response.data.success === false) {
      return {
        success: false,
        error: response.data.error || response.data.message || "Failed to generate SQL query.",
        query: prompt,
        sql: "",
        columns: [],
        rows: [],
        latency: response.data.latency || '120ms',
        tokensUsed: response.data.tokensUsed || 0,
        database: response.data.database || 'PostgreSQL (Ollama)',
        mode: 'live'
      };
    }
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
    if (error?.response?.status === 401) {
      logoutUser();
      return {
        success: false,
        error: 'Your session has expired. Please log in again.',
        query: prompt,
        sql: "",
        columns: [],
        rows: [],
        latency: '0ms',
        tokensUsed: 0,
        database: 'Authentication',
        mode: 'auth'
      };
    }
    console.warn('API error or connection refused. Falling back to Quantum Simulation Engine.', error);
    // Graceful fallback with simulated delay
    return simulateApiCall(prompt);
  }
};

const simulateApiCall = (prompt) => {
  return new Promise((resolve) => {
    const isRelevant = isQueryRelevant(prompt);
    
    // Simulate typical network and LLM inference latency (800ms - 2500ms)
    const latencyMs = Math.floor(Math.random() * 1200) + 1000;
    
    setTimeout(() => {
      if (!isRelevant) {
        resolve({
          success: false,
          error: "No matching institute tables or fields could be resolved from your query. Try asking about students, branches, professors, courses, exams, results, attendance, or NIT Agartala.",
          query: prompt,
          sql: "",
          columns: [],
          rows: [],
          latency: `${latencyMs}ms`,
          tokensUsed: 12,
          database: 'PostgreSQL 16 (Ollama Llama-3)',
          mode: 'simulated'
        });
      } else {
        const mock = findMockMatch(prompt);
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
      }
    }, latencyMs);
  });
};
