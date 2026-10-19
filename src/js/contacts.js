// Address book task glue: letter avatars in the contact list (core only renders the name),
// group rows get a group glyph; phone panel switching mirrors mail.js.
import { colorFor, initial } from './avatars.js';
import { layout } from './layout.js';

const html = document.documentElement;
const onSmallScreen = () => layout.mode === 'phone' || layout.mode === 'small';

function showPanel(name) {
  if (name === 'sidebar' && document.querySelector('#layout-menu > #layout-sidebar')) {
    html.classList.add('nav-open');
    return;
  }
  if (!document.getElementById(`layout-${name}`)) name = 'content';
  for (const id of ['layout-sidebar', 'layout-list', 'layout-content']) {
    document.getElementById(id)?.classList.toggle('selected', id === `layout-${name}`);
  }
  html.dataset.panel = name;
}

function decorate(row) {
  const td = row.querySelector('td.name');
  if (!td || td.dataset.initial) return;
  const name = td.textContent.trim();
  td.dataset.initial = initial(name);
  td.style.setProperty('--gm-avatar-bg', colorFor(name));
}

export const contactsUI = {
  init() {
    const rc = window.rcmail;
    if (!rc || rc.env.task !== 'addressbook') return;
    const photo = document.querySelector('#contactpic.image-upload');
    const upload = document.querySelector('#upload-form');
    if (photo && upload) {
      const input = upload.querySelector('input[type="file"]');
      if (input) {
        upload.hidden = true;
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.className = 'gm-photo-choose';
        choose.textContent = rc.gettext('addphoto');
        choose.addEventListener('click', () => input.click());
        photo.append(choose);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn gm-photo-remove';
        remove.textContent = rc.gettext('delete');
        remove.addEventListener('click', () => rc.command('delete-photo'));
        photo.closest('.contact-header').after(remove);
        const update = () => {
          const absent = document.getElementById('ff_photo')?.value === '-del-';
          choose.textContent = rc.gettext(absent ? 'addphoto' : 'replacephoto');
          remove.hidden = absent;
        };
        photo.querySelector('img')?.addEventListener('load', update);
        update();
      }
    }
    rc.addEventListener('insertrow', (e) => decorate(e.row.obj || e.row));
    document.querySelectorAll('#contacts-table tbody tr').forEach(decorate);

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a.back-list-button, a.back-sidebar-button, a.task-menu-button');
      if (!a) return;
      e.preventDefault();
      if (a.classList.contains('back-sidebar-button')) showPanel('sidebar');
      else if (a.classList.contains('task-menu-button')) html.classList.toggle('nav-open');
      else showPanel('list');
    });
    rc.addEventListener('init', () => {
      rc.contact_list?.addEventListener('select', (l) => {
        if (onSmallScreen() && l.get_single_selection()) showPanel('content');
      });
      if (onSmallScreen()) showPanel('list');
    });
    document.getElementById('directorylist')?.addEventListener('click', (e) => {
      if (onSmallScreen() && e.target.closest('a')) {
        html.classList.remove('nav-open');
        showPanel('list');
      }
    });
    document.addEventListener('gm:layout', () => {
      if (!onSmallScreen()) {
        for (const id of ['layout-sidebar', 'layout-list', 'layout-content']) {
          document.getElementById(id)?.classList.add('selected');
        }
      }
    });
  },
};
