// Snackbar / toast notifications (in-house). Roundcube calls rcmail.display_message(msg, type,
// timeout) which appends into gui_objects.message (#messagestack) and fires the 'message' event;
// we take over rendering so every notice, error, confirmation and "loading…" looks like Gmail's
// bottom-left snackbar, with an optional action (e.g. Undo).
const stackId = 'messagestack';
const timers = new WeakMap();

function container() {
  let c = document.getElementById(stackId);
  if (!c) {
    c = document.createElement('div');
    c.id = stackId;
    document.body.append(c);
  }
  c.classList.add('gm-toasts');
  c.setAttribute('role', 'status');
  c.setAttribute('aria-live', 'polite');
  return c;
}

/**
 * Show a toast.
 * @param {string} text
 * @param {object} o { type: notice|confirmation|warning|error|loading, timeout(ms), action:{label,onClick}, html }
 */
export function show(text, o = {}) {
  const c = container();
  const t = document.createElement('div');
  t.className = `gm-toast ${o.type || 'notice'}`;
  const msg = document.createElement('span');
  msg.className = 'gm-toast-text';
  if (o.html) msg.innerHTML = text;
  else msg.textContent = text;
  t.append(msg);
  if (o.type === 'loading') {
    const sp = document.createElement('span');
    sp.className = 'gm-spinner';
    t.prepend(sp);
  }
  if (o.action) {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'gm-toast-action';
    a.textContent = o.action.label;
    a.addEventListener('click', () => {
      o.action.onClick?.();
      dismiss(t);
    });
    t.append(a);
  }
  if (o.dismissible !== false && o.type !== 'loading') {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'gm-toast-close';
    x.innerHTML = '<i class="ico ico-close" aria-hidden="true"></i>';
    x.setAttribute('aria-label', window.rcmail?.get_label?.('close') || 'Close');
    x.addEventListener('click', () => dismiss(t));
    t.append(x);
  }
  // keep at most 3 visible (dismiss() removes asynchronously — never loop on the count)
  const live = [...c.children].filter((k) => !k.classList.contains('gm-leaving'));
  for (const old of live.slice(0, Math.max(0, live.length - 2))) dismiss(old);
  c.append(t);
  requestAnimationFrame(() => t.classList.add('gm-visible'));
  const timeout =
    o.timeout ??
    (o.type === 'error' || o.type === 'warning' ? 8000 : o.type === 'loading' ? 0 : 4000);
  if (timeout > 0) {
    timers.set(
      t,
      setTimeout(() => dismiss(t), timeout)
    );
  }
  return t;
}

export function dismiss(t) {
  if (!t || !t.parentNode) return;
  clearTimeout(timers.get(t));
  t.classList.remove('gm-visible');
  t.classList.add('gm-leaving');
  setTimeout(() => t.remove(), 180);
}

export const toast = {
  show,
  dismiss,
  init() {
    container();
    // Roundcube inserts its own element (event.object) into #messagestack; restyle it in place and
    // add close/timeout behaviour so core semantics (hide_message, message locks) keep working.
    const html = document.documentElement;
    const inPopup = html.classList.contains('gm-in-popup');
    window.rcmail?.addEventListener('message', (e) => {
      // core passes a jQuery object — unwrap to the DOM node
      const node = e.object && (e.object.nodeType ? e.object : e.object[0]);
      if (!node) return;
      const text = node.textContent.trim();
      // compose: "Message saved to Drafts." becomes a quiet status line, like Gmail's "Draft saved"
      if (
        window.rcmail.env.action === 'compose' &&
        e.type === 'confirmation' &&
        text === window.rcmail.get_label('messagesaved')
      ) {
        const when = new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });
        const status = `${text.replace(/\.$/, '')} · ${when}`;
        document.querySelectorAll('.gm-compose-status').forEach((s) => (s.textContent = status));
        try {
          window.frameElement
            ?.closest('.gm-cwin')
            ?.querySelector('.gm-cwin-title')
            ?.setAttribute('data-status', status);
        } catch {
          /* cross-origin */
        }
        window.rcmail.hide_message(node);
        return;
      }
      // inside the quick-compose popup: show toasts in the main window instead of the 600px frame
      if (inPopup && e.type !== 'loading') {
        try {
          window.parent.UI.toast.show(text, { type: e.type });
          window.rcmail.hide_message(node);
          return;
        } catch {
          /* fall through */
        }
      }
      node.classList.add('gm-toast', 'gm-visible');
      if (e.type === 'loading') {
        const sp = document.createElement('span');
        sp.className = 'gm-spinner';
        node.prepend(sp);
      }
      if (e.type !== 'loading' && !node.querySelector('.gm-toast-close')) {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'gm-toast-close';
        x.innerHTML = '<i class="ico ico-close" aria-hidden="true"></i>';
        x.addEventListener('click', () => rcmail.hide_message(node));
        node.append(x);
      }
      // keep at most 3 visible — core removes asynchronously (fade), so never loop on the count
      const kids = [...container().children].filter((k) => !k.classList.contains('gm-leaving'));
      for (const old of kids.slice(0, Math.max(0, kids.length - 3))) {
        old.classList.add('gm-leaving');
        rcmail.hide_message(old);
      }
    });
  },
};
