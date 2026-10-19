// Sender name/address from the markup core renders for an address (rcmContactAddress).
// Core puts the address in `title` only when it shows the name alone; with the
// "show email with name" preference (or a spoof warning) the text is "Name <email>"
// and there is no title, so every consumer must go through this helper.
const ANGLE = /^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/;

export function parseSender(el) {
  if (!el) return { name: '', email: '' };
  const text = (el.textContent || '').trim();
  let email = (el.getAttribute?.('title') || '').trim();
  let name = text;
  const m = text.match(ANGLE);
  if (m) {
    name = m[1] || m[2];
    email = email || m[2];
  } else if (!email && /^[^\s<>]+@[^\s<>]+$/.test(text)) {
    email = text;
  }
  if (!email) {
    const href = el.getAttribute?.('href') || '';
    if (href.startsWith('mailto:')) email = decodeURIComponent(href.slice(7).split('?')[0]);
  }
  return { name: name || email, email: email.toLowerCase() };
}
