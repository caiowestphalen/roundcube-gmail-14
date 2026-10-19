// Extra launcher tiles from the gm_core plugin (env.gm_apps: label, url, icon, color, target).
import { escapeHtml } from './modal.js';

export const apps = {
  init() {
    const list = window.rcmail?.env?.gm_apps;
    const ul = document.querySelector('#apps-menu .gm-apps-card .menu.listing');
    if (!Array.isArray(list) || !list.length || !ul) return;
    for (const app of list) {
      const li = document.createElement('li');
      li.setAttribute('role', 'menuitem');
      const a = document.createElement('a');
      a.href = app.url;
      a.target = app.target || '_blank';
      if (a.target === '_blank') a.rel = 'noopener';
      a.className = 'gm-app-ext';
      a.innerHTML = `<i class="ico ico-${escapeHtml(app.icon || 'language')}" aria-hidden="true"></i>${escapeHtml(app.label)}`;
      if (app.color) a.style.setProperty('--gm-app-color', app.color);
      li.append(a);
      ul.append(li);
    }
  },
};
