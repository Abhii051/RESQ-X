-- =========================================================================
-- RESQ-X Complete Supabase PostgreSQL Schema & Initial Dataset
-- Problem Statement 10: Predictive Emergency Intelligence for Hyderabad Metro
-- =========================================================================

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS resqx_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL, -- 'citizen' | 'ambulance' | 'hospital' | 'command'
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  entity_id TEXT, -- e.g. 'amb-01' or 'hosp-01'
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

-- 2. Enable Row Level Security (RLS) & Public Policies for Demo
ALTER TABLE resqx_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_radio_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write access for demo network clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'resqx_users' AND policyname = 'Public Access Users') THEN
    CREATE POLICY "Public Access Users" ON resqx_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'resqx_sessions' AND policyname = 'Public Access Sessions') THEN
    CREATE POLICY "Public Access Sessions" ON resqx_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'resqx_incidents' AND policyname = 'Public Access Incidents') THEN
    CREATE POLICY "Public Access Incidents" ON resqx_incidents FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'resqx_radio_messages' AND policyname = 'Public Access Radio') THEN
    CREATE POLICY "Public Access Radio" ON resqx_radio_messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'resqx_audit_logs' AND policyname = 'Public Access Audit') THEN
    CREATE POLICY "Public Access Audit" ON resqx_audit_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3. Initial Pre-Seeded Accounts (Password: citizen123 / amb123 / hosp123 / admin123)
-- Citizens
INSERT INTO resqx_users (id, username, password_hash, password_salt, role, name, phone, email, metadata)
VALUES
  ('cit-01', 'citizen_rahul', '0c9fa733d719cb07b22d1ce7ad9c10444371bfabff29505ba1adcbdd6f9f984fe7c92b23bc978ae2c48da84fa17a3a83021469e34d66762334f5aa1a018b3e83', 'ec79e9d62da0d93edc67e2f096939d7f', 'citizen', 'Rahul Sharma', '9876543210', 'rahul.sharma@example.com', '{"blood_group": "O+", "allergies": "Penicillin", "emergency_contact_phone": "+91 9876543211"}'::jsonb),
  ('cit-02', 'citizen_priya', '0c9fa733d719cb07b22d1ce7ad9c10444371bfabff29505ba1adcbdd6f9f984fe7c92b23bc978ae2c48da84fa17a3a83021469e34d66762334f5aa1a018b3e83', 'ec79e9d62da0d93edc67e2f096939d7f', 'citizen', 'Priya Reddy', '9848022338', 'priya.reddy@example.com', '{"blood_group": "B+", "allergies": "None", "emergency_contact_phone": "+91 9848022339"}'::jsonb)
ON CONFLICT (username) DO NOTHING;

-- Ambulances (RESQ-A01 to RESQ-A10)
INSERT INTO resqx_users (id, username, password_hash, password_salt, role, name, phone, entity_id, metadata)
VALUES
  ('usr-amb-01', 'paramedic_a01', 'd32d0d0c35fa7c07da3382ba1e988229ef5e0eebf1f33ee6ae78a8be1cf305d2146051515ee0ce6bb855272a5a0cb08ad0d1e34ff051da009dcf982ea255e143', 'ec79e9d62da0d93edc67e2f096939d7f', 'ambulance', 'Paramedic Unit RESQ-A01', '+91 9900100001', 'amb-01', '{"unit_code": "RESQ-A01", "ambulance_type": "ALS", "driver_name": "Suresh Kumar", "paramedic_name": "Dr. Anita Desai", "badge_number": "EMR-HYD-7701"}'::jsonb),
  ('usr-amb-02', 'paramedic_a02', 'd32d0d0c35fa7c07da3382ba1e988229ef5e0eebf1f33ee6ae78a8be1cf305d2146051515ee0ce6bb855272a5a0cb08ad0d1e34ff051da009dcf982ea255e143', 'ec79e9d62da0d93edc67e2f096939d7f', 'ambulance', 'Paramedic Unit RESQ-A02', '+91 9900100002', 'amb-02', '{"unit_code": "RESQ-A02", "ambulance_type": "BLS", "driver_name": "K. Venu", "paramedic_name": "Nurse Ravi Teja", "badge_number": "EMR-HYD-7702"}'::jsonb),
  ('usr-amb-03', 'paramedic_a03', 'd32d0d0c35fa7c07da3382ba1e988229ef5e0eebf1f33ee6ae78a8be1cf305d2146051515ee0ce6bb855272a5a0cb08ad0d1e34ff051da009dcf982ea255e143', 'ec79e9d62da0d93edc67e2f096939d7f', 'ambulance', 'Paramedic Unit RESQ-A03', '+91 9900100003', 'amb-03', '{"unit_code": "RESQ-A03", "ambulance_type": "ALS", "driver_name": "Md. Imran", "paramedic_name": "Dr. John Mathew", "badge_number": "EMR-HYD-7703"}'::jsonb)
ON CONFLICT (username) DO NOTHING;

-- Hospitals
INSERT INTO resqx_users (id, username, password_hash, password_salt, role, name, phone, entity_id, metadata)
VALUES
  ('usr-hosp-01', 'hosp_osmania', '66504a58f79fbc38b80983ad2e95a94747ebafbe8ce7c3f3e1a0ad05504746f34e9e49c7161b96d991b5853767f40778c430e71c9fa6a836da8a50c8e312a0f8', 'ec79e9d62da0d93edc67e2f096939d7f', 'hospital', 'Osmania General Hospital ER Desk', '+91 040-24600121', 'hosp-01', '{"hospital_name": "Osmania General Hospital", "trauma_certification": "Level 1", "medical_officer": "Dr. Venkat Rao"}'::jsonb),
  ('usr-hosp-02', 'hosp_gandhi', '66504a58f79fbc38b80983ad2e95a94747ebafbe8ce7c3f3e1a0ad05504746f34e9e49c7161b96d991b5853767f40778c430e71c9fa6a836da8a50c8e312a0f8', 'ec79e9d62da0d93edc67e2f096939d7f', 'hospital', 'Gandhi Hospital ED Desk', '+91 040-27505566', 'hosp-02', '{"hospital_name": "Gandhi Hospital", "trauma_certification": "Level 1", "medical_officer": "Dr. Sunitha Reddy"}'::jsonb)
ON CONFLICT (username) DO NOTHING;

-- Command Dispatcher
INSERT INTO resqx_users (id, username, password_hash, password_salt, role, name, phone, entity_id, metadata)
VALUES
  ('usr-cmd-01', 'command_admin', '8b4566738b556942858444a7f0535cb854a01c4dc1b8ef05d15ca31a473a24681676d123284beff5062828b438bf2281ab669be740e53ef711b7147a2408b8b3', 'ec79e9d62da0d93edc67e2f096939d7f', 'command', 'Municipal Emergency Director Rao', '+91 9440001122', 'cmd-hq', '{"clearance_level": "Master Operator (Level 5)"}'::jsonb)
ON CONFLICT (username) DO NOTHING;
