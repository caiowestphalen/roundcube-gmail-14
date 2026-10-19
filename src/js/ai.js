// AI assistant UI (needs the gm_core plugin: env.gm_ai + action plugin.gm_core.ai).
//  - message view: "Summarize" chip in the header links → summary card above the body
//  - compose: sparkle button in the bottom bar → menu of operations → result dialog with
//    Insert / Replace / Copy / Regenerate. Text comes from the editor selection or whole body.
import { openDialog, modal, escapeHtml } from './modal.js';
import { popup } from './popup.js';
import { toast } from './toast.js';

const html = document.documentElement;
let seq = 0;
const pending = new Map();

const t = (n) => window.rcmail?.get_label?.(n, 'gm_core') || n;

function request(op, data = {}) {
  const rc = window.rcmail;
  const reqid = `ai${++seq}`;
  return new Promise((resolve, reject) => {
    pending.set(reqid, { resolve, reject });
    rc.http_post(
      'plugin.gm_core.ai',
      { _op: op, _reqid: reqid, _lang: rc.env.locale || '', ...data },
      rc.set_busy(true, 'gm_core.aiworking')
    );
    setTimeout(() => {
      if (pending.has(reqid)) {
        pending.delete(reqid);
        reject(new Error('timeout'));
      }
    }, 90000);
  });
}

function onResult(p) {
  const w = pending.get(p.reqid);
  if (!w) return;
  pending.delete(p.reqid);
  if (p.error) w.reject(new Error(p.error));
  else w.resolve(p.text || '');
}

// ---- editor helpers (compose)
function editorText(selectionOnly) {
  const rc = window.rcmail;
  const ed = rc?.editor;
  if (!ed) return '';
  if (ed.is_html?.()) {
    const tm = window.tinymce?.get(ed.id);
    if (!tm) return '';
    if (selectionOnly) {
      const sel = tm.selection.getContent({ format: 'text' });
      if (sel.trim()) return sel;
    }
    return tm.getContent({ format: 'text' });
  }
  const ta = document.getElementById(ed.id);
  if (!ta) return '';
  if (selectionOnly && ta.selectionStart !== ta.selectionEnd) {
    return ta.value.slice(ta.selectionStart, ta.selectionEnd);
  }
  return ta.value;
}

function editorInsert(text, mode) {
  const rc = window.rcmail;
  const ed = rc?.editor;
  if (!ed) return;
  if (ed.is_html?.()) {
    const tm = window.tinymce?.get(ed.id);
    if (!tm) return;
    const htmlText = escapeHtml(text)
      .split(/\n{2,}/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('');
    if (mode === 'replace') tm.setContent(htmlText);
    else tm.execCommand('mceInsertContent', false, htmlText);
    tm.focus();
  } else {
    const ta = document.getElementById(ed.id);
    if (!ta) return;
    if (mode === 'replace') ta.value = text;
    else {
      const s = ta.selectionStart ?? ta.value.length;
      const e = ta.selectionEnd ?? s;
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    }
    ta.focus();
  }
  rc.compose_type_activity++;
}

function resultDialog(op, text, rerun) {
  const box = document.createElement('div');
  box.className = 'gm-ai-result';
  box.innerHTML = `<div class="gm-ai-text"></div><div class="gm-ai-note"><i class="ico ico-ai" aria-hidden="true"></i>${escapeHtml(t('aidisclaimer'))}</div>`;
  box.querySelector('.gm-ai-text').textContent = text;
  const buttons = [
    { text: t('regenerate'), click: () => rerun() },
    {
      text: t('copy'),
      click: () =>
        navigator.clipboard
          ?.writeText(text)
          .then(() => toast.show(t('copy') + ' ✓', { type: 'confirmation' })),
    },
  ];
  if (op !== 'summarize') {
    buttons.push({
      text: t('replace'),
      click: (e, h) => {
        editorInsert(text, 'replace');
        h.close();
      },
    });
    buttons.push({
      text: t('insert'),
      mainaction: true,
      click: (e, h) => {
        editorInsert(text, 'insert');
        h.close();
      },
    });
  } else buttons.push({ text: window.rcmail.get_label('close'), mainaction: true });
  openDialog({ title: t(op), content: box, dialogClass: 'gm-dialog-lg gm-ai-dialog', buttons });
}

async function runComposeOp(op) {
  const rc = window.rcmail;
  let prompt = '';
  if (op === 'write' || op === 'translate' || op === 'reply') {
    prompt = await modal.prompt(op === 'translate' ? t('translate') : t('aiprompt'), {
      title: t(op),
      placeholder: op === 'translate' ? 'English' : '',
    });
    if (prompt === null) return;
  }
  const selectionOnly = [
    'improve',
    'shorten',
    'expand',
    'fix',
    'translate',
    'formal',
    'friendly',
  ].includes(op);
  const text = editorText(selectionOnly);
  if (!text.trim() && op !== 'write') {
    toast.show(t('aiempty'), { type: 'warning' });
    return;
  }
  const subject = document.getElementById('compose-subject')?.value || '';
  const go = () =>
    request(op, { _text: text, _subject: subject, _prompt: prompt })
      .then((out) => resultDialog(op, out, go))
      .catch((e) =>
        toast.show(e.message === 'timeout' ? t('aierror') : e.message, { type: 'error' })
      );
  go();
  void rc;
}

function initCompose() {
  const tools = document.querySelector('.gm-compose-tools');
  if (!tools) return;
  const ops = (window.rcmail.env.gm_ai?.ops || []).filter((o) => o !== 'summarize');
  if (!ops.length) return;
  const menu = document.createElement('div');
  menu.id = 'ai-menu';
  menu.className = 'popupmenu gm-menu';
  menu.innerHTML = `<h3 class="voice">${escapeHtml(t('aiassistant'))}</h3><ul class="menu listing" role="menu">${ops
    .map(
      (o) =>
        `<li role="menuitem"><a href="#${o}" class="ai-op ai-${o}" data-op="${o}">${escapeHtml(t(o))}</a></li>`
    )
    .join('')}</ul>`;
  document.body.append(menu);
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a.ai-op');
    if (!a) return;
    e.preventDefault();
    popup.closeAll();
    runComposeOp(a.dataset.op);
  });
  // registered as a real command/button so core's toolbar state handling keeps it enabled
  const rc = window.rcmail;
  const btn = document.createElement('a');
  btn.href = '#ai';
  btn.id = 'gm-ai-button';
  btn.className = 'ai'; // core's set_button swaps the whole className: keep 'ai' in every state
  btn.title = t('aiassistant');
  btn.setAttribute('role', 'button');
  btn.innerHTML = `<span class="inner">${escapeHtml(t('ai'))}</span>`;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!btn.classList.contains('disabled')) popup.open('ai-menu', btn, e);
  });
  tools.insertBefore(btn, tools.querySelector('a.more') || null);
  rc.register_command('plugin.gm-ai', (props, obj, e) => popup.open('ai-menu', btn, e), true);
  if (Array.isArray(rc.env.compose_commands) && !rc.env.compose_commands.includes('plugin.gm-ai')) {
    rc.env.compose_commands.push('plugin.gm-ai');
  }
  rc.register_button(
    'plugin.gm-ai',
    'gm-ai-button',
    'link',
    'ai active',
    'ai active selected',
    'ai active'
  );
  rc.addEventListener('init', () => rc.enable_command('plugin.gm-ai', true));
}

function initMessage() {
  const links = document.querySelector('#message-header .header-links');
  const body = document.getElementById('messagebody');
  if (!links || !body || !(window.rcmail.env.gm_ai?.ops || []).includes('summarize')) return;
  const a = document.createElement('a');
  a.href = '#summarize';
  a.className = 'ai-summarize';
  a.textContent = t('summarize');
  links.prepend(a);
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const existing = document.querySelector('.gm-ai-card');
    if (existing) {
      existing.remove();
      return;
    }
    const text = body.innerText.slice(0, 24000);
    const subjectNode = document.querySelector('#message-header h2.subject')?.cloneNode(true);
    subjectNode?.querySelectorAll('script, style, .voice, a, button').forEach((n) => n.remove());
    const subject = subjectNode?.textContent.replace(/\s+/g, ' ').trim() || '';
    request('summarize', { _text: text, _subject: subject })
      .then((out) => {
        const card = document.createElement('div');
        card.className = 'gm-ai-card';
        card.innerHTML = `<div class="gm-ai-card-head"><i class="ico ico-ai" aria-hidden="true"></i><span>${escapeHtml(t('summary'))}</span><button type="button" class="gm-icon-btn gm-ai-card-close" title="${escapeHtml(window.rcmail.get_label('close'))}"><i class="ico ico-close" aria-hidden="true"></i></button></div><div class="gm-ai-card-text"></div><div class="gm-ai-note">${escapeHtml(t('aidisclaimer'))}</div>`;
        card.querySelector('.gm-ai-card-text').textContent = out;
        card.querySelector('.gm-ai-card-close').addEventListener('click', () => card.remove());
        body.parentElement.insertBefore(card, body);
      })
      .catch((err) =>
        toast.show(err.message === 'timeout' ? t('aierror') : err.message, { type: 'error' })
      );
  });
}

export const ai = {
  init() {
    const rc = window.rcmail;
    if (!rc?.env?.gm_ai?.enabled) return;
    html.classList.add('gm-ai');
    rc.addEventListener('plugin.gm_core.ai_result', onResult);
    if (rc.env.task === 'mail' && rc.env.action === 'compose') initCompose();
    if (rc.env.task === 'mail' && ['show', 'preview'].includes(rc.env.action)) initMessage();
  },
};
