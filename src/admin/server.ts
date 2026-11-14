/**
 * Endereço do servidor da Estrela (Cloudflare Worker) e chamadas do painel de super admin.
 * O endereço pode vir do painel (gravado neste aparelho) ou do build (VITE_ESTELA_URL).
 * Nenhuma chave de API passa por aqui depois de salva: o Worker guarda e nunca devolve.
 */
const URL_KEY = 'spaceagro_estela_url_v1';
const PW_KEY = 'spaceagro_admin_pw_v1'; // só na sessão da aba (sessionStorage), nunca no localStorage

export function estelaBaseUrl(): string | null {
  let saved = '';
  try { saved = localStorage.getItem(URL_KEY) || ''; } catch { /* ignora */ }
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ESTELA_URL || '';
  const base = (saved || env).trim();
  return base ? base.replace(/\/+$/, '') : null;
}

export function setEstelaBaseUrl(url: string): void {
  try {
    const v = url.trim().replace(/\/+$/, '');
    if (v) localStorage.setItem(URL_KEY, v); else localStorage.removeItem(URL_KEY);
  } catch { /* ignora */ }
}

export function validServerUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function adminPassword(): string {
  try { return sessionStorage.getItem(PW_KEY) || ''; } catch { return ''; }
}
export function setAdminPassword(pw: string): void {
  try { if (pw) sessionStorage.setItem(PW_KEY, pw); else sessionStorage.removeItem(PW_KEY); } catch { /* ignora */ }
}

export interface ServerStatus {
  ok: boolean;
  error?: string;
  kv?: boolean;
  claude?: { configured: boolean; from: string; hint: string };
  voice?: { configured: boolean; from: string; hint: string };
  model?: string;
  voiceName?: string;
  models?: string[];
  voices?: string[];
  allowedOrigin?: string;
  updatedAt?: string | null;
}

/** Chamada autenticada ao painel do Worker. Erros de rede viram { ok:false, error:'sem_conexao' }. */
export async function adminCall<T = ServerStatus>(path: '/admin/status' | '/admin/config' | '/admin/test', body: object = {}, base = estelaBaseUrl(), password = adminPassword()): Promise<T & { ok: boolean; error?: string; httpStatus?: number }> {
  if (!base) return { ok: false, error: 'sem_servidor' } as T & { ok: boolean; error: string };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let j: Record<string, unknown> = {};
    try { j = await r.json(); } catch { j = {}; }
    return { ok: r.ok && j.ok !== false, ...(j as object), httpStatus: r.status } as T & { ok: boolean; error?: string; httpStatus?: number };
  } catch {
    return { ok: false, error: 'sem_conexao' } as T & { ok: boolean; error: string };
  } finally {
    clearTimeout(timer);
  }
}

/** Mensagens claras para os códigos de erro do Worker. */
export function errorText(code?: string): string {
  const map: Record<string, string> = {
    sem_servidor: 'Informe o endereço do servidor da Estrela.',
    sem_conexao: 'Não foi possível falar com o servidor. Confira o endereço e a internet.',
    senha_incorreta: 'Senha de administração incorreta.',
    bloqueado: 'Muitas tentativas erradas hoje. Tente amanhã.',
    admin_sem_senha: 'O servidor ainda não tem a senha de administração (ADMIN_PASSWORD) cadastrada na Cloudflare.',
    kv_ausente: 'O servidor não tem o armazenamento CONFIG (KV) ligado. Veja o passo a passo em worker/LEIA-ME.md.',
    chave_claude_invalida: 'A chave do Claude parece inválida. Ela começa com sk-ant-.',
    chave_openai_invalida: 'A chave da OpenAI parece inválida. Ela começa com sk-.',
    modelo_invalido: 'Modelo não permitido.',
    voz_invalida: 'Voz não permitida.',
    claude_nao_configurado: 'Cadastre a chave do Claude antes de testar.',
    authentication_error: 'O Claude recusou a chave: confira se ela está correta e ativa.',
    permission_error: 'A chave não tem permissão para esse modelo.',
    rate_limit_error: 'Limite de uso do Claude atingido. Tente em instantes.',
    overloaded_error: 'O Claude está sobrecarregado agora. Tente de novo.',
    not_found_error: 'Modelo não encontrado para esta conta.',
    resposta_vazia: 'O Claude respondeu sem texto.',
  };
  return (code && map[code]) || 'Algo deu errado. Tente de novo.';
}
