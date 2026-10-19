// Generic behaviour for every rcube_list_widget list on the page:
//  - empty state: core marks lists with data-label-msg / data-label-ext; we render a proper
//    empty-state block (icon + text) after the list when it has no visible rows (port of the
//    Elastic MutationObserver approach, no jQuery).
//  - loading state: `requestlist` / `responseafterlist` toggle html.gm-list-loading so the list
//    column can show skeleton rows while a folder / search loads.
const ICONS = { messagelist: 'ico-inbox', contactlist: 'ico-contacts', folderlist: 'ico-folder' };

function emptyStateFor(list) {
  const info = document.createElement('div');
  info.className = 'gm-list-empty hidden';
  const icon = Object.keys(ICONS).find((k) => list.classList.contains(k));
  info.innerHTML = `<i class="ico ${icon ? ICONS[icon] : 'ico-description'}" aria-hidden="true"></i><span class="gm-list-empty-text"></span>`;
  list.after(info);
  let timer;
  const update = () => {
    info.classList.add('hidden');
    clearTimeout(timer);
    if (window.rcmail?.busy || !list.offsetParent) {
      timer = setTimeout(update, 250);
      return;
    }
    timer = setTimeout(() => {
      const body = list.tagName === 'UL' ? list : list.tBodies[0] || list;
      const visible = [...body.children].some(
        (r) =>
          r.offsetParent !== null || (r.tagName === 'TR' && r.style.display !== 'none' && !r.hidden)
      );
      let msg = list.dataset.labelMsg;
      if (!msg || visible) return;
      const ext = list.dataset.labelExt;
      const cmd = list.dataset.createCommand;
      if (ext && (!cmd || window.rcmail?.commands?.[cmd])) msg += ` ${ext}`;
      info.querySelector('.gm-list-empty-text').textContent = msg;
      info.classList.remove('hidden');
    }, 50);
  };
  new MutationObserver(update).observe(list, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
  update();
}

export const lists = {
  init() {
    document.querySelectorAll('ul[data-label-msg], table[data-label-msg]').forEach(emptyStateFor);
    const rc = window.rcmail;
    if (!rc) return;
    const html = document.documentElement;
    rc.addEventListener('requestlist', () => html.classList.add('gm-list-loading'));
    rc.addEventListener('requestsearch', () => html.classList.add('gm-list-loading'));
    for (const ev of ['responseafterlist', 'responseaftersearch', 'listupdate']) {
      rc.addEventListener(ev, () => html.classList.remove('gm-list-loading'));
    }
  },
};
