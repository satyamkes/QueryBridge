"""
QueryBridge – Database Layer
Handles PostgreSQL connections via psycopg2 and exposes helpers for
fetching schema metadata and seeding the institute dataset.
"""

import logging
from contextlib import contextmanager
from typing import Iterator

import psycopg2
import psycopg2.extras
from psycopg2 import pool

from config import Config

logger = logging.getLogger(__name__)

_pool: pool.SimpleConnectionPool | None = None


def _get_pool() -> pool.SimpleConnectionPool:
    """Return (and lazily create) the shared connection pool."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.SimpleConnectionPool(
            minconn=Config.PG_MIN_CONN,
            maxconn=Config.PG_MAX_CONN,
            host=Config.PG_HOST,
            port=Config.PG_PORT,
            dbname=Config.PG_DATABASE,
            user=Config.PG_USER,
            password=Config.PG_PASSWORD,
            sslmode=Config.PG_SSLMODE,
        )
        logger.info(
            "PostgreSQL pool created  →  %s:%s/%s",
            Config.PG_HOST,
            Config.PG_PORT,
            Config.PG_DATABASE,
        )
    return _pool


def get_db_connection() -> psycopg2.extensions.connection:
    """
    Borrow a connection from the pool.
    Caller MUST call close_db_connection(conn) when finished
    (typically in a finally block).
    """
    conn = _get_pool().getconn()
    conn.autocommit = True          
    return conn


def close_db_connection(conn: psycopg2.extensions.connection) -> None:
    """Return a borrowed connection back to the pool."""
    _get_pool().putconn(conn)


@contextmanager
def db_connection() -> Iterator[psycopg2.extensions.connection]:
    """
    Context manager for a pooled connection.
    Ensures every borrowed connection is returned to the pool.
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        close_db_connection(conn)



def fetch_schema_info(conn: psycopg2.extensions.connection) -> list[dict]:
    """
    Return metadata for every user-created table.

    Used by the GET /api/schema endpoint so the React Schema Sidebar can
    display live counts instead of hard-coded mock values.
    """
    tables = []

    # List all user tables in the public schema
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type   = 'BASE TABLE'
            ORDER BY table_name;
        """)
        table_names = [row[0] for row in cur.fetchall()]

    for table in table_names:
        # Row count estimate (fast; exact count is expensive on large tables)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT reltuples::bigint FROM pg_class WHERE relname = %s",
                (table,),
            )
            row = cur.fetchone()
            count = int(row[0]) if row else 0

        # Column list with PK/FK annotations
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    c.column_name,
                    CASE
                        WHEN pk.column_name IS NOT NULL THEN c.column_name || ' (PK)'
                        WHEN fk.column_name IS NOT NULL THEN c.column_name || ' (FK)'
                        ELSE c.column_name
                    END AS annotated
                FROM information_schema.columns c

                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                         ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                      AND tc.table_name = %s
                ) pk ON c.column_name = pk.column_name

                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                         ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_name = %s
                ) fk ON c.column_name = fk.column_name

                WHERE c.table_name   = %s
                  AND c.table_schema = 'public'
                ORDER BY c.ordinal_position;
            """, (table, table, table))
            columns = [row["annotated"] for row in cur.fetchall()]

        tables.append({"name": table, "count": count, "columns": columns})

    return tables


AUTH_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS auth_users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def init_auth_schema() -> None:
    """Create authentication tables if they do not exist."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(AUTH_SCHEMA_SQL)


SEED_SQL = """
-- Remove old demo commerce tables and prior institute seed tables.
-- auth_users is intentionally preserved.
DROP TABLE IF EXISTS results, enrollments, exams, class_sections, courses,
    students, professors, programs, departments, institutes,
    order_items, orders, products, users, student CASCADE;

-- Institute Core
CREATE TABLE institutes (
    institute_id SERIAL PRIMARY KEY,
    name VARCHAR(200) UNIQUE NOT NULL,
    short_name VARCHAR(40) UNIQUE NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    established_year INTEGER NOT NULL,
    institute_type VARCHAR(80) NOT NULL,
    website VARCHAR(200)
);

CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    institute_id INTEGER NOT NULL REFERENCES institutes(institute_id),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(180) NOT NULL,
    building VARCHAR(80) NOT NULL,
    hod_name VARCHAR(120) NOT NULL
);

CREATE TABLE programs (
    program_id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    degree VARCHAR(30) NOT NULL,
    name VARCHAR(180) NOT NULL,
    duration_years INTEGER NOT NULL,
    total_seats INTEGER NOT NULL
);

CREATE TABLE professors (
    professor_id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    name VARCHAR(120) NOT NULL,
    designation VARCHAR(80) NOT NULL,
    email VARCHAR(160) UNIQUE NOT NULL,
    specialization VARCHAR(180) NOT NULL,
    office_room VARCHAR(30) NOT NULL,
    joining_year INTEGER NOT NULL
);

CREATE TABLE students (
    student_id VARCHAR(20) PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES programs(program_id),
    roll_no VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    admission_year INTEGER NOT NULL,
    current_year INTEGER NOT NULL,
    section VARCHAR(5) NOT NULL,
    email VARCHAR(160) UNIQUE NOT NULL,
    cgpa NUMERIC(4, 2) NOT NULL
);

CREATE TABLE courses (
    course_id VARCHAR(20) PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    course_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(180) NOT NULL,
    credits INTEGER NOT NULL,
    semester INTEGER NOT NULL
);

CREATE TABLE class_sections (
    section_id SERIAL PRIMARY KEY,
    course_id VARCHAR(20) NOT NULL REFERENCES courses(course_id),
    professor_id INTEGER NOT NULL REFERENCES professors(professor_id),
    academic_year VARCHAR(9) NOT NULL,
    semester_type VARCHAR(20) NOT NULL,
    section VARCHAR(5) NOT NULL,
    room VARCHAR(30) NOT NULL,
    schedule VARCHAR(120) NOT NULL
);

CREATE TABLE enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id),
    section_id INTEGER NOT NULL REFERENCES class_sections(section_id),
    attendance_percent NUMERIC(5, 2) NOT NULL,
    UNIQUE(student_id, section_id)
);

CREATE TABLE exams (
    exam_id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES class_sections(section_id),
    exam_type VARCHAR(40) NOT NULL,
    exam_date DATE NOT NULL,
    max_marks INTEGER NOT NULL,
    weightage_percent INTEGER NOT NULL
);

CREATE TABLE results (
    result_id SERIAL PRIMARY KEY,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(enrollment_id),
    exam_id INTEGER NOT NULL REFERENCES exams(exam_id),
    marks_obtained NUMERIC(5, 2) NOT NULL,
    grade VARCHAR(3) NOT NULL,
    UNIQUE(enrollment_id, exam_id)
);

INSERT INTO institutes (name, short_name, city, state, established_year, institute_type, website) VALUES
('National Institute of Technology Agartala', 'NIT Agartala', 'Agartala', 'Tripura', 1965, 'Institute of National Importance', 'https://www.nita.ac.in');

INSERT INTO departments (institute_id, code, name, building, hod_name) VALUES
(1, 'CSE', 'Computer Science and Engineering', 'Aryabhatta Block', 'Prof. Anirban Das'),
(1, 'ECE', 'Electronics and Communication Engineering', 'C V Raman Block', 'Prof. Meera Debbarma'),
(1, 'EE', 'Electrical Engineering', 'Visvesvaraya Block', 'Prof. Rajat Sen'),
(1, 'ME', 'Mechanical Engineering', 'Workshop Complex', 'Prof. Tapan Chakraborty'),
(1, 'CE', 'Civil Engineering', 'Brahmaputra Block', 'Prof. Bimal Roy'),
(1, 'CHE', 'Chemical Engineering', 'Tagore Block', 'Prof. Nandita Saha'),
(1, 'MNC', 'Mathematics and Computing', 'Ramanujan Block', 'Prof. Arindam Nath'),
(1, 'PHY', 'Physics', 'Science Block', 'Prof. Subrata Paul');

INSERT INTO programs (department_id, degree, name, duration_years, total_seats) VALUES
(1, 'B.Tech', 'Computer Science and Engineering', 4, 120),
(2, 'B.Tech', 'Electronics and Communication Engineering', 4, 120),
(3, 'B.Tech', 'Electrical Engineering', 4, 90),
(4, 'B.Tech', 'Mechanical Engineering', 4, 90),
(5, 'B.Tech', 'Civil Engineering', 4, 90),
(6, 'B.Tech', 'Chemical Engineering', 4, 60),
(7, 'B.Tech', 'Mathematics and Computing', 4, 60),
(1, 'M.Tech', 'Data Science and Engineering', 2, 30);

INSERT INTO professors (department_id, name, designation, email, specialization, office_room, joining_year) VALUES
(1, 'Prof. Anirban Das', 'Professor', 'anirban.das@nita.ac.in', 'Database Systems', 'CSE-201', 2008),
(1, 'Dr. Priyanka Sinha', 'Associate Professor', 'priyanka.sinha@nita.ac.in', 'Machine Learning', 'CSE-214', 2014),
(1, 'Dr. Sourav Dey', 'Assistant Professor', 'sourav.dey@nita.ac.in', 'Computer Networks', 'CSE-109', 2019),
(2, 'Prof. Meera Debbarma', 'Professor', 'meera.debbarma@nita.ac.in', 'VLSI Design', 'ECE-301', 2006),
(2, 'Dr. Rakesh Tripura', 'Associate Professor', 'rakesh.tripura@nita.ac.in', 'Signal Processing', 'ECE-211', 2015),
(3, 'Prof. Rajat Sen', 'Professor', 'rajat.sen@nita.ac.in', 'Power Systems', 'EE-101', 2007),
(3, 'Dr. Aparna Ghosh', 'Assistant Professor', 'aparna.ghosh@nita.ac.in', 'Control Systems', 'EE-207', 2020),
(4, 'Prof. Tapan Chakraborty', 'Professor', 'tapan.chakraborty@nita.ac.in', 'Thermal Engineering', 'ME-301', 2005),
(4, 'Dr. Manish Paul', 'Associate Professor', 'manish.paul@nita.ac.in', 'Robotics', 'ME-118', 2016),
(5, 'Prof. Bimal Roy', 'Professor', 'bimal.roy@nita.ac.in', 'Structural Engineering', 'CE-205', 2009),
(5, 'Dr. Indrani Dasgupta', 'Assistant Professor', 'indrani.dasgupta@nita.ac.in', 'Transportation Engineering', 'CE-117', 2021),
(6, 'Prof. Nandita Saha', 'Professor', 'nandita.saha@nita.ac.in', 'Process Control', 'CHE-104', 2010),
(6, 'Dr. Abhijit Dutta', 'Assistant Professor', 'abhijit.dutta@nita.ac.in', 'Reaction Engineering', 'CHE-210', 2022),
(7, 'Prof. Arindam Nath', 'Professor', 'arindam.nath@nita.ac.in', 'Applied Mathematics', 'MNC-302', 2011),
(7, 'Dr. Kavita Sharma', 'Assistant Professor', 'kavita.sharma@nita.ac.in', 'Optimization', 'MNC-112', 2020),
(8, 'Prof. Subrata Paul', 'Professor', 'subrata.paul@nita.ac.in', 'Condensed Matter Physics', 'PHY-204', 2004);

INSERT INTO students (student_id, program_id, roll_no, name, gender, admission_year, current_year, section, email, cgpa) VALUES
('NITA-CSE-2022-001', 1, '22UCS001', 'Aarav Sharma', 'Male', 2022, 4, 'A', '22ucs001@nita.ac.in', 8.82),
('NITA-CSE-2022-002', 1, '22UCS002', 'Ishita Roy', 'Female', 2022, 4, 'A', '22ucs002@nita.ac.in', 9.12),
('NITA-CSE-2023-011', 1, '23UCS011', 'Ritwik Das', 'Male', 2023, 3, 'B', '23ucs011@nita.ac.in', 8.21),
('NITA-CSE-2023-012', 1, '23UCS012', 'Ananya Deb', 'Female', 2023, 3, 'B', '23ucs012@nita.ac.in', 8.94),
('NITA-CSE-2024-021', 1, '24UCS021', 'Kabir Sen', 'Male', 2024, 2, 'A', '24ucs021@nita.ac.in', 8.03),
('NITA-CSE-2024-022', 1, '24UCS022', 'Mitali Chakma', 'Female', 2024, 2, 'A', '24ucs022@nita.ac.in', 8.67),
('NITA-ECE-2022-003', 2, '22UEC003', 'Sagnik Saha', 'Male', 2022, 4, 'A', '22uec003@nita.ac.in', 8.44),
('NITA-ECE-2022-004', 2, '22UEC004', 'Poulomi Reang', 'Female', 2022, 4, 'A', '22uec004@nita.ac.in', 8.76),
('NITA-ECE-2023-013', 2, '23UEC013', 'Rohan Paul', 'Male', 2023, 3, 'B', '23uec013@nita.ac.in', 7.98),
('NITA-ECE-2023-014', 2, '23UEC014', 'Sneha Dutta', 'Female', 2023, 3, 'B', '23uec014@nita.ac.in', 8.58),
('NITA-EE-2022-005', 3, '22UEE005', 'Devang Mishra', 'Male', 2022, 4, 'A', '22uee005@nita.ac.in', 8.25),
('NITA-EE-2023-015', 3, '23UEE015', 'Nandini Nath', 'Female', 2023, 3, 'B', '23uee015@nita.ac.in', 8.71),
('NITA-EE-2024-023', 3, '24UEE023', 'Tanmoy Biswas', 'Male', 2024, 2, 'A', '24uee023@nita.ac.in', 7.84),
('NITA-ME-2022-006', 4, '22UME006', 'Arjun Tripathi', 'Male', 2022, 4, 'A', '22ume006@nita.ac.in', 8.10),
('NITA-ME-2023-016', 4, '23UME016', 'Riya Bhowmik', 'Female', 2023, 3, 'B', '23ume016@nita.ac.in', 8.36),
('NITA-ME-2024-024', 4, '24UME024', 'Pranay Kalita', 'Male', 2024, 2, 'A', '24ume024@nita.ac.in', 7.92),
('NITA-CE-2022-007', 5, '22UCE007', 'Ankit Roy', 'Male', 2022, 4, 'A', '22uce007@nita.ac.in', 8.01),
('NITA-CE-2023-017', 5, '23UCE017', 'Bidisha Das', 'Female', 2023, 3, 'B', '23uce017@nita.ac.in', 8.49),
('NITA-CE-2024-025', 5, '24UCE025', 'Soham Ghosh', 'Male', 2024, 2, 'A', '24uce025@nita.ac.in', 7.75),
('NITA-CHE-2022-008', 6, '22UCH008', 'Kunal Sinha', 'Male', 2022, 4, 'A', '22uch008@nita.ac.in', 8.31),
('NITA-CHE-2023-018', 6, '23UCH018', 'Moumita Pal', 'Female', 2023, 3, 'B', '23uch018@nita.ac.in', 8.63),
('NITA-CHE-2024-026', 6, '24UCH026', 'Rishav Debnath', 'Male', 2024, 2, 'A', '24uch026@nita.ac.in', 7.69),
('NITA-MNC-2022-009', 7, '22UMC009', 'Aditya Nair', 'Male', 2022, 4, 'A', '22umc009@nita.ac.in', 8.95),
('NITA-MNC-2023-019', 7, '23UMC019', 'Trisha Mandal', 'Female', 2023, 3, 'B', '23umc019@nita.ac.in', 9.04),
('NITA-MNC-2024-027', 7, '24UMC027', 'Sayan Bhattacharya', 'Male', 2024, 2, 'A', '24umc027@nita.ac.in', 8.22),
('NITA-MTD-2025-001', 8, '25MDS001', 'Neha Agarwal', 'Female', 2025, 1, 'A', '25mds001@nita.ac.in', 8.91),
('NITA-MTD-2025-002', 8, '25MDS002', 'Abhishek Kumar', 'Male', 2025, 1, 'A', '25mds002@nita.ac.in', 8.48);

INSERT INTO courses (course_id, department_id, course_code, title, credits, semester) VALUES
('CSE301', 1, 'CS301', 'Database Management Systems', 4, 5),
('CSE302', 1, 'CS302', 'Operating Systems', 4, 5),
('CSE401', 1, 'CS401', 'Machine Learning', 4, 7),
('CSE501', 1, 'CS501', 'Advanced Data Engineering', 3, 1),
('ECE301', 2, 'EC301', 'Digital Signal Processing', 4, 5),
('ECE401', 2, 'EC401', 'VLSI Design', 4, 7),
('EE301', 3, 'EE301', 'Power Systems', 4, 5),
('EE401', 3, 'EE401', 'Control Systems', 4, 7),
('ME301', 4, 'ME301', 'Thermodynamics', 4, 5),
('ME401', 4, 'ME401', 'Robotics and Automation', 4, 7),
('CE301', 5, 'CE301', 'Structural Analysis', 4, 5),
('CE401', 5, 'CE401', 'Transportation Engineering', 4, 7),
('CHE301', 6, 'CH301', 'Chemical Reaction Engineering', 4, 5),
('CHE401', 6, 'CH401', 'Process Control', 4, 7),
('MNC301', 7, 'MC301', 'Optimization Techniques', 4, 5),
('MNC401', 7, 'MC401', 'Numerical Methods', 4, 7);

INSERT INTO class_sections (course_id, professor_id, academic_year, semester_type, section, room, schedule) VALUES
('CSE301', 1, '2025-2026', 'Odd', 'A', 'CSE-LT1', 'Mon/Wed/Fri 10:00'),
('CSE302', 3, '2025-2026', 'Odd', 'B', 'CSE-LT2', 'Tue/Thu 11:00'),
('CSE401', 2, '2025-2026', 'Odd', 'A', 'CSE-Lab1', 'Mon/Wed 14:00'),
('CSE501', 2, '2025-2026', 'Odd', 'A', 'CSE-Seminar', 'Fri 15:00'),
('ECE301', 5, '2025-2026', 'Odd', 'A', 'ECE-LT1', 'Mon/Wed 09:00'),
('ECE401', 4, '2025-2026', 'Odd', 'B', 'ECE-Lab2', 'Tue/Thu 14:00'),
('EE301', 6, '2025-2026', 'Odd', 'A', 'EE-LT1', 'Mon/Wed 11:00'),
('EE401', 7, '2025-2026', 'Odd', 'B', 'EE-Lab1', 'Tue/Thu 15:00'),
('ME301', 8, '2025-2026', 'Odd', 'A', 'ME-LT1', 'Mon/Wed 12:00'),
('ME401', 9, '2025-2026', 'Odd', 'B', 'ME-Lab2', 'Tue/Thu 10:00'),
('CE301', 10, '2025-2026', 'Odd', 'A', 'CE-LT1', 'Mon/Wed 13:00'),
('CE401', 11, '2025-2026', 'Odd', 'B', 'CE-Lab1', 'Tue/Thu 12:00'),
('CHE301', 13, '2025-2026', 'Odd', 'A', 'CHE-LT1', 'Mon/Wed 15:00'),
('CHE401', 12, '2025-2026', 'Odd', 'B', 'CHE-Lab1', 'Tue/Thu 09:00'),
('MNC301', 15, '2025-2026', 'Odd', 'A', 'MNC-LT1', 'Mon/Wed 16:00'),
('MNC401', 14, '2025-2026', 'Odd', 'B', 'MNC-Lab1', 'Tue/Thu 13:00');

INSERT INTO enrollments (student_id, section_id, attendance_percent)
SELECT s.student_id, cs.section_id,
       78 + ((ascii(right(s.student_id, 1)) + cs.section_id) % 20)
FROM students s
JOIN programs p ON p.program_id = s.program_id
JOIN courses c ON c.department_id = p.department_id
JOIN class_sections cs ON cs.course_id = c.course_id
WHERE (s.current_year = 4 AND c.semester = 7)
   OR (s.current_year = 3 AND c.semester = 5)
   OR (s.current_year = 1 AND c.course_id = 'CSE501');

INSERT INTO exams (section_id, exam_type, exam_date, max_marks, weightage_percent)
SELECT section_id, 'Mid Semester', DATE '2025-09-20' + (section_id % 8), 30, 30
FROM class_sections
UNION ALL
SELECT section_id, 'End Semester', DATE '2025-12-05' + (section_id % 8), 70, 70
FROM class_sections;

INSERT INTO results (enrollment_id, exam_id, marks_obtained, grade)
SELECT e.enrollment_id,
       ex.exam_id,
       ROUND((ex.max_marks * (0.62 + (((e.enrollment_id + ex.exam_id) % 28) / 100.0)))::numeric, 2) AS marks_obtained,
       CASE
           WHEN (0.62 + (((e.enrollment_id + ex.exam_id) % 28) / 100.0)) >= 0.88 THEN 'A+'
           WHEN (0.62 + (((e.enrollment_id + ex.exam_id) % 28) / 100.0)) >= 0.80 THEN 'A'
           WHEN (0.62 + (((e.enrollment_id + ex.exam_id) % 28) / 100.0)) >= 0.72 THEN 'B+'
           WHEN (0.62 + (((e.enrollment_id + ex.exam_id) % 28) / 100.0)) >= 0.65 THEN 'B'
           ELSE 'C'
       END AS grade
FROM enrollments e
JOIN exams ex ON ex.section_id = e.section_id;
"""


def seed_database() -> None:
    """
    Rebuild the institute dataset.
    Authentication users are kept, but old demo tables are removed.
    Run via:  python db.py
    """
    with db_connection() as conn:
        try:
            # Temporarily disable autocommit so we can run a multi-statement block
            conn.autocommit = False
            with conn.cursor() as cur:
                cur.execute(SEED_SQL)
            conn.commit()
            logger.info("Database seeded successfully.")
        except Exception as exc:
            conn.rollback()
            logger.error("Seeding failed: %s", exc)
            raise
        finally:
            conn.autocommit = True


if __name__ == "__main__":
    seed_database()
