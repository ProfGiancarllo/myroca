/**
 * Painel de super admin: liga a Estrela à API do Claude (e à voz natural) pelo servidor (Cloudflare Worker).
 *
 * Segurança
 * - As chaves de API vão do painel direto para o Worker, que guarda no KV da Cloudflare e nunca devolve.
 * - Toda ação no servidor exige a senha de administração (ADMIN_PASSWORD), conferida pelo Worker.
 *   Ela fica só nesta aba (sessionStorage) e some ao fechar.
 * - A conta "super admin" do app só libera esta tela neste aparelho; quem protege de verdade é o servidor.
 */
import { AuthError, createSuperAdmin, currentUser, isSuperAdmin } from '../auth/auth';
import { adminCall, adminPassword, errorText, estelaBaseUrl, ServerStatus, setAdminPassword, setEstelaBaseUrl, validServerUrl } from './server';

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5 — mais capaz (padrão)',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 — rápido e equilibrado',
  'claude-haiku-5-5': 'Claude Haiku 5.5 — mais econômico',
};
const VOICE_LABEL: Record<string, string> = {
  coral: 'Coral (padrão)', nova: 'Nova', shimmer: 'Shimmer', sage: 'Sage', alloy: 'Alloy', ash: 'Ash', ballad: 'Ballad', echo: 'Echo', verse: 'Verse',
};
const AUTH_ERR: Record<string, string> = {
  errRequired: 'Preencha todos os campos.',
  errEmail: 'E-mail inválido.',
  errPwShort: 'A senha do super admin precisa de pelo menos 10 caracteres, com letras e números.',
  errPwMismatch: 'As senhas não conferem.',
  errExists: 'Já existe uma conta com esse e-mail neste aparelho.',
  errCrypto: 'Este navegador não permite criar a conta com segurança.',
};

// ============================================================ Criação do super admin
/** Tela para criar o primeiro super admin. Só cria depois que o servidor confirma a senha de administração. */
export function openAdminSetup(): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'auth-screen';
    root.className = 'adm-setup';
    document.body.appendChild(root);
    const render = (err = '') => {
      root.innerHTML = `
        <form class="auth-card adm-setup-card" novalidate>
          <div class="auth-top"><span class="brand-mark brand-mark-auth" role="img" aria-label="SpaceAgro"><img src="./assets/brand/spaceagro-logo.svg" alt="" /></span></div>
          <h1>Criar super admin</h1>
          <p class="auth-sub">Conta que administra a Estrela e a conexão com a API do Claude. Para provar que você controla o servidor, informe a senha de administração cadastrada na Cloudflare.</p>
          ${err ? `<div class="auth-msg auth-err" role="alert">${esc(err)}</div>` : ''}
          <fieldset class="adm-fs"><legend>Servidor da Estrela</legend>
            <label class="auth-field"><span>Endereço do servidor (Cloudflare Worker)</span><input id="as-url" type="url" placeholder="https://estela.seunome.workers.dev" value="${esc(estelaBaseUrl() || '')}" autocomplete="url" /></label>
            <label class="auth-field"><span>Senha de administração do servidor (ADMIN_PASSWORD)</span><input id="as-srvpw" type="password" autocomplete="off" /></label>
          </fieldset>
          <fieldset class="adm-fs"><legend>Sua conta de super admin</legend>
            <label class="auth-field"><span>Nome</span><input id="as-name" type="text" autocomplete="name" /></label>
            <label class="auth-field"><span>E-mail</span><input id="as-email" type="email" autocomplete="email" /></label>
            <label class="auth-field"><span>Senha</span><input id="as-pw" type="password" autocomplete="new-password" /></label>
            <div class="auth-hint">Pelo menos 10 caracteres, com letras e números.</div>
            <label class="auth-field"><span>Confirmar senha</span><input id="as-pw2" type="password" autocomplete="new-password" /></label>
          </fieldset>
          <button type="submit" class="auth-primary" id="as-submit">Verificar servidor e criar conta</button>
          <button type="button" class="auth-link" id="as-cancel">Voltar ao app</button>
        </form>`;
      const v = (id: string) => root.querySelector<HTMLInputElement>('#' + id)!.value;
      root.querySelector<HTMLButtonElement>('#as-cancel')!.onclick = () => { root.remove(); resolve(false); };
      root.querySelector('form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = root.querySelector<HTMLButtonElement>('#as-submit')!;
        const url = v('as-url').trim();
        const srvpw = v('as-srvpw');
        if (!validServerUrl(url)) return render('Endereço do servidor inválido. Use o endereço https do seu Worker.');
        if (!srvpw) return render('Informe a senha de administração do servidor.');
        btn.disabled = true; btn.textContent = 'Verificando servidor…';
        const st = await adminCall('/admin/status', {}, url.replace(/\/+$/, ''), srvpw);
        if (!st.ok) return render(errorText(st.error));
        try {
          await createSuperAdmin({ name: v('as-name'), email: v('as-email'), password: v('as-pw'), password2: v('as-pw2') });
        } catch (er) {
          return render(er instanceof AuthError ? AUTH_ERR[er.key] || 'Não foi possível criar a conta.' : 'Não foi possível criar a conta.');
        }
        setEstelaBaseUrl(url);
        setAdminPassword(srvpw);
        root.remove();
        resolve(true);
      });
      root.querySelector<HTMLInputElement>('#as-url')?.focus();
    };
    render();
  });
}

// ============================================================ Painel
export class AdminPanel {
  private overlay: HTMLElement | null = null;
  private status: ServerStatus | null = null;
  private notes: Record<string, { kind: 'ok' | 'err'; text: string }> = {};
  private busy = '';
  private testAnswer: { text: string; meta: string } | null = null;

  open(): void {
    if (!isSuperAdmin()) return;
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'adm-overlay';
      this.overlay.setAttribute('role', 'dialog');
      this.overlay.setAttribute('aria-modal', 'true');
      this.overlay.setAttribute('aria-label', 'Administração');
      this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.overlay?.style.display === 'flex') this.close(); });
      document.body.appendChild(this.overlay);
    }
    this.overlay.style.display = 'flex';
    this.render();
    if (adminPassword() && estelaBaseUrl()) void this.refresh();
  }

  close(): void { if (this.overlay) this.overlay.style.display = 'none'; }

  private note(key: string, kind: 'ok' | 'err', text: string): void { this.notes[key] = { kind, text }; }

  private async refresh(): Promise<void> {
    this.busy = 'status'; this.render();
    const st = await adminCall('/admin/status');
    this.busy = '';
    if (st.ok) { this.status = st; delete this.notes.server; }
    else {
      this.status = null;
      this.note('server', 'err', errorText(st.error));
      if (st.error === 'senha_incorreta') setAdminPassword('');
    }
    this.render();
  }

  private render(): void {
    if (!this.overlay) return;
    const user = currentUser();
    const unlocked = !!adminPassword();
    const st = this.status;
    const n = (k: string) => (this.notes[k] ? `<p class="adm-note ${this.notes[k].kind}" role="${this.notes[k].kind === 'err' ? 'alert' : 'status'}">${esc(this.notes[k].text)}</p>` : '');
    const pill = (on: boolean, yes: string, no: string) => `<span class="adm-pill ${on ? 'on' : 'off'}">${esc(on ? yes : no)}</span>`;
    const fromTxt = (f: string) => (f === 'painel' ? 'cadastrada por este painel' : f === 'cloudflare' ? 'cadastrada direto na Cloudflare' : '');

    const unlock = `
      <section class="adm-sec">
        <h3>Desbloquear o painel</h3>
        <p class="adm-help">Informe a senha de administração do servidor (ADMIN_PASSWORD). Ela fica só nesta aba e some ao fechar.</p>
        ${n('unlock')}
        <form class="adm-row" data-form="unlock">
          <input type="password" id="adm-pw" autocomplete="off" aria-label="Senha de administração" placeholder="Senha de administração" />
          <button type="submit" class="btn btn-primary" ${this.busy ? 'disabled' : ''}>${this.busy === 'unlock' ? 'Verificando…' : 'Desbloquear'}</button>
        </form>
      </section>`;

    const server = `
      <section class="adm-sec">
        <h3>Servidor da Estrela</h3>
        <p class="adm-help">Cloudflare Worker que guarda as chaves e fala com o Claude. O passo a passo de criação está em <code>worker/LEIA-ME.md</code>.</p>
        ${n('server')}
        <form class="adm-row" data-form="url">
          <input type="url" id="adm-url" value="${esc(estelaBaseUrl() || '')}" placeholder="https://estela.seunome.workers.dev" aria-label="Endereço do servidor" />
          <button type="submit" class="btn btn-secondary" ${this.busy ? 'disabled' : ''}>${this.busy === 'status' ? 'Testando…' : 'Salvar e testar'}</button>
        </form>
        ${st ? `<dl class="adm-dl">
          <div><dt>Conexão</dt><dd>${pill(true, 'Conectado', '')}</dd></div>
          <div><dt>Armazenamento de configuração (KV)</dt><dd>${pill(!!st.kv, 'Ativo', 'Ausente — o painel não consegue gravar')}</dd></div>
          <div><dt>Origem permitida</dt><dd>${esc(st.allowedOrigin === '*' ? 'Qualquer site (use o endereço do app em produção)' : st.allowedOrigin || '')}</dd></div>
          ${st.updatedAt ? `<div><dt>Última alteração</dt><dd>${esc(new Date(st.updatedAt).toLocaleString('pt-BR'))}</dd></div>` : ''}
        </dl>` : ''}
      </section>`;

    const models = st?.models || Object.keys(MODEL_LABEL);
    const claude = st ? `
      <section class="adm-sec">
        <h3>Inteligência da Estrela — API do Claude</h3>
        <p class="adm-help">Chave de API da Anthropic (console.anthropic.com → API Keys). Defina também um limite de gasto na conta.</p>
        <p class="adm-state">${pill(!!st.claude?.configured, 'Configurada', 'Não configurada')} ${st.claude?.configured ? `<span>chave ${esc(st.claude.hint)}, ${esc(fromTxt(st.claude.from))}</span>` : '<span>a Estrela responde só com as regras locais</span>'}</p>
        ${n('claude')}
        <form class="adm-grid" data-form="claude">
          <label><span>${st.claude?.configured ? 'Trocar a chave (deixe em branco para manter)' : 'Chave da API do Claude'}</span>
            <input type="password" id="adm-ckey" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" /></label>
          <label><span>Modelo</span>
            <select id="adm-model">${models.map((m) => `<option value="${esc(m)}" ${m === st.model ? 'selected' : ''}>${esc(MODEL_LABEL[m] || m)}</option>`).join('')}</select></label>
          <div class="adm-actions">
            <button type="submit" class="btn btn-primary" ${this.busy || !st.kv ? 'disabled' : ''}>${this.busy === 'claude' ? 'Salvando…' : 'Salvar'}</button>
            ${st.claude?.configured && st.claude.from === 'painel' ? `<button type="button" class="btn btn-secondary" data-act="clear-claude" ${this.busy ? 'disabled' : ''}>Remover chave</button>` : ''}
          </div>
        </form>
      </section>
      <section class="adm-sec">
        <h3>Testar a Estrela</h3>
        <p class="adm-help">Faz uma pergunta de verdade ao Claude pelo servidor, com o modelo salvo acima.</p>
        ${n('test')}
        <form class="adm-row" data-form="test">
          <input type="text" id="adm-q" value="Diga em uma frase quem você é." aria-label="Pergunta de teste" />
          <button type="submit" class="btn btn-secondary" ${this.busy || !st.claude?.configured ? 'disabled' : ''}>${this.busy === 'test' ? 'Perguntando…' : 'Perguntar'}</button>
        </form>
        ${this.testAnswer ? `<blockquote class="adm-answer">${esc(this.testAnswer.text)}<footer>${esc(this.testAnswer.meta)}</footer></blockquote>` : ''}
      </section>` : '';

    const voices = st?.voices || Object.keys(VOICE_LABEL);
    const voice = st ? `
      <section class="adm-sec">
        <h3>Voz natural da Estrela — OpenAI (opcional)</h3>
        <p class="adm-help">Chave da OpenAI (platform.openai.com → API keys). Sem ela, a Estrela só escreve.</p>
        <p class="adm-state">${pill(!!st.voice?.configured, 'Configurada', 'Não configurada')} ${st.voice?.configured ? `<span>chave ${esc(st.voice.hint)}, ${esc(fromTxt(st.voice.from))}</span>` : ''}</p>
        ${n('voice')}
        <form class="adm-grid" data-form="voice">
          <label><span>${st.voice?.configured ? 'Trocar a chave (deixe em branco para manter)' : 'Chave da API da OpenAI'}</span>
            <input type="password" id="adm-okey" autocomplete="off" spellcheck="false" placeholder="sk-…" /></label>
          <label><span>Voz</span>
            <select id="adm-voice">${voices.map((v) => `<option value="${esc(v)}" ${v === st.voiceName ? 'selected' : ''}>${esc(VOICE_LABEL[v] || v)}</option>`).join('')}</select></label>
          <div class="adm-actions">
            <button type="submit" class="btn btn-primary" ${this.busy || !st.kv ? 'disabled' : ''}>${this.busy === 'voice' ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" class="btn btn-secondary" data-act="sample" ${this.busy || !st.voice?.configured ? 'disabled' : ''}>${this.busy === 'sample' ? 'Gerando…' : 'Ouvir amostra'}</button>
            ${st.voice?.configured && st.voice.from === 'painel' ? `<button type="button" class="btn btn-secondary" data-act="clear-voice" ${this.busy ? 'disabled' : ''}>Remover chave</button>` : ''}
          </div>
        </form>
      </section>` : '';

    this.overlay.innerHTML = `
      <div class="adm-card">
        <header class="adm-head">
          <div><h2>Administração</h2><p>${esc(user && 'email' in user ? `${user.name} · ${user.email}` : '')} · super admin</p></div>
          <div class="adm-head-act">
            ${unlocked ? '<button type="button" class="btn btn-secondary" data-act="lock">Bloquear painel</button>' : ''}
            <button type="button" class="adm-x" data-act="close" aria-label="Fechar">&times;</button>
          </div>
        </header>
        <div class="adm-body">${unlocked ? server + claude + voice : unlock}</div>
      </div>`;
    this.bind();
  }

  private bind(): void {
    const o = this.overlay!;
    const val = (id: string) => o.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id)?.value ?? '';
    o.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => (b.onclick = () => void this.act(b.dataset.act!)));
    o.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((f) => f.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit(f.dataset.form!, val);
    }));
    if (!adminPassword()) o.querySelector<HTMLInputElement>('#adm-pw')?.focus();
  }

  private async submit(form: string, val: (id: string) => string): Promise<void> {
    if (form === 'unlock') {
      const pw = val('adm-pw');
      if (!pw) return;
      if (!estelaBaseUrl()) { this.note('unlock', 'err', errorText('sem_servidor') + ' Crie o super admin de novo pelo endereço ?admin ou defina VITE_ESTELA_URL.'); return this.render(); }
      this.busy = 'unlock'; this.render();
      const st = await adminCall('/admin/status', {}, estelaBaseUrl(), pw);
      this.busy = '';
      if (!st.ok) { this.note('unlock', 'err', errorText(st.error)); return this.render(); }
      setAdminPassword(pw); this.status = st; delete this.notes.unlock;
      return this.render();
    }
    if (form === 'url') {
      const url = val('adm-url').trim();
      if (!validServerUrl(url)) { this.note('server', 'err', 'Endereço inválido. Use o endereço https do seu Worker.'); return this.render(); }
      setEstelaBaseUrl(url);
      return this.refresh();
    }
    if (form === 'claude') {
      const key = val('adm-ckey').trim();
      const body: Record<string, unknown> = { model: val('adm-model') };
      if (key) body.anthropicKey = key;
      return this.save('claude', body, key ? 'Chave e modelo salvos no servidor.' : 'Modelo salvo.');
    }
    if (form === 'voice') {
      const key = val('adm-okey').trim();
      const body: Record<string, unknown> = { voice: val('adm-voice') };
      if (key) body.openaiKey = key;
      return this.save('voice', body, key ? 'Chave e voz salvas no servidor.' : 'Voz salva.');
    }
    if (form === 'test') {
      this.busy = 'test'; this.testAnswer = null; this.render();
      const r = await adminCall<{ answer: string; ms: number; model: string }>('/admin/test', { question: val('adm-q') });
      this.busy = '';
      if (r.ok && r.answer) {
        delete this.notes.test;
        this.testAnswer = { text: r.answer, meta: `${MODEL_LABEL[r.model]?.split(' — ')[0] || r.model} · ${(r.ms / 1000).toFixed(1)} s` };
      } else this.note('test', 'err', errorText(r.error));
      return this.render();
    }
  }

  private async save(section: string, body: Record<string, unknown>, okText: string): Promise<void> {
    this.busy = section; this.render();
    const r = await adminCall('/admin/config', body);
    this.busy = '';
    if (r.ok) { this.status = r; this.note(section, 'ok', okText); }
    else this.note(section, 'err', errorText(r.error));
    this.render();
  }

  private async act(a: string): Promise<void> {
    if (a === 'close') return this.close();
    if (a === 'lock') { setAdminPassword(''); this.status = null; this.notes = {}; this.testAnswer = null; return this.render(); }
    if (a === 'clear-claude') {
      if (!confirm('Remover a chave do Claude do servidor? A Estrela volta a responder só com as regras locais.')) return;
      return this.save('claude', { clearAnthropic: true }, 'Chave do Claude removida do servidor.');
    }
    if (a === 'clear-voice') {
      if (!confirm('Remover a chave da OpenAI do servidor? A Estrela deixa de falar.')) return;
      return this.save('voice', { clearOpenai: true }, 'Chave da OpenAI removida do servidor.');
    }
    if (a === 'sample') {
      const base = estelaBaseUrl();
      if (!base) return;
      this.busy = 'sample'; this.render();
      const voiceSel = this.overlay?.querySelector<HTMLSelectElement>('#adm-voice')?.value;
      try {
        const r = await fetch(base + '/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Olá! Eu sou a Estrela, a inteligência artificial que ajuda o produtor a tomar decisões.', lang: 'pt-BR', voice: voiceSel }) });
        if (!r.ok) throw new Error(String(r.status));
        const url = URL.createObjectURL(await r.blob());
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        this.note('voice', 'ok', 'Tocando a amostra.');
      } catch {
        this.note('voice', 'err', 'Não foi possível gerar a amostra de voz. Confira a chave da OpenAI.');
      }
      this.busy = '';
      this.render();
    }
  }
}
