# Zilla T3 Master Trainer Grading

## Build
- Replace the placeholder home screen with a clearly labeled demo mobile-number/OTP entry followed by a dense, white Excel-like grading workspace.
- Add a replaceable data-provider interface with realistic sample participants and browser-only demo storage; keep all production services disconnected.
- Implement the exact 31-column order and six header groups, frozen identifying columns, horizontal scrolling, search, batch/geography filters, and sorting.
- Enforce editable-field rules, inline validation, immediate score/grade calculation, independent recommendation selection, comment editing, and unsaved-row indicators.
- Add keyboard-friendly cell editing and Excel paste, save/discard confirmation, and Excel export that identifies unsaved edits.
- Add route metadata and tests for column order and grading rules, then verify the visible experience and core interactions.

## Technical details
- Keep grade ranges in one editable configuration module; note they require business confirmation before production.
- Use client-side demo authentication only, with no claims of security; save grading drafts to localStorage through the provider abstraction.
- Use a generated Excel workbook with the specified column order; don't connect to a database or invent production collection paths.
