// In-app navigation guard for unsaved compose content. Browsers cannot render a custom leave
// prompt, so the native one is suppressed (core-overrides.js) and every in-app navigation that
// leaves a dirty compose form is intercepted here with our modal.
import { modal } from './modal.js';

const label = (n) => (window.rcmail?.get_label ? rcmail.get_label(n) : n);

function dirty() {
  const rc = window.rcmail;
  return !!(
    rc &&
    rc.env.action === 'compose' &&
    !rc.compose_skip_unsavedcheck &&
    typeof rc.cmp_hash === 'string' &&
    rc.cmp_hash !== rc.compose_field_hash()
  );
}

export const unload = {
  init() {
    if (!window.rcmail) return;
    const rc = rcmail;
    const origHref = rc.location_href;
    rc.location_href = function (url, target, frame, replace) {
      if (!frame && dirty()) {
        modal
          .confirm(label('notsentwarning'), {
            okLabel: label('discard') || label('ok'),
            danger: true,
          })
          .then((ok) => {
            if (ok) {
              rc.compose_skip_unsavedcheck = true;
              origHref.call(rc, url, target, frame, replace);
            }
          });
        return;
      }
      return origHref.call(rc, url, target, frame, replace);
    };
    // task switch buttons (mail/contacts/settings) go through switch_task → location_href, covered above.
  },
};
