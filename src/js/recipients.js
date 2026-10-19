// Recipient "chips" widget (in-house, vanilla) for compose To/Cc/Bcc/Reply-To/Followup-To fields.
// Keeps Roundcube's original <textarea> as the value carrier (core reads it on send/draft) and
// mirrors the Elastic contract so core autocomplete (ksearch) and plugins keep working:
//   - the original element stays in the DOM (hidden), focus() on it is proxied to our input
//   - a 'change' on the original re-parses its value into chips (core sets it e.g. for reply-all)
//   - autocomplete: rcmail.ksearch_keydown / autocomplete_insert on our text input
import { escapeHtml } from './modal.js';

const ADDRESS = '(\\S+|("[^"]+"))@\\S+';
const RX_ANGLE = new RegExp('(<' + ADDRESS + '>)');
const RX_PLAIN = new RegExp('(' + ADDRESS + ')');
const RX_TOKENS = /(?=\S)[^",;]*(?:"[^\\"]*(?:\\[,;\S][^\\"]*)*"[^",;]*)*/g;

/** Extract recipients from free text; returns { recipients:[{name,email}], text: remainder } */
export function parseRecipients(text) {
  text = text.replace(/[,;\s]*[\r\n]+/g, ',').trim();
  const recipients = [];
  for (const raw of text.match(RX_TOKENS) || []) {
    let str = raw;
    if (!str.length) continue;
    let m = RX_ANGLE.exec(str) || RX_PLAIN.exec(str);
    if (!m) continue;
    text = text.replace(raw, '');
    let email = m[1];
    // space separated addresses "a@b c@d"
    while (str.length && str.indexOf(email) === 0) {
      recipients.push({
        name: '',
        email: email.replace(/(^<|>$)/g, '').replace(/[^\p{L}\p{N}]$/u, ''),
      });
      str = str.replace(email, '').trim();
      m = RX_ANGLE.exec(str) || RX_PLAIN.exec(str);
      if (!m) break;
      email = m[1];
    }
    if (m && str.length) {
      const name = str.replace(m[1], '').trim().replace(/^"|"$/g, '');
      recipients.push({ name, email: m[1].replace(/(^<|>$)/g, '') });
    }
  }
  text = text.replace(/[,;]+/, ',').replace(/^[,;\s]+/, '');
  return { recipients, text };
}

function formatRecipient(name, email) {
  if (!name) return email;
  const quoted = /[",;<>@]/.test(name)
    ? `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : name;
  return `${quoted} <${email}>`;
}

export function recipientInput(orig) {
  if (orig.dataset.gmChips) return;
  orig.dataset.gmChips = '1';
  const rc = window.rcmail;

  const list = document.createElement('ul');
  list.className = 'form-control recipient-input ac-input';
  const inputLi = document.createElement('li');
  inputLi.className = 'input';
  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.tabIndex = orig.tabIndex || 1;
  input.setAttribute('aria-label', orig.getAttribute('aria-label') || orig.id.replace(/^_/, ''));
  inputLi.append(input);
  list.append(inputLi);

  const apply = () => {
    const chips = [...list.querySelectorAll('li.recipient')].map((li) => li.dataset.recipient);
    const rest = input.value.trim();
    orig.value = chips.concat(rest ? [rest] : []).join(', ');
  };

  const insert = (name, email, replace) => {
    const li = document.createElement('li');
    li.className = 'recipient';
    li.dataset.recipient = formatRecipient(name, email);
    li.title = name ? `${name} <${email}>` : email;
    li.innerHTML = `<span class="name">${escapeHtml(name || email)}</span><span class="email">${escapeHtml(name ? ` <${email}>` : '')},</span><a class="button icon remove" href="#remove" title="${escapeHtml(rc?.get_label?.('delete') || 'Remove')}"></a>`;
    li.querySelector('a.remove').addEventListener('click', (e) => {
      e.preventDefault();
      li.remove();
      apply();
      input.focus();
      rc && rc.compose_type_activity++;
    });
    li.querySelector('.name').addEventListener('dblclick', () => {
      // edit in place: move the chip text back into the input
      li.remove();
      input.value = li.dataset.recipient + (input.value ? ', ' + input.value : '');
      apply();
      input.focus();
    });
    if (replace) replace.replaceWith(li);
    else inputLi.before(li);
    apply();
  };

  const update = (text) => {
    text = (text ?? input.value).replace(/[,;\s]+$/, '');
    const result = parseRecipients(text);
    for (const r of result.recipients) insert(r.name, r.email);
    input.value = result.text;
    apply();
    return result.recipients.length > 0;
  };

  const parse = (e, ac, trigger) => {
    if (trigger === false) return; // #8098
    let value = input.value;
    if (e?.type === 'paste') {
      const paste = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      value =
        value.substring(0, input.selectionStart) + paste + value.substring(input.selectionEnd);
      e.preventDefault();
    } else if (ac) {
      // #7231: autocomplete may fire change twice — drop a duplicate incomplete chip
      const last = list.querySelector('li.recipient:last-of-type');
      if (last && input.value.indexOf(last.dataset.recipient.replace(/[ ,]+$/, '')) > -1) {
        last.remove();
      }
    }
    update(value);
  };

  input.addEventListener('paste', parse);
  input.addEventListener('change', (e) => parse(e));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value.length) {
      list.querySelector('li.recipient:last-of-type')?.remove();
      apply();
      e.preventDefault();
      return;
    }
    if (e.key === ',' || e.key === ';' || (e.key === 'Enter' && !(rc && rc.ksearch_visible()))) {
      if (update()) e.preventDefault();
    }
    if (e.key === 'Tab') update();
  });
  input.addEventListener('blur', () => {
    list.classList.remove('focus');
    setTimeout(() => {
      if (!(rc && rc.ksearch_visible())) update();
    }, 150);
  });
  input.addEventListener('focus', () => list.classList.add('focus'));
  list.addEventListener('click', (e) => {
    if (!window.getSelection()?.toString().length && !e.target.closest('a')) input.focus();
  });

  // hide the original; proxy focus; re-parse when core sets its value
  Object.assign(orig.style, {
    position: 'absolute',
    opacity: '0',
    left: '-5000px',
    width: '10px',
    height: '10px',
  });
  orig.tabIndex = -1;
  orig.setAttribute('aria-hidden', 'true');
  orig.after(list);
  orig.addEventListener('focus', (e) => {
    e.preventDefault();
    input.focus();
  });
  orig.addEventListener('change', () => {
    list.querySelectorAll('li.recipient').forEach((li) => li.remove());
    input.value = orig.value;
    update();
  });
  // initial value
  if (orig.value) update(orig.value);

  // core autocomplete on our input (port of rcmail.init_address_input_events, no jQuery)
  if (rc) {
    const props =
      rc.env.autocomplete_threads > 0
        ? { threads: rc.env.autocomplete_threads, sources: rc.env.autocomplete_sources }
        : undefined;
    input.addEventListener('keydown', (e) => {
      if (rc.ksearch_keydown(e, input, props) === false) e.preventDefault();
    });
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('role', 'combobox');
    const hide = (e) => {
      if (rc.ksearch_pane && e.target === rc.ksearch_pane.get?.(0)) return;
      rc.ksearch_hide();
    };
    document.addEventListener('click', hide);
    document.addEventListener('scroll', hide, true);
    // when a contact is picked from the autocomplete list, core fires this after replacing text
    rc.addEventListener('autocomplete_insert', (e) => {
      if (e.field === input) parse(null, true);
    });
  }
  return { list, input, insert, update, apply };
}

export const recipients = {
  parse: parseRecipients,
  attach: recipientInput,
  init(root = document) {
    for (const el of root.querySelectorAll('[data-recipient-input]')) recipientInput(el);
  },
};
