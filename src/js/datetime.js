// In-house date / date-time picker. Replaces native <input type="date|datetime-local"> UI and the
// jQuery-UI datepicker Roundcube attaches to input.datepicker (birthday, vacation dates). The
// original input stays in the DOM as the value carrier (plugins read it); we hide it, show a
// button with the formatted value, and write back in the format each consumer expects:
//   datetime-local → YYYY-MM-DDTHH:MM, date → YYYY-MM-DD, .datepicker → rcmail.env.date_format.
const html = document.documentElement;
let open = null;

const pad = (n) => String(n).padStart(2, '0');
const lang = () => document.documentElement.lang || navigator.language || 'en';
const monthName = (d) =>
  new Intl.DateTimeFormat(lang(), { month: 'long', year: 'numeric' }).format(d);
const weekdays = () => {
  const first = firstDay();
  const fmt = new Intl.DateTimeFormat(lang(), { weekday: 'narrow' });
  // 2024-01-07 is a Sunday
  return Array.from({ length: 7 }, (_, i) => ({
    s: fmt.format(new Date(2024, 0, 7 + ((first + i) % 7))),
    dow: (first + i) % 7,
  }));
};
const firstDay = () => {
  const v = window.rcmail?.env?.first_day_of_week;
  return typeof v === 'number' ? v : 1;
};

// jQuery-UI style pattern (yy-mm-dd, d.m.yy …) → string
function formatJq(d, fmt) {
  return fmt.replace(/yy|y|mm|m|dd|d|MM|M|DD|D/g, (t) => {
    switch (t) {
      case 'yy':
        return String(d.getFullYear());
      case 'y':
        return String(d.getFullYear()).slice(-2);
      case 'mm':
        return pad(d.getMonth() + 1);
      case 'm':
        return String(d.getMonth() + 1);
      case 'dd':
        return pad(d.getDate());
      case 'd':
        return String(d.getDate());
      case 'MM':
        return new Intl.DateTimeFormat(lang(), { month: 'long' }).format(d);
      case 'M':
        return new Intl.DateTimeFormat(lang(), { month: 'short' }).format(d);
      case 'DD':
        return new Intl.DateTimeFormat(lang(), { weekday: 'long' }).format(d);
      case 'D':
        return new Intl.DateTimeFormat(lang(), { weekday: 'short' }).format(d);
      default:
        return t;
    }
  });
}

function parseValue(v, kind) {
  if (!v) return null;
  if (kind === 'datetime') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const dmy = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

function serialize(d, kind, jqFormat) {
  if (kind === 'datetime') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (kind === 'jq') return formatJq(d, jqFormat || 'yy-mm-dd');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function display(d, kind) {
  if (!d) return '';
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  if (kind === 'datetime') Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return new Intl.DateTimeFormat(lang(), opts).format(d);
}

function label(n, fallback) {
  const s = window.rcmail?.get_label?.(n);
  return s && s !== n ? s : fallback;
}

function closePicker() {
  if (!open) return;
  open.el.remove();
  open.btn.setAttribute('aria-expanded', 'false');
  open = null;
}

function openPicker(input, btn, kind, jqFormat) {
  closePicker();
  const now = new Date();
  let value =
    parseValue(input.value, kind) ||
    (kind === 'datetime' ? new Date(now.getTime() + 60 * 60 * 1000) : null);
  let view = new Date((value || now).getFullYear(), (value || now).getMonth(), 1);
  let hours = value ? value.getHours() : now.getHours();
  let minutes = value ? Math.round(value.getMinutes() / 5) * 5 : 0;

  const el = document.createElement('div');
  el.className = 'gm-dt gm-menu gm-open';
  el.setAttribute('role', 'dialog');
  el.tabIndex = -1;
  document.body.append(el);
  open = { el, btn, input };

  const commit = (d) => {
    const out = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      kind === 'datetime' ? hours : 0,
      kind === 'datetime' ? minutes % 60 : 0
    );
    input.value = serialize(out, kind, jqFormat);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    btn.querySelector('.gm-dt-value').textContent = display(out, kind);
    btn.classList.remove('gm-dt-empty');
    closePicker();
    btn.focus();
  };

  const render = () => {
    const days = [];
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = (first.getDay() - firstDay() + 7) % 7;
    const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < start; i++) days.push(null);
    for (let d = 1; d <= dim; d++) days.push(d);
    while (days.length % 7) days.push(null);
    const isSame = (d, ref) =>
      ref &&
      d === ref.getDate() &&
      view.getMonth() === ref.getMonth() &&
      view.getFullYear() === ref.getFullYear();
    el.innerHTML = `
      <div class="gm-dt-head">
        <button type="button" class="gm-icon-btn gm-dt-prev" title="${label('previous', 'Previous')}"><i class="ico ico-chevron-left" aria-hidden="true"></i></button>
        <span class="gm-dt-month" aria-live="polite">${monthName(view)}</span>
        <button type="button" class="gm-icon-btn gm-dt-next" title="${label('next', 'Next')}"><i class="ico ico-chevron-right" aria-hidden="true"></i></button>
      </div>
      <div class="gm-dt-grid" role="grid">
        ${weekdays()
          .map((w) => `<span class="gm-dt-dow">${w.s}</span>`)
          .join('')}
        ${days.map((d) => (d ? `<button type="button" class="gm-dt-day${isSame(d, now) ? ' today' : ''}${isSame(d, value) ? ' selected' : ''}" data-day="${d}">${d}</button>` : '<span></span>')).join('')}
      </div>
      ${
        kind === 'datetime'
          ? `
      <div class="gm-dt-time">
        <label class="gm-dt-field"><span>${label('hours', 'Hour')}</span><input type="text" inputmode="numeric" class="gm-dt-h" value="${pad(hours)}" maxlength="2" aria-label="${label('hours', 'Hour')}"></label>
        <span class="gm-dt-colon">:</span>
        <label class="gm-dt-field"><span>${label('minutes', 'Minute')}</span><input type="text" inputmode="numeric" class="gm-dt-m" value="${pad(minutes % 60)}" maxlength="2" aria-label="${label('minutes', 'Minute')}"></label>
      </div>`
          : ''
      }
      <div class="gm-dt-actions">
        <button type="button" class="gm-btn gm-btn-text gm-dt-clear">${label('clear', 'Clear')}</button>
        <span class="gm-dt-spacer"></span>
        <button type="button" class="gm-btn gm-btn-text gm-dt-today">${label('today', 'Today')}</button>
        ${kind === 'datetime' ? `<button type="button" class="gm-btn gm-btn-filled gm-dt-ok">${label('ok', 'OK')}</button>` : ''}
      </div>`;
    el.querySelector('.gm-dt-prev').onclick = () => {
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      render();
    };
    el.querySelector('.gm-dt-next').onclick = () => {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      render();
    };
    el.querySelectorAll('.gm-dt-day').forEach((b) => {
      b.onclick = () => {
        const d = new Date(view.getFullYear(), view.getMonth(), +b.dataset.day);
        if (kind === 'datetime') {
          value = d;
          render();
        } else commit(d);
      };
    });
    el.querySelector('.gm-dt-clear').onclick = () => {
      input.value = '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      btn.querySelector('.gm-dt-value').textContent = btn.dataset.placeholder || '';
      btn.classList.add('gm-dt-empty');
      closePicker();
    };
    el.querySelector('.gm-dt-today').onclick = () => {
      view = new Date(now.getFullYear(), now.getMonth(), 1);
      if (kind === 'datetime') {
        value = new Date(now);
        render();
      } else commit(now);
    };
    el.querySelector('.gm-dt-ok')?.addEventListener('click', () => commit(value || now));
    el.querySelector('.gm-dt-h')?.addEventListener('input', (e) => {
      hours = Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0));
    });
    el.querySelector('.gm-dt-m')?.addEventListener('input', (e) => {
      minutes = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
    });
  };
  render();

  // position under the trigger, flip above when needed
  const r = btn.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const left = Math.min(r.left, document.documentElement.clientWidth - w - 8);
  let top = r.bottom + 4;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${top}px`;
  btn.setAttribute('aria-expanded', 'true');
  (el.querySelector('.gm-dt-day.selected') || el.querySelector('.gm-dt-day')).focus();

  el.addEventListener('keydown', (e) => {
    const cur = e.target.closest('.gm-dt-day');
    const move = (delta) => {
      const all = [...el.querySelectorAll('.gm-dt-day')];
      const i = all.indexOf(cur);
      const n = all[i + delta];
      if (n) n.focus();
      else {
        view = new Date(view.getFullYear(), view.getMonth() + (delta > 0 ? 1 : -1), 1);
        render();
        const list = el.querySelectorAll('.gm-dt-day');
        (delta > 0 ? list[0] : list[list.length - 1]).focus();
      }
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      closePicker();
      btn.focus();
    } else if (cur && e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
    } else if (cur && e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
    } else if (cur && e.key === 'ArrowDown') {
      e.preventDefault();
      move(7);
    } else if (cur && e.key === 'ArrowUp') {
      e.preventDefault();
      move(-7);
    }
  });
}

function enhance(input) {
  if (input.dataset.gmDt) return;
  input.dataset.gmDt = '1';
  const kind = input.type === 'datetime-local' ? 'datetime' : input.type === 'date' ? 'date' : 'jq';
  const jqFormat = window.rcmail?.env?.date_format || 'yy-mm-dd';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gm-dt-btn';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.dataset.placeholder =
    input.placeholder ||
    input.title ||
    label(
      kind === 'datetime' ? 'date' : 'date',
      kind === 'datetime' ? 'Pick date & time' : 'Pick a date'
    );
  const v = parseValue(input.value, kind);
  btn.innerHTML = `<i class="ico ${kind === 'datetime' ? 'ico-schedule' : 'ico-calendar'}" aria-hidden="true"></i><span class="gm-dt-value">${v ? display(v, kind) : btn.dataset.placeholder}</span>`;
  btn.classList.toggle('gm-dt-empty', !v);
  if (input.disabled) btn.disabled = true;
  input.classList.add('gm-dt-native');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.after(btn);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (open?.btn === btn) closePicker();
    else openPicker(input, btn, kind, jqFormat);
  });
  input.addEventListener('change', () => {
    const d = parseValue(input.value, kind);
    btn.querySelector('.gm-dt-value').textContent = d ? display(d, kind) : btn.dataset.placeholder;
    btn.classList.toggle('gm-dt-empty', !d);
  });
}

export const datetime = {
  enhance,
  scan(root = document) {
    root
      .querySelectorAll('input[type="datetime-local"], input[type="date"], input.datepicker')
      .forEach(enhance);
  },
  init() {
    this.scan();
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) this.scan(n.querySelectorAll ? n : document);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointerdown', (e) => {
      if (open && !e.target.closest('.gm-dt, .gm-dt-btn')) closePicker();
    });
    window.addEventListener('resize', closePicker);
    window.addEventListener('blur', closePicker);
    html.addEventListener('gm:popup-close', closePicker);
  },
};
