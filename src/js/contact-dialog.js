// "Add to address book" opens the real contact form (framed contactedit page) in a modal,
// pre-filled with the sender's name and address, instead of silently creating a bare contact.
import { openDialog } from './modal.js';
import { toast } from './toast.js';

const label = (n, fb) => {
  const s = window.rcmail?.get_label?.(n);
  return s && s !== n ? s : fb;
};

function parseAddress(value) {
  const m = String(value || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: String(value || '').trim() };
}

function splitName(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: name, last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export function openAddContact(value, source) {
  const rc = window.rcmail;
  const { name, email } = parseAddress(value);
  const frame = document.createElement('iframe');
  frame.className = 'gm-picker-frame';
  frame.title = label('addcontact', 'Add contact');
  const params = { _framed: 1, _gm_dialog: 1 };
  if (source) params._source = source;
  frame.src = rc.url('addressbook/add', params);
  let saved = false;
  const handle = openDialog({
    title: label('addcontact', 'Add contact'),
    content: frame,
    dialogClass: 'gm-dialog-lg gm-contact-dialog',
    buttons: [
      { text: label('cancel', 'Cancel') },
      {
        text: label('save', 'Save'),
        mainaction: true,
        click() {
          frame.contentWindow?.rcmail?.command('save');
        },
      },
    ],
  });
  frame.addEventListener('load', () => {
    let w;
    try {
      w = frame.contentWindow;
    } catch {
      return;
    }
    const url = String(w.location.href);
    if (/_action=show/.test(url) || (saved && /_action=add/.test(url) === false)) {
      // save succeeded → core redirected to the contact card
      handle.close();
      toast.show(label('addedsuccessfully', 'Contact added'), { type: 'confirmation' });
      rc.triggerEvent('gm:contact-added', { email });
      return;
    }
    w.document.documentElement.classList.add('gm-in-dialog');
    const set = (id, v) => {
      const el = w.document.getElementById(id);
      if (el && v && !el.value) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    const { first, last } = splitName(name);
    set('ff_firstname', first);
    set('ff_surname', last);
    set('ff_email0', email);
    (w.document.getElementById('ff_firstname') || w.document.getElementById('ff_email0'))?.focus();
    // the framed page posts the form; core then navigates the frame to the saved contact
    w.rcmail?.addEventListener('beforesave', () => {
      saved = true;
    });
  });
  return handle;
}

export const contactDialog = {
  init() {
    const rc = window.rcmail;
    if (!rc || rc.env.framed || rc.env.extwin) return;
    rc.add_contact = function (value, reload, source) {
      if (!value) return;
      openAddContact(value, source);
    };
  },
};
