#!/usr/bin/env bash
# Assert the Roundcube core JS/PHP contracts our in-house UI layer overrides still exist.
# Usage: tools/check-core-contracts.sh /path/to/roundcube
set -euo pipefail
RC=${1:?roundcube path}
cd "$(dirname "$0")/.."
fail=0
check() { if grep -q "$2" "$RC/$1"; then echo "ok   $1: $2"; else echo "MISS $1: $2"; fail=1; fi; }
check program/js/app.js "this.show_popup_dialog = function"
check program/js/app.js "triggerEvent('dialog-open'"
check program/js/app.js "if (!window.onbeforeunload)"
check program/js/app.js "triggerEvent('msglist_layout'"
check program/js/app.js "this.display_message = function"
check program/js/app.js "this.show_menu = function"
check program/js/app.js "this.hide_menu = function"
check program/js/app.js "this.check_compose_input = function"
check program/js/app.js "this.toggle_editor = function"
check program/js/list.js "cell.className = 'selection'"
check program/js/editor.js "triggerEvent('editor-init'"
check program/include/rcmail_output_html.php "meta\['extends'\]"
check program/lib/Roundcube/rcube_plugin.php "function local_skin_path"
check plugins/jqueryui/jqueryui.php "jquery-ui.css"
# gui_objects surface must not have grown behind our back
grep -o "gui_objects\.[a-z_0-9]*" "$RC/program/js/app.js" | sort -u | sed 's/gui_objects\.//' > /tmp/gui_objects.now
if diff -u tools/gui_objects.txt /tmp/gui_objects.now; then echo "ok   gui_objects unchanged"; else echo "DIFF gui_objects changed"; fail=1; fi
exit $fail
