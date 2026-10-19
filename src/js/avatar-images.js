// Real sender avatars (gm_avatars plugin): every letter avatar for an address gets a lazy image
// request to plugin.gm_avatars.photo; on 200 the image replaces the letter, on 404 the letter
// stays. Misses are remembered per page so the same address is asked once.
const seen = new Map(); // email → 'ok' | 'miss' | Promise

function endpoint() {
  return window.rcmail?.env?.gm_avatars?.url || null;
}

function probe(email) {
  const url = endpoint();
  if (!url) return Promise.resolve(null);
  if (seen.has(email)) {
    return Promise.resolve(
      seen.get(email) === 'ok' ? `${url}&_email=${encodeURIComponent(email)}` : null
    );
  }
  const src = `${url}&_email=${encodeURIComponent(email)}`;
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      seen.set(email, 'ok');
      resolve(src);
    };
    img.onerror = () => {
      seen.set(email, 'miss');
      resolve(null);
    };
    img.src = src;
  });
  seen.set(email, p);
  return p;
}

export function upgrade(el, email) {
  if (!el || !email || el.dataset.gmImg) return;
  el.dataset.gmImg = '1';
  probe(email.toLowerCase()).then((src) => {
    if (!src || !el.isConnected) return;
    const img = document.createElement('img');
    img.className = 'gm-avatar-img';
    img.alt = '';
    img.src = src;
    img.loading = 'lazy';
    el.textContent = '';
    el.style.background = 'transparent';
    el.append(img);
  });
}

export const avatarImages = {
  upgrade,
  // observe letter avatars that carry data-email (mail.js / contacts.js set it)
  init() {
    if (!endpoint()) return;
    const scan = (root) =>
      root
        .querySelectorAll?.('.gm-avatar-initial[data-email]')
        .forEach((el) => upgrade(el, el.dataset.email));
    scan(document);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          // address tagged (or changed) after the node was inserted
          delete m.target.dataset.gmImg;
          upgrade(m.target, m.target.dataset.email);
          continue;
        }
        for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-email'],
    });
  },
};
