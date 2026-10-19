// Letter avatars (Gmail-style colored circle with the first letter) for the account button and
// message list rows. Color is derived from the name so it is stable per sender.
const PALETTE = [
  '#0b57d0',
  '#146c2e',
  '#b3261e',
  '#7d4ea3',
  '#00639b',
  '#8a5a00',
  '#3c6e56',
  '#a8437c',
  '#5b5f97',
  '#0f766e',
];

export function colorFor(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initial(name) {
  const s = String(name || '').trim();
  const m = s.match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}

export function apply(el, name) {
  el.textContent = initial(name);
  el.style.background = colorFor(name);
}

export const avatars = {
  colorFor,
  initial,
  apply,
  init() {
    for (const el of document.querySelectorAll('.gm-avatar-initial[data-username]')) {
      apply(el, el.dataset.username);
    }
  },
};
