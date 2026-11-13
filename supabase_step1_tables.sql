-- Step 1: Create all 5 tables
CREATE TABLE IF NOT EXISTS resqx_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS resqx_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES resqx_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  entity_id TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS resqx_incidents (
  id TEXT PRIMARY KEY,
  citizen_id TEXT,
  citizen_name TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL,
  priority_score DOUBLE PRECISION NOT NULL,
  patient_count INT DEFAULT 1,
  status TEXT NOT NULL,
  assigned_ambulance_id TEXT,
  assigned_hospital_id TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS resqx_radio_messages (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  sender TEXT NOT NULL,
  channel TEXT NOT NULL,
  message TEXT NOT NULL,
  ambulance_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resqx_audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  severity TEXT NOT NULL,
  actor TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
