// Gmail-style quick compose: a floating window (bottom-right, 600×616) hosting Roundcube's compose
// page in an iframe (extwin mode = no chrome), with minimize / full-screen / close. Multiple windows
// stack to the left. Core is steered here by env.compose_extwin + our rcmail.open_window override.
import { toast } from './toast.js';
import { modal } from './modal.js';

const html = document.documentElement;
const label = (n) => (window.rcmail?.get_label ? rcmail.get_label(n) : n);
const windows = [];
const W = 600;
const GAP = 16;

function relayout() {
  const available = window.innerWidth - GAP * 2;
  const width = (w) => (w.state === 'min' ? 260 : Math.min(W, available));
  const total = () =>
    windows.filter((w) => w.state !== 'full').reduce((n, w) => n + width(w) + 12, -12);
  for (const w of windows) {
    if (total() <= available) break;
    if (w.state === 'normal') {
      w.state = 'min';
      w.el.dataset.state = 'min';
    }
  }
  let right = GAP;
  for (const w of windows) {
    if (w.state === 'full') continue;
    w.el.style.right = `${right}px`;
    right += width(w) + 12;
  }
  html.classList.toggle(
    'gm-cwin-fullscreen',
    windows.some((w) => w.state === 'full')
  );
}
window.addEventListener('resize', relayout);

function isDirty(win) {
  try {
    const rc = win.frame.contentWindow.rcmail;
    return !!(rc && typeof rc.cmp_hash === 'string' && rc.cmp_hash !== rc.compose_field_hash());
  } catch {
    return false;
  }
}

function frameRc(win) {
  try {
    return win.frame.contentWindow.rcmail;
  } catch {
    return null;
  }
}

export const composeWindow = {
  get count() {
    return windows.length;
  },

  open(url) {
    // no more than 3 windows, like Gmail
    if (windows.length >= 3) {
      toast.show(label('windowopenerror') || 'Too many compose windows', { type: 'warning' });
      return null;
    }
    const el = document.createElement('div');
    el.className = 'gm-cwin';
    el.dataset.state = 'normal';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `
      <div class="gm-cwin-head">
        <span class="gm-cwin-title">${label('compose')}</span>
        <span class="gm-cwin-actions">
          <button type="button" class="gm-cwin-btn min" title="${label('minimize') || 'Minimize'}"><i class="ico ico-minimize" aria-hidden="true"></i></button>
          <button type="button" class="gm-cwin-btn full" title="${label('fullscreen') || 'Full screen'}"><i class="ico ico-fullscreen" aria-hidden="true"></i></button>
          <button type="button" class="gm-cwin-btn close" title="${label('close')}"><i class="ico ico-close" aria-hidden="true"></i></button>
        </span>
      </div>
      <div class="gm-cwin-loading" aria-hidden="true"><div class="gm-skel gm-skel-row"></div><div class="gm-skel gm-skel-row"></div><div class="gm-skel gm-skel-row short"></div><div class="gm-skel gm-skel-block"></div></div>
      <iframe class="gm-cwin-frame" title="${label('compose')}"></iframe>`;
    const frame = el.querySelector('iframe');
    const win = { el, frame, state: 'normal', url };
    windows.push(win);
    document.body.append(el);
    relayout();
    requestAnimationFrame(() => el.classList.add('gm-visible'));

    frame.src = url + (url.includes('?') ? '&' : '?') + '_extwin=1';
    frame.addEventListener('load', () => {
      el.classList.add('gm-loaded');
      try {
        const w = frame.contentWindow;
        w.document.documentElement.classList.add('gm-in-popup');
        // core calls window.close() after a successful send / when the user cancels in extwin mode
        w.close = () => this.close(win, true);
        // title follows the subject
        const subj = w.document.getElementById('compose-subject');
        const setTitle = () => {
          el.querySelector('.gm-cwin-title').textContent = subj?.value?.trim() || label('compose');
        };
        subj?.addEventListener('input', setTitle);
        setTitle();
        // opening an external window from inside the popup → real window
        if (w.rcmail) w.rcmail.env.gm_popup = true;
        w.document.addEventListener('keydown', (e) => {
          if (
            e.key === 'Escape' &&
            !modal.isOpen &&
            !w.document.querySelector('.popupmenu.gm-open')
          ) {
            this.close(win);
          }
        });
      } catch {
        /* cross-origin (should not happen) */
      }
    });

    el.querySelector('.min').addEventListener('click', () => this.toggleMin(win));
    el.querySelector('.full').addEventListener('click', () => this.toggleFull(win));
    el.querySelector('.close').addEventListener('click', () => this.close(win));
    el.querySelector('.gm-cwin-head').addEventListener('dblclick', (e) => {
      if (!e.target.closest('button')) this.toggleMin(win);
    });
    return win;
  },

  toggleMin(win) {
    win.state = win.state === 'min' ? 'normal' : 'min';
    win.el.dataset.state = win.state;
    html.classList.remove('gm-cwin-fullscreen');
    relayout();
  },

  toggleFull(win) {
    win.state = win.state === 'full' ? 'normal' : 'full';
    win.el.dataset.state = win.state;
    html.classList.toggle('gm-cwin-fullscreen', win.state === 'full');
    relayout();
  },

  async close(win, sent = false) {
    if (!windows.includes(win) || win.closing) return;
    win.closing = true;
    const rc = frameRc(win);
    if (!sent && rc && isDirty(win)) {
      // Dismissing the dialog keeps the editor open; only Discard abandons changes.
      const choice = await new Promise((resolve) => {
        const content = document.createElement('p');
        content.className = 'gm-dialog-text';
        content.textContent = label('savemessage');
        const answer = (value) => (e, h) => {
          resolve(value);
          h.close();
        };
        modal.open({
          title: label('compose'),
          content,
          buttons: [
            { text: label('cancel'), click: answer('cancel') },
            { text: label('discard'), click: answer('discard') },
            { text: label('save'), mainaction: true, click: answer('save') },
          ],
          onClose: () => resolve('cancel'),
        });
      });
      if (choice === 'cancel') {
        win.closing = false;
        return;
      }
      if (choice === 'save') {
        rc.command('savedraft');
        const saved = await new Promise((resolve) => {
          const t0 = Date.now();
          const poll = () => {
            // Only the successful server response updates cmp_hash and draft_id.
            if (!rc.busy && rc.env.draft_id && !isDirty(win)) resolve(true);
            else if (Date.now() - t0 > 15000) resolve(false);
            else setTimeout(poll, 100);
          };
          setTimeout(poll, 300);
        });
        if (!saved) {
          win.closing = false;
          toast.show(label('errorsaving'), { type: 'error' });
          return;
        }
      } else {
        rc.compose_skip_unsavedcheck = true;
      }
    }
    windows.splice(windows.indexOf(win), 1);
    win.el.classList.remove('gm-visible');
    html.classList.remove('gm-cwin-fullscreen');
    setTimeout(() => win.el.remove(), 180);
    relayout();
    if (sent && !rc?.env?.gm_discarded) toast.show(label('messagesent'), { type: 'confirmation' });
  },

  closeAll() {
    for (const w of [...windows]) this.close(w);
  },
};
