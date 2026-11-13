// RESQ-X Supabase Cloud Database Client
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'data', 'supabase_config.json');

let supabaseInstance = null;
let currentConfig = {
  url: process.env.SUPABASE_URL || null,
  anonKey: process.env.SUPABASE_ANON_KEY || null,
  status: 'Unconfigured'
};

// Load saved config if exists
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.url && parsed.anonKey) {
      currentConfig.url = parsed.url;
      currentConfig.anonKey = parsed.anonKey;
    }
  }
} catch (e) {
  console.warn("[Supabase] Failed to read saved config:", e.message);
}

export function initSupabase(url = null, anonKey = null) {
  const targetUrl = url || currentConfig.url || process.env.SUPABASE_URL;
  const targetKey = anonKey || currentConfig.anonKey || process.env.SUPABASE_ANON_KEY;

  if (targetUrl && targetKey) {
    try {
      supabaseInstance = createClient(targetUrl, targetKey, {
        auth: { persistSession: false }
      });
      currentConfig.url = targetUrl;
      currentConfig.anonKey = targetKey;
      currentConfig.status = 'Connected';
      console.log(`[Supabase] Cloud client initialized for project: ${targetUrl.replace(/(https?:\/\/)([^.]+)(.*)/, '$1$2$3')}`);
      return supabaseInstance;
    } catch (err) {
      console.error("[Supabase] Initialization error:", err.message);
      currentConfig.status = 'Error: ' + err.message;
      supabaseInstance = null;
    }
  } else {
    currentConfig.status = 'Ready for URL & Key';
    supabaseInstance = null;
  }
  return null;
}

export function getSupabase() {
  if (!supabaseInstance && currentConfig.url && currentConfig.anonKey) {
    return initSupabase();
  }
  return supabaseInstance;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseInstance && currentConfig.url && currentConfig.anonKey);
}

export async function testSupabaseConnection(url = null, anonKey = null) {
  const client = (url && anonKey) ? createClient(url, anonKey) : getSupabase();
  if (!client) {
    return { success: false, error: "Supabase URL and Anon Key not configured" };
  }

  try {
    const { data, error } = await client.from('resqx_users').select('id, username').limit(1);
    if (error) {
      // If table doesn't exist, provide clear guidance
      if (error.code === '42P01') {
        return {
          success: false,
          error: "Table 'resqx_users' not found. Please run the SQL schema migration in Supabase SQL Editor.",
          schema_needed: true
        };
      }
      return { success: false, error: error.message };
    }
    return { success: true, count: data?.length || 0, message: "Successfully connected to Supabase Cloud PostgreSQL" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function saveSupabaseConfig(url, anonKey) {
  if (!url || !anonKey) {
    throw new Error("Both Supabase URL and Anon Key are required");
  }

  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  initSupabase(cleanUrl, cleanKey);

  try {
    const dataDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }, null, 2), 'utf8');
  } catch (e) {
    console.warn("[Supabase] Failed to write config file:", e.message);
  }

  return { success: true, message: "Supabase configuration updated", url: cleanUrl };
}

export function getSupabaseStatus() {
  const maskedUrl = currentConfig.url
    ? currentConfig.url.replace(/https:\/\/([^.]+)\.supabase\.co.*/, 'https://$1.supabase.co')
    : 'Not configured';

  return {
    configured: isSupabaseConfigured(),
    url: maskedUrl,
    has_key: Boolean(currentConfig.anonKey),
    status: currentConfig.status,
    provider: 'Supabase Cloud (PostgreSQL)'
  };
}

// ---------------- SUPABASE CLOUD OPERATIONS ----------------

export async function supabaseInsertUser(user) {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('resqx_users').upsert({
      id: user.id,
      username: user.username,
      password_hash: user.password_hash,
      password_salt: user.password_salt,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
      entity_id: user.entity_id || null,
      metadata: user.metadata || {},
      created_at: user.created_at || new Date().toISOString()
    }).select().single();

    if (error) console.warn("[Supabase] User upsert warning:", error.message);
    return data;
  } catch (e) {
    console.warn("[Supabase] User insert exception:", e.message);
    return null;
  }
}

export async function supabaseFindUser(username, role = null) {
  const client = getSupabase();
  if (!client) return null;
  try {
    let query = client.from('resqx_users').select('*').eq('username', username.toLowerCase());
    if (role) {
      query = query.eq('role', role);
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export async function supabaseInsertSession(session) {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('resqx_sessions').insert({
      token: session.token,
      user_id: session.user_id,
      role: session.role,
      entity_id: session.entity_id || null,
      name: session.name,
      created_at: session.created_at,
      expires_at: session.expires_at
    }).select().single();
    if (error) console.warn("[Supabase] Session insert warning:", error.message);
    return data;
  } catch (e) {
    return null;
  }
}

export async function supabaseVerifySession(token) {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('resqx_sessions')
      .select('*, resqx_users(*)')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) return null;
    if (new Date(data.expires_at) < new Date()) {
      await client.from('resqx_sessions').delete().eq('token', token);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

export async function supabaseInsertIncident(incident, citizenId, citizenName) {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('resqx_incidents').upsert({
      id: incident.id,
      citizen_id: citizenId || null,
      citizen_name: citizenName || null,
      category: incident.category,
      title: incident.title,
      zone_id: incident.zone_id,
      lat: incident.lat,
      lng: incident.lng,
      severity: incident.severity,
      priority_score: incident.priority_score,
      patient_count: incident.affected_count || 1,
      status: incident.status,
      assigned_ambulance_id: incident.assigned_ambulance_id || null,
      assigned_hospital_id: incident.assigned_hospital_id || null,
      reported_at: new Date().toISOString(),
      payload: incident
    }).select().single();
    if (error) console.warn("[Supabase] Incident upsert warning:", error.message);
    return data;
  } catch (e) {
    console.warn("[Supabase] Incident insert exception:", e.message);
    return null;
  }
}

export async function supabaseInsertRadio(message) {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('resqx_radio_messages').insert({
      id: message.id,
      timestamp: message.timestamp,
      sender: message.sender,
      channel: message.channel,
      message: message.message,
      ambulance_id: message.ambulance_id || null
    }).select().single();
    return data;
  } catch (e) {
    return null;
  }
}

// Auto-initialize on module load
initSupabase();
