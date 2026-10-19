# UI fixes and known issues

## September 2026 refinement

- Centered avatar initials by making avatars direct grid children.
- Aligned tablet breakpoints and adapted message rows to the available pane width.
- Preserved the message list during touch selection and exposed bulk actions.
- Standardized folder-menu padding, nesting and icon spacing for Copy/Move.
- Fixed label-menu row sizing, hover backgrounds and light/dark contrast.
- Corrected confirmation results and preserved drafts after failed or timed-out saves.
- Synchronized custom controls with hidden, disabled and multi-select form state.
- Kept nested dropdown interactions inside their active overlay.
- Repaired compose recipient targeting and contact photo upload form structure.
- Refined editor dialogs, spellcheck menus, narrow settings forms and plugin controls.
- Removed hidden markup from message subjects passed to the AI summary interface.
- Refined empty states, icons, header spacing and drawer shadows.

See the [UI audit](UI-AUDIT-2026-09-11.md) for coverage and recorded verification.

## Open UI checks

- The reported small white mark below Inbox was not reproduced; it is not claimed fixed.
- Identity switching requires a second switchable identity to verify its dropdown.

When reporting a bug, include the Roundcube version, relevant plugins, browser, viewport,
appearance mode and reproduction steps. Use fictional or redacted screenshot content.
