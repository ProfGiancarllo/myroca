import { FarmData, Talhao, DiaryEntry, DiaryEntryType } from '../types';
import { getCurrentLanguage, t, translateCropName } from '../i18n';
import { et } from './estelaText';
import { calculateTalhaoCropStatus, addDaysToDate } from '../utils/cropCalendar';
import { fetchNasaSeries, polygonCentroid } from '../utils/nasaPower';
import { assessPlanting } from '../utils/agronomyRules';
import { resolveWeather } from '../utils/weather';
import { wt } from '../i18n/weatherText';
import { cropKey } from '../utils/forecast';
import { TranslationDictionary } from '../i18n/types';
import { pq } from './pendText';
import { computePending, Pending } from './pending';
import { CROP_STANDARD_NAME, DEFAULT_CYCLE, asCropKey } from '../utils/rotation';
import { calculateExpectedHarvestDate } from '../utils/cropCalendar';

export interface EstelaOptions {
  getFarm: () => FarmData;
  getRefDate: () => string;
  /** Chamado depois de gravar uma entrada no diário (salvar e atualizar telas). */
  onDiaryAdded: (talhao: Talhao) => void;
  openRotation: (talhaoId?: string) => void;
}

interface Msg { who: 'me' | 'estela'; html: string; actions?: { label: string; run: () => void }[] }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const LANG_TAG: Record<string, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US', de: 'de-DE', zh: 'zh-CN', fr: 'fr-FR' };

const DIARY_RULES: [DiaryEntryType, RegExp, string | null][] = [
  ['irrigacao', /irrig|riego|regar|irrigat|bewaesser|arros|灌溉|irrigu/, 'mm'],
  ['chuva', /chuva|choveu|lluvia|llovio|\brain|pluie|regen|雨/, 'mm'],
  ['adubacao', /adub|fertiliz|abono|engrais|duengung|duengen|施肥/, 'kg/ha'],
  ['aplicacao', /aplica|defensiv|pulveriz|fungicid|herbicid|inseticid|spray|pestic|applic|施药/, 'L/ha'],
  ['colheita', /colhe|colhi|cosech|harvest|recolt|ernte|收获/, 'sc/ha'],
  ['plantio', /plantei|plantamos|plantio|sembr|siembra|semis|aussaat|播种|\bplanted\b|\bsowed\b/, null],
  ['monitoramento', /monitor|vistori|scout|inspec|巡查/, null],
  ['observacao', /observa|anota|nota\b|note\b|remarque|notiz|备注/, null],
];
const SKIP_RE = /pular|depois|skip|later|omitir|despues|passer|plus tard|ueberspringen|spaeter|跳过|稍后|nao sei|no se|i do not know|i don't know|weiss nicht|je ne sais pas|不知道|ainda nao|todavia no|not yet|pas encore|noch nicht|还没有/;
const NOTHING_RE = /sem novidade|nada de novo|sem ocorrencia|nenhuma|nothing new|sin novedades|rien de neuf|nichts neues|没有新情况|^nada$|^nothing$/;
const CROP_RE: [string, RegExp][] = [['soja', /soja|soy|大豆/], ['milho', /milho|corn|maiz|\bmais\b|玉米/], ['pasto', /pasto|pastagem|pasture|braquiaria|pâturage|pature|weide|牧草/], ['sorgo', /sorgo|sorghum|高粱/], ['feijao', /feijao|bean|frijol|haricot|bohne|豆/], ['algodao', /algodao|cotton|algodon|coton|baumwolle|棉/], ['trigo', /trigo|wheat|ble\b|weizen|小麦/], ['cana', /cana|sugarcane|caña|canne|zuckerrohr|甘蔗/]];
const MONTHS: string[][] = [
  ['janeiro', 'january', 'enero', 'janvier', 'januar'], ['fevereiro', 'february', 'febrero', 'fevrier', 'februar'], ['marco', 'march', 'marzo', 'mars', 'maerz'],
  ['abril', 'april', 'abril', 'avril', 'april'], ['maio', 'may', 'mayo', 'mai', 'mai'], ['junho', 'june', 'junio', 'juin', 'juni'],
  ['julho', 'july', 'julio', 'juillet', 'juli'], ['agosto', 'august', 'agosto', 'aout', 'august'], ['setembro', 'september', 'septiembre', 'septembre', 'september'],
  ['outubro', 'october', 'octubre', 'octobre', 'oktober'], ['novembro', 'november', 'noviembre', 'novembre', 'november'], ['dezembro', 'december', 'diciembre', 'decembre', 'dezember'],
];
const RECORD_VERB = /registr|anot|lanc|record|log\b|enregistr|eintrag|记录|grav|apunt|note\b/;

export class EstelaChat {
  private root!: HTMLElement;
  private panel!: HTMLElement;
  private list!: HTMLElement;
  private input!: HTMLInputElement;
  private msgs: Msg[] = [];
  private open = false;
  private recog: any = null;
  private listening = false;
  private speak = false;
  private pendingDiary: { type: DiaryEntryType; amount?: number; date: string; talhaoId?: string; note?: string } | null = null;
  private fromVoice = false;
  private ask: Pending | null = null;
  private amountAsked = false;
  private skipped = new Set<string>();
  private badgeTimer: number | undefined;

  constructor(private opts: EstelaOptions) {
    try { this.speak = localStorage.getItem('myroca_estela_voice_v1') === '1'; } catch { /* ignora */ }
    this.mount();
    this.refreshBadge();
    this.badgeTimer = window.setInterval(() => this.refreshBadge(), 60000);
  }

  /** Número de pendências que a Estrela quer perguntar (mostrado no botão). */
  public refreshBadge(): void {
    const n = computePending(this.opts.getFarm(), this.ref(), this.skipped).length;
    const el = this.root?.querySelector<HTMLElement>('#estela-badge');
    if (el) { el.textContent = String(n); el.style.display = n ? 'inline-flex' : 'none'; }
  }

  // ---------------- UI
  private mount(): void {
    this.root = document.createElement('div');
    this.root.id = 'estela-root';
    document.body.appendChild(this.root);
    this.renderShell();
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <button class="estela-fab" id="estela-fab" aria-label="${et('fab')}">
        <span class="estela-fab-ico">🧑‍🌾</span><span class="estela-fab-txt">${et('fab')}</span><span class="estela-badge" id="estela-badge" style="display:none">0</span>
      </button>
      <button class="estela-fab-mic" id="estela-fab-mic" title="${et('mic')}" aria-label="${et('mic')}">🎤</button>
      <div class="estela-panel" id="estela-panel" style="display:none" role="dialog" aria-label="${et('title')}">
        <div class="estela-head">
          <div class="estela-title">🌱 ${et('title')}</div>
          <div class="estela-head-btns">
            <button id="estela-speak" title="${this.speak ? et('speakOn') : et('speakOff')}">${this.speak ? '🔊' : '🔈'}</button>
            <button id="estela-clear" title="${et('clear')}">🗑️</button>
            <button id="estela-close" title="${et('close')}">&times;</button>
          </div>
        </div>
        <div class="estela-list" id="estela-list" aria-live="polite"></div>
        <div class="estela-chips" id="estela-chips">
          <button type="button" data-chip="pend">${pq('chipPend')}</button>
          ${['chip1', 'chip2', 'chip3', 'chip4'].map((k) => `<button type="button" data-chip="${k}">${et(k)}</button>`).join('')}
        </div>
        <form class="estela-form" id="estela-form">
          <button type="button" class="estela-mic" id="estela-mic" title="${et('mic')}">🎤</button>
          <input id="estela-input" type="text" autocomplete="off" placeholder="${et('placeholder')}" />
          <button type="submit" class="estela-send" title="${et('send')}">➤</button>
        </form>
      </div>`;
    this.panel = this.root.querySelector('#estela-panel')!;
    this.list = this.root.querySelector('#estela-list')!;
    this.input = this.root.querySelector('#estela-input')!;
    this.root.querySelector('#estela-fab')!.addEventListener('click', () => this.toggle());
    this.root.querySelector('#estela-fab-mic')!.addEventListener('click', () => { this.fromVoice = true; this.toggle(true); if (!this.listening) this.toggleMic(); });
    this.root.querySelector('#estela-close')!.addEventListener('click', () => this.toggle(false));
    this.root.querySelector('#estela-clear')!.addEventListener('click', () => { this.msgs = []; this.pendingDiary = null; this.hello(); });
    this.root.querySelector('#estela-speak')!.addEventListener('click', () => this.toggleSpeak());
    this.root.querySelector('#estela-mic')!.addEventListener('click', () => this.toggleMic());
    this.root.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => (b.onclick = () => (b.dataset.chip === 'pend' ? (this.fromVoice = false, this.msgs.push({ who: 'me', html: esc(pq('chipPend')) }), this.startPending()) : this.submit(et(b.dataset.chip!)))));
    this.root.querySelector<HTMLFormElement>('#estela-form')!.onsubmit = (e) => {
      e.preventDefault();
      const v = this.input.value.trim();
      if (v) { this.fromVoice = false; this.submit(v); }
    };
    this.paint();
  }

  /** Abre o chat (de fora, pela voz ou por outro botão). */
  public show(prompt?: string): void {
    this.toggle(true);
    if (prompt) this.submit(prompt);
  }

  public refreshLanguage(): void {
    const wasOpen = this.open;
    this.renderShell();
    if (wasOpen) this.toggle(true);
  }

  private toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? 'flex' : 'none';
    this.root.querySelector('#estela-fab')!.classList.toggle('hidden', this.open && window.innerWidth < 640);
    this.root.querySelector('#estela-fab-mic')!.classList.toggle('hidden', this.open);
    if (this.open) {
      if (!this.msgs.length) this.hello();
      setTimeout(() => this.input.focus(), 50);
    } else {
      this.stopMic();
      window.speechSynthesis?.cancel();
    }
  }

  private hello(): void {
    this.say(esc(et('hello')));
    const n = computePending(this.opts.getFarm(), this.ref(), this.skipped).length;
    if (n) this.say(esc(pq('intro', { n })), [
      { label: '✅ ' + pq('go'), run: () => this.startPending() },
      { label: pq('later'), run: () => { /* nada */ } },
    ]);
  }

  // ---------------- Pendências guiadas
  private startPending(): void {
    this.skipped.clear();
    this.nextPending();
  }

  private nextPending(): void {
    this.refreshBadge();
    const list = computePending(this.opts.getFarm(), this.ref(), this.skipped);
    if (!list.length) { this.ask = null; this.say(esc(pq(this.msgs.length > 2 ? 'done' : 'none'))); return; }
    const p = list[0];
    this.ask = p;
    const tl = this.talhoes().find((x) => x.id === p.talhaoId)!;
    const key = p.kind === 'diary' && p.days === undefined ? 'q_diary_none' : 'q_' + p.kind;
    this.say(esc(pq(key, { name: this.tName(tl), crop: translateCropName(tl.crop), d: p.days ?? 0 })), [
      { label: pq('skip'), run: () => this.skipCurrent() },
    ]);
    this.listenSoon();
  }

  private skipCurrent(say = true): void {
    if (this.ask) this.skipped.add(`${this.ask.kind}:${this.ask.talhaoId}`);
    this.ask = null;
    if (say) this.say(esc(pq('skipped')));
    this.nextPending();
  }

  /** Quando o produtor está falando, o microfone volta a abrir sozinho para a resposta. */
  private listenSoon(): void {
    if (!this.fromVoice) return;
    const go = () => { if (!this.listening && this.open) this.toggleMic(); };
    const wait = () => {
      if (window.speechSynthesis?.speaking) setTimeout(wait, 300); else setTimeout(go, 400);
    };
    setTimeout(wait, 500);
  }

  private parseDateText(raw: string): string | null {
    const n = norm(raw);
    const ref = this.ref();
    if (/\bhoje\b|\btoday\b|\bhoy\b|aujourd|\bheute\b|今天/.test(n)) return ref;
    if (/ontem|yesterday|\bayer\b|\bhier\b|gestern|昨天/.test(n)) return addDaysToDate(ref, -1);
    const ago = n.match(/(?:ha|hace|il y a|vor)\s*(\d{1,3})\s*(dias?|days?|jours?|tagen?)|(\d{1,3})\s*(?:dias?|days?)\s*(?:atras|ago)|(\d{1,3})\s*天前/);
    if (ago) return addDaysToDate(ref, -Number(ago[1] || ago[3] || ago[4]));
    const clamp = (y: number, m: number, d: number): string | null => {
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      let iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (iso > ref) iso = `${y - 1}-${iso.slice(5)}`;
      return iso;
    };
    const y0 = Number(ref.slice(0, 4));
    const num = n.match(/\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?:\s*[\/.-]\s*(\d{2,4}))?\b/);
    if (num) {
      const yy = num[3] ? (num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3])) : y0;
      return clamp(yy, Number(num[2]), Number(num[1]));
    }
    const zh = raw.match(/(\d{1,2})\s*月\s*(\d{1,2})/);
    if (zh) return clamp(y0, Number(zh[1]), Number(zh[2]));
    for (let m = 0; m < 12; m++) {
      for (const name of MONTHS[m]) {
        const re = new RegExp(`(?:\\b(\\d{1,2})(?:st|nd|rd|th|o|er)?\\s*(?:de|of|d')?\\s*${name}\\b)|(?:${name}\\s*(\\d{1,2})\\b)`);
        const mm = n.match(re);
        if (mm) return clamp(y0, m + 1, Number(mm[1] || mm[2]));
      }
    }
    const dia = n.match(/\b(?:dia|day|el dia|le|am)\s*(\d{1,2})\b/);
    if (dia) {
      const d = Number(dia[1]);
      const rm = Number(ref.slice(5, 7));
      const first = clamp(y0, rm, d);
      return first;
    }
    return null;
  }

  /** Trata a resposta do produtor a uma pergunta de pendência. Retorna true se tratou. */
  private handleAsk(text: string): boolean {
    const p = this.ask;
    if (!p) return false;
    const n = norm(text);
    const tl = this.talhoes().find((x) => x.id === p.talhaoId);
    if (!tl) { this.ask = null; return false; }
    const name = this.tName(tl);
    const reAsk = () => { this.say(esc(pq('noparse')), [{ label: pq('skip'), run: () => this.skipCurrent() }]); this.listenSoon(); return true; };
    const confirmSet = (what: string, apply: () => void): boolean => {
      this.say(esc(pq('confirm', { what })), [
        { label: '✅ ' + et('yes'), run: () => { apply(); this.opts.onDiaryAdded(tl); this.say(esc(pq('saved'))); this.ask = null; this.nextPending(); } },
        { label: '✖ ' + et('no'), run: () => { this.say(esc(et('cancelled'))); this.ask = null; this.nextPending(); } },
      ]);
      return true;
    };

    if (SKIP_RE.test(n) && !/\d/.test(n)) {
      if (p.kind === 'harvest' || p.kind === 'diary') this.say(esc(pq('notyet')));
      this.skipCurrent(p.kind !== 'harvest' && p.kind !== 'diary');
      return true;
    }
    if (p.kind === 'crop') {
      const hit = CROP_RE.find(([, re]) => re.test(n));
      if (!hit) return reAsk();
      const key = asCropKey(hit[0]);
      const std = CROP_STANDARD_NAME[key];
      if (!std) return reAsk();
      return confirmSet(`${name}: ${pq('f_crop')} = ${translateCropName(std)}`, () => { tl.crop = std; const c = DEFAULT_CYCLE[key]; if (c) tl.cycleDays = c; });
    }
    if (p.kind === 'planting') {
      const d = this.parseDateText(text);
      if (!d) return reAsk();
      const df = `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
      return confirmSet(`${name}: ${pq('f_planting')} = ${df}`, () => {
        tl.plantingDate = d;
        if (!tl.cycleDays) { const c = DEFAULT_CYCLE[asCropKey(tl.crop)]; if (c) tl.cycleDays = c; }
        if (tl.cycleDays) tl.harvestDateExpected = calculateExpectedHarvestDate(d, tl.cycleDays);
      });
    }
    if (p.kind === 'cultivar') {
      const v = text.trim().replace(/^(a |o |e |é |foi |plantei |cultivar |variedade )+/i, '').slice(0, 60);
      if (v.length < 2 || /\d{1,2}\s*[\/.-]\s*\d{1,2}/.test(v)) return reAsk();
      return confirmSet(`${name}: ${pq('f_cultivar')} = ${v}`, () => { tl.cultivar = v; });
    }
    if (p.kind === 'diary') {
      if (NOTHING_RE.test(n)) {
        return confirmSet(`${name}: ${pq('nothing')}`, () => {
          tl.diary = [...(tl.diary || []), { id: 'diary_' + Date.now().toString(36), date: this.ref(), type: 'monitoramento', note: pq('nothing') }];
        });
      }
      if (this.parseDiary(text, tl)) return true;
      return reAsk();
    }
    if (p.kind === 'harvest') {
      const d = this.parseDateText(text) || this.ref();
      const stripped = n.replace(/\d{1,2}\s*[\/.-]\s*\d{1,2}(?:\s*[\/.-]\s*\d{2,4})?/g, ' ');
      const am = stripped.match(/(\d+(?:[.,]\d+)?)\s*(?:sc|sacas?|sacos?|bags?)/) || stripped.match(/(\d{2,3}(?:[.,]\d+)?)\b/);
      this.pendingDiary = { type: 'colheita', amount: am ? Number(am[1].replace(',', '.')) : undefined, date: d, talhaoId: tl.id };
      this.confirmDiary();
      return true;
    }
    return false;
  }

  private paint(): void {
    this.list.innerHTML = '';
    this.msgs.forEach((m) => {
      const el = document.createElement('div');
      el.className = `estela-msg ${m.who}`;
      el.innerHTML = m.html;
      if (m.actions?.length) {
        const row = document.createElement('div');
        row.className = 'estela-actions';
        m.actions.forEach((a) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = a.label;
          b.onclick = () => { m.actions = []; a.run(); this.paint(); };
          row.appendChild(b);
        });
        el.appendChild(row);
      }
      this.list.appendChild(el);
    });
    this.list.scrollTop = this.list.scrollHeight;
  }

  private say(html: string, actions?: Msg['actions'], speakText?: string): void {
    this.msgs.push({ who: 'estela', html, actions });
    this.paint();
    if (this.speak || this.fromVoice) this.speakOut(speakText ?? html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' '));
  }

  private submit(text: string): void {
    this.input.value = '';
    this.msgs.push({ who: 'me', html: esc(text) });
    this.paint();
    this.root.querySelector<HTMLElement>('#estela-chips')!.style.display = 'none';
    void this.answer(text);
  }

  // ---------------- Voz
  private toggleSpeak(): void {
    this.speak = !this.speak;
    try { localStorage.setItem('myroca_estela_voice_v1', this.speak ? '1' : '0'); } catch { /* ignora */ }
    const b = this.root.querySelector<HTMLButtonElement>('#estela-speak')!;
    b.textContent = this.speak ? '🔊' : '🔈';
    b.title = this.speak ? et('speakOn') : et('speakOff');
    if (!this.speak) window.speechSynthesis?.cancel();
  }

  private speakOut(text: string): void {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_TAG[getCurrentLanguage()] || 'pt-BR';
    const v = synth.getVoices().find((x) => x.lang.toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    synth.speak(u);
  }

  private toggleMic(): void {
    if (this.listening) return this.stopMic();
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { this.say(esc(et('micNo'))); return; }
    this.recog = new SR();
    this.recog.lang = LANG_TAG[getCurrentLanguage()] || 'pt-BR';
    this.recog.interimResults = true;
    this.recog.maxAlternatives = 1;
    let finalText = '';
    this.recog.onresult = (e: any) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = txt; }
      this.input.value = txt;
    };
    this.recog.onerror = (e: any) => {
      this.listening = false; this.micUi();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.say(esc(et('micDenied')));
    };
    this.recog.onend = () => {
      this.listening = false; this.micUi();
      const v = (finalText || this.input.value).trim();
      if (v) { this.fromVoice = true; this.submit(v); }
    };
    try { this.recog.start(); this.listening = true; this.micUi(); this.input.placeholder = et('micOn'); } catch { this.listening = false; }
  }
  private stopMic(): void {
    try { this.recog?.stop(); } catch { /* ignora */ }
    this.listening = false; this.micUi();
  }
  private micUi(): void {
    this.root.querySelector('#estela-mic')?.classList.toggle('on', this.listening);
    if (!this.listening) this.input.placeholder = et('placeholder');
  }

  // ---------------- Inteligência local
  private ref(): string { return this.opts.getRefDate(); }
  private talhoes(): Talhao[] { return this.opts.getFarm().talhoes; }
  private tName = (tl: Talhao) => tl.name.replace(/\s*\[(Exemplo|Example|Ejemplo|Beispiel|Exemple|示例)\]\s*/i, '').trim();

  private findTalhao(q: string): Talhao | null {
    const list = this.talhoes();
    const n = norm(q);
    const num = n.match(/(?:talhao|field|campo|lote|parcela|parcelle|feld|地块)\s*0*(\d+)/) || (/^\s*0*(\d+)\s*$/.test(n) ? n.match(/0*(\d+)/) : null);
    if (num) {
      const k = Number(num[1]);
      const hit = list.find((x) => { const d = x.name.match(/(\d+)/); return d && Number(d[1]) === k; }) || list[k - 1];
      if (hit) return hit;
    }
    const byName = list.find((x) => n.includes(norm(this.tName(x))));
    if (byName) return byName;
    const ck = Object.entries({ soja: /soja|soy|大豆/, milho: /milho|corn|maiz|mais|玉米/, pasto: /pasto|pastagem|pasture/, sorgo: /sorgo|sorghum/, feijao: /feijao|bean|frijol/, algodao: /algodao|cotton/, trigo: /trigo|wheat/ })
      .find(([, re]) => re.test(n));
    if (ck) {
      const m = list.filter((x) => cropKey(x.crop) === ck[0]);
      if (m.length === 1) return m[0];
    }
    return null;
  }

  private parseDate(n: string): string {
    const ref = this.ref();
    if (/ontem|yesterday|ayer|gestern|\bhier\b|昨天/.test(n)) return addDaysToDate(ref, -1);
    const dm = n.match(/\b(\d{1,2})[\/-](\d{1,2})\b/);
    if (dm) return `${ref.slice(0, 4)}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    return ref;
  }

  private async answer(text: string): Promise<void> {
    const n = norm(text);
    const farm = this.opts.getFarm();
    try {
      // 0) Resposta a uma pendência perguntada pela Estrela
      if (this.ask && !this.pendingDiary && this.handleAsk(text)) return;
      // 1) Resposta a "qual talhão?"
      if (this.pendingDiary && this.amountAsked) {
        const m = n.match(/(\d+(?:[.,]\d+)?)/);
        if (m) this.pendingDiary.amount = Number(m[1].replace(',', '.'));
        else if (!SKIP_RE.test(n)) return void this.say(esc(pq('noparse')));
        this.amountAsked = false;
        return this.confirmDiary();
      }
      if (this.pendingDiary && !this.pendingDiary.talhaoId) {
        const tl = this.findTalhao(text);
        if (tl) { this.pendingDiary.talhaoId = tl.id; return this.continueDiary(); }
      }
      // 2) Registro no diário
      if (this.parseDiary(text)) return;
      // 3) Risco de plantio
      if (/posso (plantar|semear)|plantar|semear|plantio|sow|plant\b|puedo sembrar|sembrar|semer|aussaat|säen|saeen|播种|risco/.test(n) && !/rotac|rotation|rotacion|轮作/.test(n)) return this.plantRisk(this.findTalhao(text));
      // 4) Rotação
      if (/rotac|rotation|rotacion|proxima safra|next season|proxima zafra|轮作|fruchtfolge/.test(n)) {
        const tl = this.findTalhao(text);
        this.say(esc(et('rotationOpen')));
        this.opts.openRotation(tl?.id);
        return;
      }
      // 4b) Data de hoje
      if (/que dia|data de hoje|what day|what is the date|que fecha|welcher tag|quel jour|今天/.test(n)) {
        const d = new Date();
        const lang = LANG_TAG[getCurrentLanguage()] || 'pt-BR';
        const real = d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const cal = this.ref();
        const calTxt = `${cal.slice(8, 10)}/${cal.slice(5, 7)}/${cal.slice(0, 4)}`;
        const realIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        this.say(esc(real) + (cal !== realIso ? '<br><span class="estela-src">' + esc(et('calNote', { d: calTxt })) + '</span>' : ''), undefined, real);
        return;
      }
      // 5) Clima
      if (/clima|tempo agora|weather|temps|wetter|天气|chover|chuva hoje|llover/.test(n)) return this.weatherInfo();
      // 6) Situação dos talhões
      if (/como (esta|estao|anda)|situacao|status|how are|estado|zustand|wie stehen|comment vont|怎么样|talhoes|fields|lotes|parcelles/.test(n)) return this.fieldStatus(this.findTalhao(text));
      // 7) NASA
      if (/nasa/.test(n)) return void this.say(esc(et('nasaInfo')));
      // 8) Ajuda
      if (/ajuda|help|ayuda|hilfe|aide|帮助|o que voce faz|what can you/.test(n)) return void this.say(esc(et('help')));
      // 9) IA externa (se configurada)
      await this.askExternal(text);
    } catch (err) {
      console.error(err);
      this.say(esc(et('extFail')));
    }
  }


  /** Interpreta um registro de diário ditado/escrito. Com `forced`, o talhão já é conhecido. */
  private parseDiary(text: string, forced?: Talhao): boolean {
    const n = norm(text);
    const farm = this.opts.getFarm();
    const rule = DIARY_RULES.find(([, re]) => re.test(n));
    const stripped = n.replace(/(?:talhao|field|campo|lote|parcela|parcelle|feld|地块)\s*\d+/g, ' ');
    const amountM = stripped.match(/(\d+(?:[.,]\d+)?)\s*(mm|kg|litros?|l\b|sc|sacas?|sacos?)?/);
    const hasQuestion = /posso|pode |devo|puedo|debo|can i|should i|peux|dois-je|kann ich|可以|\?/.test(n);
    if (!rule || hasQuestion) return false;
    if (!forced && !(RECORD_VERB.test(n) || (amountM && rule[2]))) return false;
    const tl = forced || this.findTalhao(text);
    this.pendingDiary = {
      type: rule[0], amount: rule[2] && amountM ? Number(amountM[1].replace(',', '.')) : undefined,
      date: this.parseDate(n), talhaoId: tl?.id, note: rule[2] ? undefined : text,
    };
    this.continueDiary();
    return true;
  }

  /** Completa o registro: talhão, quantidade (quando faz sentido) e confirmação. */
  private continueDiary(): void {
    const p = this.pendingDiary;
    if (!p) return;
    const farm = this.opts.getFarm();
    if (!farm.talhoes.length) { this.say(esc(et('noTalhao'))); return; }
    if (!p.talhaoId) {
      if (farm.talhoes.length === 1) p.talhaoId = farm.talhoes[0].id;
      else {
        this.say(esc(et('askTalhao', { list: farm.talhoes.map((x) => this.tName(x)).join(', ') })),
          farm.talhoes.slice(0, 6).map((x) => ({ label: this.tName(x), run: () => { if (this.pendingDiary) { this.pendingDiary.talhaoId = x.id; this.continueDiary(); } } })));
        return;
      }
    }
    const unit = DIARY_RULES.find((r) => r[0] === p.type)?.[2];
    if (unit && p.amount === undefined && !this.amountAsked) {
      this.amountAsked = true;
      this.say(esc(pq('q_amount', { type: et('diary_' + p.type), unit })));
      this.listenSoon();
      return;
    }
    this.amountAsked = false;
    this.confirmDiary();
  }

  /** Chamado pelos botões grandes da tela simples (Chuva, Irrigação, ...). */
  public quickRecord(type: DiaryEntryType): void {
    this.toggle(true);
    this.root.querySelector<HTMLElement>('#estela-chips')!.style.display = 'none';
    this.ask = null; this.amountAsked = false;
    this.pendingDiary = { type, date: this.ref() };
    this.msgs.push({ who: 'me', html: esc(et('diary_' + type)) });
    this.paint();
    this.continueDiary();
  }

  /** Abre o chat já fazendo as perguntas pendentes. */
  public askPending(): void {
    this.toggle(true);
    this.root.querySelector<HTMLElement>('#estela-chips')!.style.display = 'none';
    this.startPending();
  }

  /** Abre o chat e já liga o microfone. */
  public listen(): void {
    this.fromVoice = true;
    this.toggle(true);
    if (!this.listening) this.toggleMic();
  }

  public pendingCount(): number {
    return computePending(this.opts.getFarm(), this.ref(), this.skipped).length;
  }

  private confirmDiary(): void {
    const p = this.pendingDiary!;
    const tl = this.talhoes().find((x) => x.id === p.talhaoId)!;
    const unit = DIARY_RULES.find((r) => r[0] === p.type)?.[2];
    const amount = p.amount !== undefined && unit ? ` ${p.amount} ${unit}` : '';
    const d = `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)}`;
    this.say(esc(et('confirmDiary', { type: et('diary_' + p.type), amount, name: this.tName(tl), date: d })), [
      { label: '✅ ' + et('yes'), run: () => this.saveDiary() },
      { label: '✖ ' + et('no'), run: () => { this.pendingDiary = null; this.amountAsked = false; this.say(esc(et('cancelled'))); if (this.ask) { const a = this.ask; this.ask = null; this.skipped.add(`${a.kind}:${a.talhaoId}`); this.nextPending(); } } },
    ]);
  }

  private saveDiary(): void {
    const p = this.pendingDiary;
    if (!p || !p.talhaoId) return;
    const tl = this.talhoes().find((x) => x.id === p.talhaoId);
    if (!tl) return;
    const entry: DiaryEntry = { id: 'diary_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: p.date, type: p.type };
    if (p.amount !== undefined) entry.amount = p.amount;
    if (p.note) entry.note = p.note;
    tl.diary = [...(tl.diary || []), entry];
    this.pendingDiary = null;
    this.opts.onDiaryAdded(tl);
    this.say(esc(et('saved', { name: this.tName(tl) })));
    this.refreshBadge();
    if (entry.type === 'colheita') {
      this.say(esc(pq('harvestSaved')), [{ label: pq('openRot'), run: () => this.opts.openRotation(tl.id) }]);
    }
    if (this.ask) { this.ask = null; this.nextPending(); }
  }

  private async plantRisk(only: Talhao | null): Promise<void> {
    const targets = (only ? [only] : this.talhoes()).filter((x) => x.coordinates && x.coordinates.length >= 3 && !calculateTalhaoCropStatus(x, this.ref()).isPasture);
    if (!targets.length) return void this.say(esc(et('noTalhao')));
    this.say(esc(et('thinking')));
    const lines: string[] = [];
    for (const tl of targets.slice(0, 6)) {
      try {
        const c = polygonCentroid(tl.coordinates);
        const series = await fetchNasaSeries(c.lat, c.lng, this.ref(), 30);
        const phase = calculateTalhaoCropStatus(tl, this.ref()).phase.key;
        const inCycle = !!tl.plantingDate && phase !== 'preparo';
        const a = assessPlanting(series, this.ref(), tl.diary, inCycle);
        const lvl = et(a.level === 'low' ? 'riskLow' : a.level === 'medium' ? 'riskMedium' : 'riskHigh');
        const adviceKey = inCycle
          ? a.level === 'low' ? 'agCropAdviceLow' : a.level === 'medium' ? 'agCropAdviceMedium' : 'agCropAdviceHigh'
          : a.level === 'low' ? 'agAdviceLow' : a.level === 'medium' ? 'agAdviceMedium' : 'agAdviceHigh';
        const bad = a.factors.filter((f) => f.severity > 0).slice(0, 2).map((f) => t(f.key as keyof TranslationDictionary, f.params));
        lines.push(`<strong>${esc(this.tName(tl))}</strong> — ${esc(et('risk', { level: lvl }))}. ${esc(t(adviceKey as keyof TranslationDictionary))}${bad.length ? '<br><small>' + bad.map(esc).join(' ') + '</small>' : ''}`);
      } catch {
        lines.push(`<strong>${esc(this.tName(tl))}</strong> — ${esc(et('nasaFail'))}`);
      }
    }
    this.say(`${esc(et('plantTitle'))}<br>${lines.join('<br><br>')}<br><br><span class="estela-src">🛰️ ${esc(et('nasaSrc'))}</span>`, undefined, lines.join('. ').replace(/<[^>]+>/g, ' '));
  }

  private fieldStatus(only: Talhao | null): void {
    const list = only ? [only] : this.talhoes();
    if (!list.length) return void this.say(esc(et('noTalhao')));
    const lines = list.map((tl) => {
      const st = calculateTalhaoCropStatus(tl, this.ref());
      const days = tl.plantingDate && tl.cycleDays ? et('statusDays', { d: st.daysPassed, t: tl.cycleDays }) : tl.crop ? '' : et('statusNoCrop');
      return `<strong>${esc(this.tName(tl))}</strong>: ${esc(translateCropName(tl.crop))}, ${esc(st.stageBadgeText)}. ${esc(days)}`;
    });
    this.say(lines.join('<br>'), undefined, lines.join('. ').replace(/<[^>]+>/g, ' '));
  }

  private async weatherInfo(): Promise<void> {
    const tls = this.talhoes();
    const c = tls.length && tls[0].coordinates?.length >= 3 ? polygonCentroid(tls[0].coordinates) : { lat: -17.8, lng: -51.07 };
    const w = await resolveWeather(c.lat, c.lng, undefined, this.ref());
    const temp = w.tempC !== null ? `${Math.round(w.tempC)}°C` : '';
    const src = w.source === 'openmeteo' ? 'Open-Meteo' : w.source === 'nasa' ? `NASA POWER (${w.note || ''})` : w.source === 'manual' ? wt('srcManual') : wt('srcEstimate');
    this.say(esc(et('weatherLine', { desc: et('wx_' + w.cond), temp, src })).replace(/, \./, '.'));
  }

  // ---------------- IA externa (opcional)
  private async askExternal(text: string): Promise<void> {
    const url = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ESTELA_URL;
    if (!url) return void this.say(esc(et('fallbackLocal')));
    this.say(esc(et('thinking')));
    const farm = this.opts.getFarm();
    const now = new Date();
    const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const ctx = {
      dataDeHojeReal: hoje,
      avisoDatas: 'dataDeHojeReal é a data de hoje de verdade. dataDoCalendarioDaFazenda é só a data simulada do calendário agrícola do app (pode estar diferente de hoje). Se perguntarem que dia é hoje, responda dataDeHojeReal.',
      dataDoCalendarioDaFazenda: this.ref(),
      language: getCurrentLanguage(),
      fields: farm.talhoes.map((tl) => {
        const st = calculateTalhaoCropStatus(tl, this.ref());
        return { name: this.tName(tl), crop: tl.crop, cultivar: tl.cultivar, areaHa: tl.areaHectares, plantingDate: tl.plantingDate, cycleDays: tl.cycleDays, stage: st.stageBadgeText, nextCrop: tl.nextCropPlan?.crop };
      }),
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, context: ctx }), signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const ans = String(j.answer || '').trim();
      if (!ans) throw new Error('empty');
      this.msgs.pop();
      this.say(esc(ans).replace(/\n/g, '<br>') + `<br><span class="estela-src">${esc(et('extNotice'))}</span>`, undefined, ans);
    } catch {
      this.msgs.pop();
      this.say(esc(et('extFail')));
    } finally {
      clearTimeout(timer);
    }
  }
}
