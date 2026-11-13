-- Step 2: Enable RLS and public policies
ALTER TABLE resqx_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_radio_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE resqx_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access Users" ON resqx_users;
CREATE POLICY "Public Access Users" ON resqx_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Sessions" ON resqx_sessions;
CREATE POLICY "Public Access Sessions" ON resqx_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Incidents" ON resqx_incidents;
CREATE POLICY "Public Access Incidents" ON resqx_incidents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Radio" ON resqx_radio_messages;
CREATE POLICY "Public Access Radio" ON resqx_radio_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Audit" ON resqx_audit_logs;
CREATE POLICY "Public Access Audit" ON resqx_audit_logs FOR ALL USING (true) WITH CHECK (true);
