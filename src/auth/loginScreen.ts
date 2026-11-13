import { setLanguage, getCurrentLanguage, LanguageCode } from '../i18n';
import { AuthError, currentUser, deleteAccount, enterAsGuest, login, signup } from './auth';
import { at } from './authText';

const LANGS: [LanguageCode, string][] = [
  ['pt', 'Português'], ['es', 'Español'], ['en', 'English'],
  ['de', 'Deutsch'], ['zh', '简体中文'], ['fr', 'Français'],
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Mostra a tela de acesso e só resolve quando houver sessão válida. */
export function requireAuth(): Promise<void> {
  if (currentUser()) return Promise.resolve();
  return new Promise((resolve) => {
    let mode: 'login' | 'signup' = 'login';
    let showForgot = false;
    const root = document.createElement('div');
    root.id = 'auth-screen';
    document.body.appendChild(root);

    const done = () => {
      root.remove();
      resolve();
    };

    const render = (error = '', info = '') => {
      const field = (id: string, label: string, type = 'text', extra = '') =>
        `<label class="auth-field"><span>${label}</span><input id="${id}" type="${type}" ${extra} /></label>`;
      root.innerHTML = `
        <div class="auth-card">
          <div class="auth-top">
            <span class="brand-mark brand-mark-auth" role="img" aria-label="SpaceAgro"><img src="./assets/brand/spaceagro-logo.svg" alt="" /></span>
            <select id="auth-lang" aria-label="Language">
              ${LANGS.map(([c, n]) => `<option value="${c}" ${c === getCurrentLanguage() ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <h1>${at('title')}</h1>
          <p class="auth-sub">${at('subtitle')}</p>
          <div class="auth-tabs">
            <button type="button" data-mode="login" class="${mode === 'login' ? 'on' : ''}">${at('tabLogin')}</button>
            <button type="button" data-mode="signup" class="${mode === 'signup' ? 'on' : ''}">${at('tabSignup')}</button>
          </div>
          <form id="auth-form" novalidate>
            ${mode === 'signup' ? field('a-name', at('name'), 'text', 'autocomplete="name"') : ''}
            ${field('a-email', at('email'), 'email', 'autocomplete="email"')}
            ${mode === 'signup' ? field('a-phone', at('phone'), 'tel', 'autocomplete="tel"') + field('a-farm', at('farm')) + field('a-city', at('city'), 'text', 'autocomplete="address-level2"') : ''}
            ${field('a-pw', at('password'), 'password', `autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"`)}
            ${mode === 'signup' ? `<div class="auth-hint">${at('passwordHint')}</div>` + field('a-pw2', at('password2'), 'password', 'autocomplete="new-password"') : ''}
            ${mode === 'signup'
              ? `<label class="auth-check"><input id="a-consent" type="checkbox" /><span>${at('consent')}</span></label>`
              : `<label class="auth-check"><input id="a-keep" type="checkbox" /><span>${at('keep')}</span></label>`}
            <div class="auth-msg auth-err" id="auth-err" role="alert" ${error ? '' : 'hidden'}>${esc(error)}</div>
            <div class="auth-msg auth-info" id="auth-info" ${info ? '' : 'hidden'}>${esc(info)}</div>
            <button type="submit" class="auth-primary" id="auth-submit">${mode === 'login' ? at('btnLogin') : at('btnSignup')}</button>
          </form>
          ${mode === 'login' ? `<button type="button" class="auth-link" id="auth-forgot">${at('forgot')}</button>` : ''}
          ${showForgot ? `<div class="auth-forgot"><p>${at('forgotMsg')}</p><button type="button" class="auth-danger" id="auth-delete">${at('forgotDelete')}</button></div>` : ''}
          <button type="button" class="auth-guest" id="auth-guest">${at('guest')}</button>
          <p class="auth-note">${at('localNote')}</p>
        </div>`;

      root.querySelector<HTMLSelectElement>('#auth-lang')!.onchange = (e) => {
        setLanguage((e.target as HTMLSelectElement).value as LanguageCode);
        render();
      };
      root.querySelectorAll<HTMLButtonElement>('.auth-tabs button').forEach((b) => {
        b.onclick = () => {
          mode = b.dataset.mode as 'login' | 'signup';
          showForgot = false;
          render();
        };
      });
      root.querySelector<HTMLButtonElement>('#auth-guest')!.onclick = () => {
        enterAsGuest();
        done();
      };
      const forgot = root.querySelector<HTMLButtonElement>('#auth-forgot');
      if (forgot) forgot.onclick = () => {
        showForgot = true;
        render();
      };
      const del = root.querySelector<HTMLButtonElement>('#auth-delete');
      if (del) del.onclick = () => {
        const email = (root.querySelector<HTMLInputElement>('#a-email')!).value;
        if (!email.trim()) return render(at('errRequired'));
        deleteAccount(email);
        showForgot = false;
        render('', at('forgotDone'));
      };

      const val = (id: string) => (root.querySelector<HTMLInputElement>('#' + id)?.value ?? '');
      root.querySelector<HTMLFormElement>('#auth-form')!.onsubmit = async (e) => {
        e.preventDefault();
        const btn = root.querySelector<HTMLButtonElement>('#auth-submit')!;
        btn.disabled = true;
        try {
          if (mode === 'login') {
            await login(val('a-email'), val('a-pw'), !!root.querySelector<HTMLInputElement>('#a-keep')?.checked);
          } else {
            await signup(
              {
                name: val('a-name'), email: val('a-email'), phone: val('a-phone'), farmName: val('a-farm'), city: val('a-city'),
                password: val('a-pw'), password2: val('a-pw2'), consent: !!root.querySelector<HTMLInputElement>('#a-consent')?.checked,
              },
              true
            );
          }
          done();
        } catch (err) {
          const k = err instanceof AuthError ? err.key : 'errBadLogin';
          const sec = err instanceof AuthError ? err.seconds : 0;
          const keep = { email: val('a-email'), name: val('a-name'), phone: val('a-phone'), farm: val('a-farm'), city: val('a-city') };
          render(at(k, { s: sec }));
          const set = (id: string, v: string) => { const el = root.querySelector<HTMLInputElement>('#' + id); if (el) el.value = v; };
          set('a-email', keep.email); set('a-name', keep.name); set('a-phone', keep.phone); set('a-farm', keep.farm); set('a-city', keep.city);
        }
      };
    };
    render();
  });
}
