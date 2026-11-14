/**
 * Controle de acesso local (modo demonstração).
 * Contas e senhas ficam no navegador do aparelho; a senha é guardada apenas como hash PBKDF2 (nunca em texto).
 * Isto separa os dados de cada usuário neste aparelho, mas NÃO substitui um login em servidor:
 * quem tiver acesso ao aparelho pode inspecionar o armazenamento local.
 * A interface (AuthProvider) permite trocar por um provedor online (ex.: Supabase) sem refazer as telas.
 */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  farmName: string;
  city: string;
  salt: string;
  hash: string;
  createdAt: string;
  consentAt: string;
  /** 'superadmin' libera o painel de administração neste aparelho. Ações no servidor exigem também a senha de administração. */
  role?: 'superadmin';
}

export type AuthErrorKey = 'errRequired' | 'errEmail' | 'errPwShort' | 'errPwMismatch' | 'errConsent' | 'errExists' | 'errBadLogin' | 'errLocked' | 'errCrypto';
export class AuthError extends Error {
  constructor(public key: AuthErrorKey, public seconds = 0) {
    super(key);
  }
}

const USERS_KEY = 'myroca_users_v1';
const SESSION_KEY = 'myroca_session_v1';
const FAIL_KEY = 'myroca_auth_fail_v1';
const ITER = 150000;
const MAX_FAILS = 5;
const LOCK_SECONDS = 60;
const SESSION_DAYS = 30;
export const GUEST_ID = 'guest';

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(storage: Storage, key: string, v: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignora */
  }
}

const users = (): UserProfile[] => readJson<UserProfile[]>(localStorage, USERS_KEY, []);

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new AuthError('errCrypto');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITER }, key, 256);
  return b64(bits);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export interface SignupInput {
  name: string;
  email: string;
  phone?: string;
  farmName: string;
  city: string;
  password: string;
  password2: string;
  consent: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function signup(input: SignupInput, keep: boolean): Promise<UserProfile> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !input.farmName.trim() || !input.city.trim() || !email || !input.password) throw new AuthError('errRequired');
  if (!EMAIL_RE.test(email)) throw new AuthError('errEmail');
  if (input.password.length < 8 || !/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) throw new AuthError('errPwShort');
  if (input.password !== input.password2) throw new AuthError('errPwMismatch');
  if (!input.consent) throw new AuthError('errConsent');
  const all = users();
  if (all.some((u) => u.email === email)) throw new AuthError('errExists');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const now = new Date().toISOString();
  const user: UserProfile = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    email,
    phone: input.phone?.trim() || undefined,
    farmName: input.farmName.trim(),
    city: input.city.trim(),
    salt: b64(salt),
    hash: await hashPassword(input.password, salt),
    createdAt: now,
    consentAt: now,
  };
  // Primeira conta do aparelho: herda os dados que já existiam antes do controle de acesso.
  if (all.length === 0) adoptLegacyData(user.id);
  writeJson(localStorage, USERS_KEY, [...all, user]);
  startSession(user.id, keep);
  return user;
}

export async function login(emailRaw: string, password: string, keep: boolean): Promise<UserProfile> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) throw new AuthError('errRequired');
  const fails = readJson<Record<string, { n: number; until: number }>>(localStorage, FAIL_KEY, {});
  const f = fails[email];
  if (f && f.until > Date.now()) throw new AuthError('errLocked', Math.ceil((f.until - Date.now()) / 1000));

  const user = users().find((u) => u.email === email);
  // Calcula o hash mesmo se o e-mail não existe, para não revelar quais e-mails têm conta.
  const salt = user ? unb64(user.salt) : crypto.getRandomValues(new Uint8Array(16));
  const h = await hashPassword(password, salt);
  if (!user || !timingSafeEqual(h, user.hash)) {
    const n = (f?.n || 0) + 1;
    fails[email] = n >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_SECONDS * 1000 } : { n, until: 0 };
    writeJson(localStorage, FAIL_KEY, fails);
    if (n >= MAX_FAILS) throw new AuthError('errLocked', LOCK_SECONDS);
    throw new AuthError('errBadLogin');
  }
  delete fails[email];
  writeJson(localStorage, FAIL_KEY, fails);
  startSession(user.id, keep);
  return user;
}

// ---- Super admin ----
export interface SuperAdminInput { name: string; email: string; password: string; password2: string }

export function hasSuperAdmin(): boolean {
  return users().some((u) => u.role === 'superadmin');
}

export function isSuperAdmin(): boolean {
  const u = currentUser();
  return !!u && u.id !== GUEST_ID && (u as UserProfile).role === 'superadmin';
}

/** Cria a conta de super admin deste aparelho (só depois de o painel confirmar a senha do servidor). */
export async function createSuperAdmin(input: SuperAdminInput): Promise<UserProfile> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email || !input.password) throw new AuthError('errRequired');
  if (!EMAIL_RE.test(email)) throw new AuthError('errEmail');
  if (input.password.length < 10 || !/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) throw new AuthError('errPwShort');
  if (input.password !== input.password2) throw new AuthError('errPwMismatch');
  const all = users();
  if (all.some((u) => u.email === email)) throw new AuthError('errExists');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const now = new Date().toISOString();
  const user: UserProfile = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name, email, farmName: 'SpaceAgro', city: 'Rio Verde (GO)',
    salt: b64(salt), hash: await hashPassword(input.password, salt),
    createdAt: now, consentAt: now, role: 'superadmin',
  };
  writeJson(localStorage, USERS_KEY, [...all, user]);
  startSession(user.id, false);
  return user;
}

export function enterAsGuest(): void {
  startSession(GUEST_ID, false);
}

function startSession(userId: string, keep: boolean): void {
  const s = { userId, at: Date.now() };
  writeJson(sessionStorage, SESSION_KEY, s);
  if (keep) writeJson(localStorage, SESSION_KEY, s);
  else try { localStorage.removeItem(SESSION_KEY); } catch { /* ignora */ }
}

/** Usuário da sessão atual (ou null se não houver sessão válida). */
export function currentUser(): UserProfile | { id: typeof GUEST_ID; name: string } | null {
  const s =
    readJson<{ userId: string; at: number } | null>(sessionStorage, SESSION_KEY, null) ||
    readJson<{ userId: string; at: number } | null>(localStorage, SESSION_KEY, null);
  if (!s || Date.now() - s.at > SESSION_DAYS * 86400000) return null;
  if (s.userId === GUEST_ID) return { id: GUEST_ID, name: 'Guest' };
  return users().find((u) => u.id === s.userId) || null;
}

export function logout(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignora */ }
}

/** Apaga a conta e os dados dela neste aparelho. */
export function deleteAccount(email: string): void {
  const e = email.trim().toLowerCase();
  const all = users();
  const u = all.find((x) => x.email === e);
  if (!u) return;
  writeJson(localStorage, USERS_KEY, all.filter((x) => x.id !== u.id));
  for (const base of DATA_KEYS) try { localStorage.removeItem(`${base}:${u.id}`); } catch { /* ignora */ }
}

// ---- Dados separados por usuário ----
const DATA_KEYS = ['myroca_farm_data_rio_verde_rural_v3', 'myroca_avatar_v1', 'myroca_avatar_prompted_v1'];

/** Chave de armazenamento do usuário atual. Sem sessão, usa a chave original (compatível com o modo antigo). */
export function scopedKey(base: string): string {
  const u = currentUser();
  return u ? `${base}:${u.id}` : base;
}

function adoptLegacyData(userId: string): void {
  for (const base of DATA_KEYS) {
    try {
      const v = localStorage.getItem(base);
      if (v !== null && localStorage.getItem(`${base}:${userId}`) === null) localStorage.setItem(`${base}:${userId}`, v);
    } catch { /* ignora */ }
  }
}
