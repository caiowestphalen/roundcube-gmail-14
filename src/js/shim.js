// `UI` global — the Elastic-compatible API surface bundled plugins call (managesieve, enigma,
// vcard_attachments, contextmenu …) plus our own helpers used from templates.
import { modal, openDialog, escapeHtml } from './modal.js';
import { popup } from './popup.js';
import { toast } from './toast.js';
import { theme } from './theme.js';
import { layout } from './layout.js';
import { controls } from './controls.js';
import { compose } from './compose.js';
import { composeWindow } from './compose-window.js';
import { smartFieldInit, smartFieldReset } from './smart-field.js';

const label = (n) => (window.rcmail?.get_label ? rcmail.get_label(n) : n);

export function buildUI() {
  const UI = {
    modal,
    popup,
    toast,
    theme,
    layout,
    controls,
    compose,
    composeWindow,

    // ---- template helpers ----
    toggle_nav() {
      layout.toggleNav();
      return false;
    },

    about_dialog(elem) {
      const rc = window.rcmail;
      rc.http_request('settings/about', {}, rc.set_busy(true, 'loading'), 'GET');
      // core answers with rcmail.about_dialog? No — it renders a page; we fetch the about template.
      fetch(`${rc.url('settings/about', { _framed: 1 })}`, { credentials: 'same-origin' })
        .then((r) => r.text())
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const body = doc.querySelector('#layout-content, body');
          const div = document.createElement('div');
          div.className = 'gm-about';
          div.innerHTML = body ? body.innerHTML : html;
          div.querySelectorAll('script, link, style').forEach((n) => n.remove());
          openDialog({
            title: label('about'),
            content: div,
            buttons: [{ text: label('close'), mainaction: true }],
          });
        })
        .finally(() => rc.set_busy(false));
      elem?.blur?.();
      return false;
    },

    // list selection mode (checkbox column) — same contract as Elastic
    toggle_list_selection(obj, list_id) {
      const list = document.getElementById(list_id);
      if (!list) return;
      const on = list.classList.toggle('withselection');
      obj?.classList.toggle('selected', on);
      const w = window.rcmail?.[list.dataset.list];
      if (w) w.checkbox_selection = on;
      return false;
    },

    // ---- plugin ABI (Elastic names) ----
    switch_nav_list(elem) {
      // managesieve: <a onclick="UI.switch_nav_list(this)"> toggles between filters/sets lists
      const target = elem?.getAttribute('data-target') || elem?.dataset.target;
      document
        .querySelectorAll('#layout-sidebar .listbox')
        .forEach((l) => l.classList.toggle('hidden', target && l.id !== target));
      return false;
    },
    smart_field_init(field) {
      smartFieldInit(field);
    },
    smart_field_reset(field, data) {
      smartFieldReset(field, data);
    },
    form_errors(tips) {
      // show first error near its field + toast
      for (const t of tips || []) {
        const el = document.getElementById(t[0]) || document.querySelector(`[name="${t[0]}"]`);
        el?.classList.add('is-invalid');
        el?.setAttribute('title', t[2] || t[1] || '');
        el?.addEventListener('input', () => el.classList.remove('is-invalid'), { once: true });
      }
      if (tips?.length) {
        toast.show(tips[0][2] || tips[0][1] || label('formincomplete'), { type: 'error' });
      }
    },
    compose_status(id, status) {
      const el =
        document.getElementById(`compose-${id}`) ||
        document.querySelector(`.gm-compose-status[data-status="${id}"]`);
      if (el) el.classList.toggle('active', !!status);
    },
    recipient_selector(field, opts = {}) {
      // Use the compose contact list core has already initialized. It must remain in
      // this document: core looks up the recipient field and contact list by ID.
      const rc = window.rcmail;
      const picker = document.getElementById('recipient-dialog');
      if (!rc || !picker || !rc.contact_list) return false;
      const parent = picker.parentNode;
      if (field) rc.env.focused_field = `#_${field}`;
      rc.contact_list.clear_selection();
      rc.contact_list.multiselect = opts.multiselect ?? true;
      picker.classList.remove('popupmenu');
      picker.style.display = 'block';
      const close = (event) => {
        document.getElementById(`_${event.field}`)?.dispatchEvent(new Event('change'));
        handle.close();
      };
      const handle = openDialog({
        title: label(opts.title || 'insertcontact'),
        content: picker,
        local: true,
        dialogClass: 'gm-dialog-lg gm-recipient-dialog',
        buttons: [
          { text: label('cancel') },
          {
            text: label(opts.button || 'insert'),
            mainaction: true,
            click: () => {
              if (opts.action) {
                opts.action();
                handle.close();
              } else rc.command('add-recipient', field);
            },
          },
        ],
        onClose: () => {
          rc.removeEventListener('add-recipient', close);
          parent.append(picker);
          picker.classList.add('popupmenu');
          picker.style.display = 'none';
          document.querySelector(opts.focus || rc.env.focused_field)?.focus();
        },
      });
      rc.addEventListener('add-recipient', close);
      picker.querySelector('#directorylist a')?.click();
      return false;
    },
    header_reset(id) {
      return compose.header_reset(id);
    },
    // message view: "▾" toggles the detailed header table; "Headers" opens the raw headers
    headers_show(toggle) {
      const details = document.querySelector('#message-header .header-headers');
      const link = document.querySelector('#message-header a.headers-summary');
      if (!details) return false;
      const show = toggle === true ? !details.classList.contains('details') : !!toggle;
      details.classList.toggle('details', show);
      link?.classList.toggle('expanded', show);
      link?.setAttribute('aria-expanded', show ? 'true' : 'false');
      return false;
    },
    headers_dialog() {
      const rc = window.rcmail;
      if (!rc) return false;
      const box = document.createElement('div');
      box.className = 'gm-headers-raw';
      box.textContent = rc.get_label('loading');
      const handle = openDialog({
        title: rc.get_label('allheaders') || 'Headers',
        content: box,
        dialogClass: 'gm-dialog-lg',
        buttons: [{ text: rc.get_label('close') }],
      });
      fetch(rc.url('headers', { _uid: rc.env.uid, _mbox: rc.env.mailbox, _framed: 1 }), {
        credentials: 'same-origin',
      })
        .then((r) => r.text())
        .then((txt) => {
          const doc = new DOMParser().parseFromString(txt, 'text/html');
          const src =
            doc.querySelector('#dialog-content, .dialog-content, .headers-raw') || doc.body;
          box.innerHTML = src.innerHTML.replace(/^\s+|\s+$/g, '');
          box.querySelectorAll('script, style').forEach((n) => n.remove());
        })
        .catch(() => {
          box.textContent = rc.get_label('errorloadingheaders') || 'Could not load headers';
        });
      return handle ? false : false;
    },

    show_sidebar() {
      return false;
    },
    show_popup(name, show, ev) {
      return window.rcmail?.show_menu(name, show, ev);
    },
    escapeHtml,
    version: '0.1.0',
  };
  return UI;
}
