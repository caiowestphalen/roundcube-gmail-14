// Multi-value text field ("smart field"): Roundcube/plugins (managesieve) render a <textarea>
// with one value per line and call UI.smart_field_init(field); the skin replaces it with a list
// of single-line inputs (Enter adds a row, Backspace on an empty row removes it) inside
// <div id="<field.id>_list" class="multi-input">. Plugin JS addresses that id directly.
function row(area, value, field, after) {
  const wrap = document.createElement('div');
  wrap.className = 'input-group';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control';
  input.value = value;
  input.name = `${field.name}[]`;
  if (field.dataset.size) input.size = field.dataset.size;
  if (field.title) input.title = field.title;
  if (field.placeholder) input.placeholder = field.placeholder;
  const reset = document.createElement('a');
  reset.href = '#';
  reset.className = 'icon reset input-group-text';
  reset.title = window.rcmail?.get_label?.('delete') || 'Delete';
  reset.innerHTML = '<i class="ico ico-close" aria-hidden="true"></i>';
  wrap.append(input, reset);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      row(area, '', field, wrap).querySelector('input').focus();
    } else if (
      (e.key === 'Backspace' || e.key === 'Delete') &&
      input.value === '' &&
      area.children.length > 1
    ) {
      e.preventDefault();
      const sib = wrap.previousElementSibling || wrap.nextElementSibling;
      wrap.remove();
      sib?.querySelector('input')?.focus();
    }
  });
  reset.addEventListener('click', (e) => {
    e.preventDefault();
    if (area.children.length > 1) {
      const sib = wrap.nextElementSibling || wrap.previousElementSibling;
      wrap.remove();
      sib?.querySelector('input')?.focus();
    } else {
      input.value = '';
      input.focus();
    }
  });
  for (const el of [input, reset]) {
    el.addEventListener('focus', () => area.parentElement.classList.add('focused'));
    el.addEventListener('blur', () => area.parentElement.classList.remove('focused'));
  }
  if (after) after.after(wrap);
  else area.append(wrap);
  return wrap;
}

export function smartFieldInit(field) {
  if (!field || document.getElementById(`${field.id}_list`)) return;
  const area = document.createElement('div');
  area.className = 'multi-input';
  area.id = `${field.id}_list`;
  const content = document.createElement('div');
  content.className = 'content';
  const feedback = document.createElement('div');
  feedback.className = 'invalid-feedback';
  area.append(content, feedback);

  const values = field.value ? field.value.split('\n') : [''];
  for (const v of values) row(content, v, field);

  if (field.disabled || field.dataset.hidden) area.hidden = true;
  // the textarea must not be posted; the inputs carry name[] values instead
  field.disabled = true;
  field.classList.add('gm-smart-source');
  if (field.classList.contains('is-invalid')) {
    area.classList.add('is-invalid');
    feedback.textContent = field.dataset.errorMsg || '';
  }
  field.after(area);
}

export function smartFieldReset(field, data = []) {
  const area = document.getElementById(`${field.id}_list`)?.querySelector('.content');
  if (!area) return;
  area.innerHTML = '';
  for (const v of data.length ? data : ['']) row(area, v, field);
}
