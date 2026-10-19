// Popup menus (in-house). Elements with `data-popup="<id>"` open the element with that id as a
// floating menu anchored to the trigger. Handles positioning, outside-click/Escape close, focus
// return, keyboard navigation, nested menus, and Roundcube's menu-open/menu-close events so
// core (`rcmail.show_menu`/`hide_menu`) and plugins keep working.
const openMenus = [];

function place(menu, anchor) {
  const r = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // submenu (anchor sits inside an open menu): open beside the parent, top-aligned with the item
  const parent = anchor.closest('.popupmenu.gm-open, .gm-menu.gm-open');
  if (parent && parent !== menu) {
    const pr = parent.getBoundingClientRect();
    let left = pr.right + 8;
    if (left + m.width > vw - 8) left = Math.max(8, pr.left - m.width - 8);
    let top = r.top - 6;
    if (top + m.height > vh - 8) top = Math.max(8, vh - m.height - 8);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    return;
  }
  const alignRight = menu.dataset.align === 'right' || r.left + m.width > vw - 8;
  let left = alignRight ? r.right - m.width : r.left;
  let top = r.bottom + 4;
  if (top + m.height > vh - 8) top = Math.max(8, r.top - m.height - 4);
  left = Math.max(8, Math.min(left, vw - m.width - 8));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function focusables(menu) {
  return [
    ...menu.querySelectorAll('a[href]:not(.disabled), button:not([disabled]), [tabindex="0"]'),
  ].filter((el) => el.offsetParent !== null);
}

export function isOpen(id) {
  return openMenus.some((m) => m.menu.id === id);
}

export function open(id, anchor, event) {
  const menu = typeof id === 'string' ? document.getElementById(id) : id;
  if (!menu) return false;
  if (isOpen(menu.id)) return close(menu.id);
  // close siblings (keep ancestors when opening a submenu)
  if (!(anchor && openMenus.some((m) => m.menu.contains(anchor)))) closeAll();

  // Match Roundcube's menu contract: menus must escape hidden/clipped source panels.
  document.body.append(menu);
  menu.querySelectorAll('ul.toolbarmenu').forEach((list) => list.classList.add('menu'));
  if (menu.id === 'folder-selector') {
    for (const a of menu.querySelectorAll('a')) {
      if (a.dataset.gmFolderInset) continue;
      // Core stores folder IDs in jQuery data and emits depth as inline 16px steps.
      const depth = Math.max(0, parseFloat(a.style.paddingLeft) || 0) / 16;
      a.style.paddingLeft = '';
      a.style.setProperty('--gm-folder-depth', depth);
      a.dataset.gmFolderInset = '1';
    }
  }
  menu.classList.add('gm-open');
  menu.setAttribute('role', menu.getAttribute('role') || 'menu');
  if (anchor) place(menu, anchor);
  else if (event) {
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
  }
  openMenus.push({ menu, anchor, returnFocus: document.activeElement });
  anchor?.setAttribute('aria-expanded', 'true');
  anchor?.classList.add('gm-active');
  const first = focusables(menu)[0];
  if (first && !(event && event.pointerType === 'mouse')) first.focus({ preventScroll: true });
  window.rcmail?.triggerEvent('menu-open', {
    name: menu.id,
    obj: menu,
    props: { menu: menu.id },
    originalEvent: event,
  });
  return false;
}

export function close(id) {
  const idx = openMenus.findIndex((m) => m.menu.id === id);
  if (idx < 0) return false;
  // closing a menu closes its submenus too
  for (const m of openMenus.splice(idx)) {
    m.menu.classList.remove('gm-open');
    if (m.menu.style.display === 'block') m.menu.style.display = ''; // core's jQuery .show() leftovers
    m.anchor?.setAttribute('aria-expanded', 'false');
    m.anchor?.classList.remove('gm-active');
    window.rcmail?.triggerEvent('menu-close', {
      name: m.menu.id,
      obj: m.menu,
      props: { menu: m.menu.id },
    });
    if (m.returnFocus && document.body.contains(m.returnFocus)) {
      m.returnFocus.focus({ preventScroll: true });
    }
  }
  return false;
}

export function closeAll() {
  while (openMenus.length) close(openMenus[openMenus.length - 1].menu.id);
}

function onDocumentPointer(e) {
  if (!openMenus.length) return;
  // Select listboxes are portalled to body; they still belong to the open popup.
  if (e.target.closest('.gm-select-list')) return;
  if (openMenus.some((m) => m.menu.contains(e.target) || m.anchor?.contains(e.target))) return;
  closeAll();
}

function onKey(e) {
  if (!openMenus.length) return;
  const { menu } = openMenus[openMenus.length - 1];
  if (e.key === 'Escape') {
    e.preventDefault();
    close(menu.id);
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
    const items = focusables(menu);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }
}

export const popup = {
  open,
  close,
  closeAll,
  isOpen,

  init() {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-popup]');
      if (trigger && !trigger.classList.contains('disabled')) {
        e.preventDefault();
        open(trigger.dataset.popup, trigger, e);
        return;
      }
      // a menu item click closes its menu (unless it opens a submenu)
      const item = e.target.closest('.gm-open .menu a, .gm-open [role="menuitem"]');
      if (
        item &&
        !item.dataset.popup &&
        !item.classList.contains('disabled') &&
        item.getAttribute('aria-haspopup') !== 'true' &&
        !item.querySelector('.folder-selector-link')
      ) {
        closeAll();
      }
    });
    document.addEventListener('pointerdown', onDocumentPointer, true);
    document.addEventListener('keydown', onKey);
    // clicks inside same-origin iframes (preview pane, settings frames) never reach this document
    const hookFrame = (f) => {
      const attach = () => {
        try {
          f.contentDocument?.addEventListener('pointerdown', () => closeAll(), true);
        } catch {
          /* cross-origin */
        }
      };
      f.addEventListener('load', attach);
      attach();
    };
    document.querySelectorAll('iframe').forEach(hookFrame);
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) {
            (n.tagName === 'IFRAME' ? [n] : [...(n.querySelectorAll?.('iframe') || [])]).forEach(
              hookFrame
            );
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('blur', () => closeAll());
    window.addEventListener('resize', () => {
      for (const m of openMenus) if (m.anchor) place(m.menu, m.anchor);
    });
  },
};
