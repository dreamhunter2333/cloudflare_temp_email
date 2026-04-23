# Topbar Language And GitHub Order Design

## Context

The desktop header in [Header.vue](/data/code/cloudflare_temp_email/frontend/src/views/Header.vue) currently places the GitHub/version entry before the language selector in the top-right area.

The requested adjustment is limited to the desktop header:

- Move the GitHub/version entry to appear after the language selector
- Add a language icon to the language selector
- Do not change GitHub text, icon, link, or behavior
- Do not change the mobile drawer layout or behavior

## Approved Scope

### Desktop Header

Keep the existing desktop header structure and change the action order to:

1. Navigation menu
2. Language selector
3. GitHub/version entry

### Language Selector

Keep the current dropdown interaction and current locale label.

Add the existing `Language` icon before the locale label.

Keep the dropdown arrow after the label.

### GitHub Entry

Change position only.

Explicitly do not change:

- GitHub icon
- GitHub label logic
- Version display logic
- Link target
- Click behavior
- Visibility conditions

### Mobile

No changes.

The mobile drawer keeps its current structure, including the existing GitHub menu item placement and the current language control placement.

## Implementation Notes

- The change should stay isolated to the header component.
- Reuse the existing imported `Language` icon already present in `Header.vue`.
- Keep the current desktop-only condition split intact.
- Avoid refactoring unrelated menu logic during this change.

## Risks

- If the GitHub action remains defined inside shared menu state, desktop-only reordering may be implemented in a way that couples desktop and mobile behavior. The implementation should avoid changing the mobile ordering by accident.
- Locale labels have different lengths across supported languages, so spacing in the desktop header should be preserved rather than tightened aggressively.

## Acceptance Criteria

- On desktop, the language selector appears before the GitHub/version entry.
- The language selector shows a language icon before the current locale text.
- The GitHub/version entry looks and behaves the same as before, except for its position.
- Mobile layout remains unchanged.
