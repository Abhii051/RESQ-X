// RESQ-X Hybrid Database & Authentication Engine
// Supports Supabase Cloud (PostgreSQL) + Node.js 24 embedded SQLite
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  isSupabaseConfigured,
  getSupabaseStatus,
  supabaseInsertUser,
  supabaseInsertSession,
  supabaseInsertIncident,
  supabaseInsertRadio
} from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = process.env.VERCEL ? path.join('/tmp', 'resqx-data') : path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'resqx.db');

try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("[Database] Dir init warning:", e.message);
}

let db = null;

export function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function generateToken() {
  return 'resqx_' + crypto.randomBytes(32).toString('hex');
}

export function initDatabase() {
  if (db) return db;

  try {
    db = new DatabaseSync(DB_PATH);
  } catch (err) {
    console.warn("[Database] DatabaseSync file error, falling back to in-memory:", err.message);
    try {
      db = new DatabaseSync(':memory:');
    } catch (e2) {
      console.error("[Database] SQLite initialization failed:", e2.message);
      return null;
    }
  }

  // WAL mode for concurrency
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
  } catch (e) {
    console.warn("[Database] Pragma warning:", e.message);
  }

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL, -- citizen | ambulance | hospital | command
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      entity_id TEXT, -- e.g. 'amb-01' or 'hosp-01'
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      entity_id TEXT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      citizen_id TEXT,
      citizen_name TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      severity TEXT NOT NULL,
      priority_score REAL NOT NULL,
      patient_count INTEGER DEFAULT 1,
      status TEXT NOT NULL,
      assigned_ambulance_id TEXT,
      assigned_hospital_id TEXT,
      reported_at TEXT NOT NULL,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS radio_messages (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      sender TEXT NOT NULL,
      channel TEXT NOT NULL,
      message TEXT NOT NULL,
      ambulance_id TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT,
      severity TEXT NOT NULL,
      actor TEXT,
      details_json TEXT
    );
  `);

  // Check if initial users exist, if not pre-seed
  const countRow = db.prepare("SELECT COUNT(*) as count FROM users").get();
  if (countRow.count === 0) {
    seedInitialUsers();
  }

  console.log(`[Database] SQLite connected successfully at: ${DB_PATH} (${countRow.count} users configured)`);
  return db;
}

function insertUser({ id, username, password, role, name, email, phone, entity_id = null, metadata = {} }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, password_salt, role, name, email, phone, entity_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, username.toLowerCase(), hash, salt, role, name, email, phone, entity_id, JSON.stringify(metadata), now);

  // Sync with Supabase if connected
  if (isSupabaseConfigured()) {
    supabaseInsertUser({
      id, username: username.toLowerCase(), password_hash: hash, password_salt: salt, role, name, email, phone, entity_id, metadata, created_at: now
    }).catch(() => {});
  }
}

function seedInitialUsers() {
  console.log("[Database] Seeding default credentials for Citizens, Ambulances, Hospitals, and Command...");

  // 1. Citizens
  insertUser({
    id: 'cit-01',
    username: 'citizen_rahul',
    password: 'citizen123',
    role: 'citizen',
    name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul.sharma@example.com',
    metadata: {
      blood_group: 'O+',
      allergies: 'Penicillin',
      address: 'Madhapur Near Cyber Towers',
      emergency_contact_name: 'Anjali Sharma (Spouse)',
      emergency_contact_phone: '+91 9876543211'
    }
  });

  insertUser({
    id: 'cit-02',
    username: 'citizen_priya',
    password: 'citizen123',
    role: 'citizen',
    name: 'Priya Reddy',
    phone: '9848022338',
    email: 'priya.reddy@example.com',
    metadata: {
      blood_group: 'B+',
      allergies: 'None',
      address: 'Road No. 12, Banjara Hills',
      emergency_contact_name: 'Vikram Reddy (Brother)',
      emergency_contact_phone: '+91 9848022339'
    }
  });

  insertUser({
    id: 'cit-03',
    username: 'citizen_arun',
    password: 'citizen123',
    role: 'citizen',
    name: 'Arun Verma',
    phone: '9811223344',
    email: 'arun.verma@example.com',
    metadata: {
      blood_group: 'A+',
      allergies: 'Sulfa Drugs',
      address: 'Kukatpally Housing Board',
      emergency_contact_name: 'Kavita Verma (Wife)',
      emergency_contact_phone: '+91 9811223345'
    }
  });

  // 2. Ambulances (All 10 fleet units)
  const ambulanceUnits = [
    { id: 'amb-01', code: 'RESQ-A01', type: 'ALS', driver: 'Suresh Kumar', paramedic: 'Dr. Anita Desai' },
    { id: 'amb-02', code: 'RESQ-A02', type: 'BLS', driver: 'K. Venu', paramedic: 'Nurse Ravi Teja' },
    { id: 'amb-03', code: 'RESQ-A03', type: 'ALS', driver: 'Md. Imran', paramedic: 'Dr. John Mathew' },
    { id: 'amb-04', code: 'RESQ-A04', type: 'BLS', driver: 'Rajesh G.', paramedic: 'Nurse Lakshmi' },
    { id: 'amb-05', code: 'RESQ-A05', type: 'ALS', driver: 'Balaji P.', paramedic: 'Dr. Swathi K.' },
    { id: 'amb-06', code: 'RESQ-A06', type: 'BLS', driver: 'Anand M.', paramedic: 'Nurse Deepa' },
    { id: 'amb-07', code: 'RESQ-A07', type: 'ALS', driver: 'Shiva K.', paramedic: 'Dr. Farooq Khan' },
    { id: 'amb-08', code: 'RESQ-A08', type: 'BLS', driver: 'Naveen B.', paramedic: 'Nurse Sunita' },
    { id: 'amb-09', code: 'RESQ-A09', type: 'ALS', driver: 'Ramesh T.', paramedic: 'Dr. Karthik S.' },
    { id: 'amb-10', code: 'RESQ-A10', type: 'BLS', driver: 'Sai Teja', paramedic: 'Nurse Divya P.' },
  ];

  ambulanceUnits.forEach((amb, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    insertUser({
      id: `usr-amb-${num}`,
      username: `paramedic_a${num}`,
      password: 'amb123',
      role: 'ambulance',
      name: `Paramedic Unit ${amb.code}`,
      phone: `+91 99001000${num}`,
      email: `${amb.code.toLowerCase()}@resqx.hyd.gov.in`,
      entity_id: amb.id,
      metadata: {
        unit_code: amb.code,
        ambulance_id: amb.id,
        ambulance_type: amb.type,
        driver_name: amb.driver,
        paramedic_name: amb.paramedic,
        badge_number: `EMR-HYD-77${num}`,
        station: 'Hyderabad Municipal Fleet Dispatch'
      }
    });
  });

  // 3. Hospitals (All 5 key centers)
  const hospitalCenters = [
    { id: 'hosp-01', code: 'osmania', name: 'Osmania General Hospital', zone: 'Koti Central', mo: 'Dr. Venkat Rao', trauma: 'Level 1' },
    { id: 'hosp-02', code: 'gandhi', name: 'Gandhi Hospital', zone: 'Secunderabad Junction', mo: 'Dr. Sunitha Reddy', trauma: 'Level 1' },
    { id: 'hosp-03', code: 'nims', name: 'Nizam\'s Institute of Medical Sciences (NIMS)', zone: 'Ameerpet Transit Hub', mo: 'Dr. Prakash Narayana', trauma: 'Level 2' },
    { id: 'hosp-04', code: 'care', name: 'Care Hospital Banjara', zone: 'Banjara Hills', mo: 'Dr. Arvind Mehra', trauma: 'Level 2' },
    { id: 'hosp-05', code: 'continental', name: 'Continental Hospital Gachibowli', zone: 'Gachibowli Tech Park', mo: 'Dr. Shalini Prasad', trauma: 'Level 1' }
  ];

  hospitalCenters.forEach((hosp) => {
    insertUser({
      id: `usr-${hosp.id}`,
      username: `hosp_${hosp.code}`,
      password: 'hosp123',
      role: 'hospital',
      name: `${hosp.name} ER Desk`,
      phone: '+91 040-24600121',
      email: `er@${hosp.code}.hyd.gov.in`,
      entity_id: hosp.id,
      metadata: {
        hospital_id: hosp.id,
        hospital_name: hosp.name,
        zone_location: hosp.zone,
        medical_officer: hosp.mo,
        trauma_certification: hosp.trauma,
        emergency_desk_phone: '+91 040-24600121'
      }
    });
  });

  // 4. Command Centre Dispatchers / Admins
  insertUser({
    id: 'usr-cmd-01',
    username: 'command_admin',
    password: 'admin123',
    role: 'command',
    name: 'Municipal Emergency Director Rao',
    phone: '+91 9440001122',
    email: 'director@resqx.hyd.gov.in',
    entity_id: 'cmd-hq',
    metadata: {
      clearance_level: 'Master Operator (Level 5)',
      department: 'Greater Hyderabad Municipal Emergency Response (GHMC & Police 108)'
    }
  });

  insertUser({
    id: 'usr-cmd-02',
    username: 'dispatcher_hyd',
    password: 'dispatch123',
    role: 'command',
    name: 'Senior Dispatcher Fatima',
    phone: '+91 9440003344',
    email: 'dispatch1@resqx.hyd.gov.in',
    entity_id: 'cmd-cad',
    metadata: {
      clearance_level: 'CAD Dispatcher (Level 3)',
      department: 'Central Emergency CAD Desk'
    }
  });

  console.log("[Database] Pre-seeding completed with 20 role accounts.");
}

// ---------------- AUTH METHODS ----------------

export function registerCitizen({ username, password, name, phone, email, blood_group = 'Unknown', allergies = 'None', address = '', emergency_contact_name = '', emergency_contact_phone = '' }) {
  if (!username || !password || !name) {
    throw new Error("Username, password, and full name are required");
  }

  const cleanUser = username.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(cleanUser);
  if (existing) {
    throw new Error("Username already taken. Please choose another username or log in.");
  }

  const id = `cit-${Date.now().toString(36)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const now = new Date().toISOString();

  const metadata = {
    blood_group,
    allergies,
    address,
    emergency_contact_name,
    emergency_contact_phone
  };

  db.prepare(`
    INSERT INTO users (id, username, password_hash, password_salt, role, name, email, phone, entity_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, 'citizen', ?, ?, ?, ?, ?, ?)
  `).run(id, cleanUser, hash, salt, name, email || '', phone || '', id, JSON.stringify(metadata), now);

  if (isSupabaseConfigured()) {
    supabaseInsertUser({
      id, username: cleanUser, password_hash: hash, password_salt: salt, role: 'citizen', name, email, phone, entity_id: id, metadata, created_at: now
    }).catch(() => {});
  }

  const user = sanitizeUser(getUserById(id));
  const session = createSession(user);
  return { user, token: session.token };
}

export function authenticateUser({ username, password, role }) {
  if (!username || !password) {
    throw new Error("Username and password are required");
  }

  const cleanUser = username.trim().toLowerCase();
  let query = "SELECT * FROM users WHERE username = ?";
  const params = [cleanUser];

  if (role) {
    query += " AND role = ?";
    params.push(role);
  }

  const user = db.prepare(query).get(...params);
  if (!user) {
    throw new Error(`Invalid credentials or user not authorized for role '${role || 'any'}'.`);
  }

  const computedHash = hashPassword(password, user.password_salt);
  if (computedHash !== user.password_hash) {
    throw new Error("Invalid username or password.");
  }

  // Update last login
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, user.id);

  const cleanUserObj = sanitizeUser(user);
  const session = createSession(cleanUserObj);
  return { user: cleanUserObj, token: session.token };
}

export function createSession(user) {
  const token = generateToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, role, entity_id, name, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(token, user.id, user.role, user.entity_id || null, user.name, now.toISOString(), expires.toISOString());

  return { token, expires_at: expires.toISOString() };
}

export function verifySession(token) {
  if (!token) return null;
  const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  const user = getUserById(session.user_id);
  if (!user) return null;

  return { session, user: sanitizeUser(user) };
}

export function revokeSession(token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function sanitizeUser(user) {
  if (!user) return null;
  let metadata = {};
  try {
    metadata = user.metadata_json ? JSON.parse(user.metadata_json) : {};
  } catch (e) {
    metadata = {};
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    entity_id: user.entity_id,
    metadata,
    created_at: user.created_at,
    last_login_at: user.last_login_at
  };
}

export function getDemoUsers() {
  const all = db.prepare("SELECT id, username, role, name, entity_id, metadata_json FROM users").all();
  return all.map(u => {
    let meta = {};
    try { meta = JSON.parse(u.metadata_json); } catch(e) {}
    let defaultPass = 'citizen123';
    if (u.role === 'ambulance') defaultPass = 'amb123';
    if (u.role === 'hospital') defaultPass = 'hosp123';
    if (u.role === 'command') defaultPass = 'admin123';

    return {
      id: u.id,
      username: u.username,
      role: u.role,
      name: u.name,
      entity_id: u.entity_id,
      metadata: meta,
      defaultPass
    };
  });
}

// ---------------- PERSISTENT DATA METHODS ----------------

export function saveIncidentRecord(incident, citizenId = null, citizenName = null) {
  try {
    const existing = db.prepare("SELECT id FROM incidents WHERE id = ?").get(incident.id);
    const now = new Date().toISOString();
    const payload = JSON.stringify(incident);

    if (existing) {
      db.prepare(`
        UPDATE incidents
        SET status = ?, assigned_ambulance_id = ?, assigned_hospital_id = ?, payload_json = ?
        WHERE id = ?
      `).run(incident.status, incident.assigned_ambulance_id || null, incident.assigned_hospital_id || null, payload, incident.id);
    } else {
      db.prepare(`
        INSERT INTO incidents (id, citizen_id, citizen_name, category, title, zone_id, lat, lng, severity, priority_score, patient_count, status, assigned_ambulance_id, assigned_hospital_id, reported_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        incident.id,
        citizenId || null,
        citizenName || null,
        incident.category,
        incident.title,
        incident.zone_id,
        incident.lat,
        incident.lng,
        incident.severity,
        incident.priority_score,
        incident.affected_count || 1,
        incident.status,
        incident.assigned_ambulance_id || null,
        incident.assigned_hospital_id || null,
        now,
        payload
      );
    }

    if (isSupabaseConfigured()) {
      supabaseInsertIncident(incident, citizenId, citizenName).catch(() => {});
    }
  } catch (err) {
    console.error("[Database] Failed to save incident:", err.message);
  }
}

export function getIncidentHistory(citizenId = null) {
  try {
    let rows;
    if (citizenId) {
      rows = db.prepare("SELECT * FROM incidents WHERE citizen_id = ? ORDER BY reported_at DESC LIMIT 50").all(citizenId);
    } else {
      rows = db.prepare("SELECT * FROM incidents ORDER BY reported_at DESC LIMIT 50").all();
    }
    return rows.map(r => {
      let p = {};
      try { p = JSON.parse(r.payload_json); } catch (e) {}
      return { ...r, ...p, db_id: r.id };
    });
  } catch (e) {
    return [];
  }
}

export function saveRadioMessage({ sender, channel, message, ambulance_id = null }) {
  try {
    const id = `rad-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    db.prepare(`
      INSERT INTO radio_messages (id, timestamp, sender, channel, message, ambulance_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, now, sender, channel, message, ambulance_id);
    const record = { id, timestamp: now, sender, channel, message, ambulance_id };
    if (isSupabaseConfigured()) {
      supabaseInsertRadio(record).catch(() => {});
    }
    return record;
  } catch (e) {
    console.error("[Database] Failed to save radio message:", e.message);
    return null;
  }
}

export function getRadioMessages(ambulanceId = null) {
  try {
    if (ambulanceId) {
      return db.prepare("SELECT * FROM radio_messages WHERE ambulance_id = ? OR ambulance_id IS NULL ORDER BY rowid DESC LIMIT 40").all(ambulanceId).reverse();
    }
    return db.prepare("SELECT * FROM radio_messages ORDER BY rowid DESC LIMIT 40").all().reverse();
  } catch (e) {
    return [];
  }
}

export function getDatabaseStats() {
  const supabaseInfo = getSupabaseStatus();

  try {
    const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    const sessionCount = db.prepare("SELECT COUNT(*) as c FROM sessions").get().c;
    const incidentCount = db.prepare("SELECT COUNT(*) as c FROM incidents").get().c;
    const radioCount = db.prepare("SELECT COUNT(*) as c FROM radio_messages").get().c;

    let fileSize = 0;
    if (fs.existsSync(DB_PATH)) {
      fileSize = fs.statSync(DB_PATH).size;
    }

    return {
      engine: supabaseInfo.configured ? 'Supabase Cloud PostgreSQL' : 'Supabase + SQLite Dual-Engine',
      provider: supabaseInfo.configured ? 'Supabase Cloud (PostgreSQL)' : 'Supabase Ready (Standby)',
      supabase: supabaseInfo,
      db_file: DB_PATH,
      file_size_bytes: fileSize,
      file_size_formatted: `${(fileSize / 1024).toFixed(1)} KB`,
      tables: {
        users: userCount,
        sessions: sessionCount,
        incidents: incidentCount,
        radio_messages: radioCount
      },
      status: supabaseInfo.configured ? 'Supabase Cloud Active' : 'Supabase Ready (Awaiting URL & Key)',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      engine: 'Supabase Cloud + Local Engine',
      supabase: supabaseInfo,
      status: 'Error: ' + err.message
    };
  }
}
