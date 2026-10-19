// roundcube-gmail UI entry point. Bundled by esbuild into skin/ui.js (+ .min.js).
// Loaded from templates/includes/footer.html BEFORE rcmail.init() runs (docready), so every
// core override is in place when Roundcube boots. No jQuery, no third-party UI code.
import { layout } from './layout.js';
import { theme } from './theme.js';
import { popup } from './popup.js';
import { toast } from './toast.js';
import { controls } from './controls.js';
import { unload } from './unload.js';
import { installCoreOverrides } from './core-overrides.js';
import { buildUI } from './shim.js';
import { avatars } from './avatars.js';
import { mailUI } from './mail.js';
import { compose } from './compose.js';
import { search } from './search.js';
import { contactsUI } from './contacts.js';
import { lists } from './lists.js';
import { loading } from './loading.js';
import { datetime } from './datetime.js';
import { tooltip } from './tooltip.js';
import { contactDialog } from './contact-dialog.js';
import { fab } from './fab.js';
import { ai } from './ai.js';
import { apps } from './apps.js';
import { avatarImages } from './avatar-images.js';

window.UI = buildUI();

layout.init();
theme.init();
popup.init();
installCoreOverrides();
unload.init();

const boot = () => {
  toast.init();
  controls.init();
  avatars.init();
  mailUI.init();
  compose.init();
  search.init();
  contactsUI.init();
  lists.init();
  loading.init();
  datetime.init();
  tooltip.init();
  contactDialog.init();
  fab.init();
  ai.init();
  apps.init();
  avatarImages.init();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
