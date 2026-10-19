// Phone FAB: on small screens the content panel (and its toolbar) is hidden while the list is
// shown, so "create" actions marked data-fab="true" (new contact, new response, new filter,
// new folder, new identity…) get a floating action button inside the list panel that proxies
// the original toolbar button.
import { layout } from './layout.js';

export const fab = {
  init() {
    const src = document.querySelector(
      '#layout-content .toolbar a[data-fab], #layout-content .toolbar a.create'
    );
    const list = document.getElementById('layout-list');
    if (!src || !list || document.querySelector('.gm-fab')) return;
    const btn = document.createElement('a');
    btn.href = '#';
    btn.className = 'gm-fab';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', src.title || src.textContent.trim());
    btn.dataset.tip = src.title || src.textContent.trim();
    btn.innerHTML = '<i class="ico ico-add" aria-hidden="true"></i>';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      src.click();
      if (layout.mode === 'phone' || layout.mode === 'small') {
        document.getElementById('layout-content')?.classList.add('selected');
        list.classList.remove('selected');
      }
    });
    const sync = () => btn.classList.toggle('disabled', src.classList.contains('disabled'));
    new MutationObserver(sync).observe(src, { attributes: true, attributeFilter: ['class'] });
    sync();
    list.append(btn);
  },
};
