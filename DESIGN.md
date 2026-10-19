# ModuSignal design system

This is the active design reference for the ModuSignal website. Read it before
changing the application shell, home page, or shared components.

## Reference installed

Based on the IBM / Carbon analysis from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md),
pinned to `3b605329240ce735b510037cca322f1831fdd7f8` (installed 2026-10-20).
The unchanged source is in `docs/design/awesome-design-md/ibm.DESIGN.md`, with
its MIT license alongside it. No runtime package or remote font is required.

## Product direction

A practical browser workbench for engineers. Prioritize choosing a device,
connecting, reading frames, and inspecting signals. Keep software downloads,
hardware introductions, and developer documentation visually distinct.
Use real product photographs and screenshots already in this repository.

Adapt Carbon's precise grid, thin dividers, calm typography, restrained color,
and surface hierarchy. ModuSignal retains its own logo and teal accent; do not
copy IBM branding. Keep 6–8 px corners for compatibility with existing controls.

## Tokens

Use the CSS variables in `src/styles.css`; never hard-code light surfaces in
new components. The home layout is in `src/home.css`; internal workspaces are in `src/workbench.css`.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f5f7f8` | `#0b1118` |
| Surface | `#ffffff` | `#151d27` |
| Muted surface | `#f6f7f9` | `#1b2531` |
| Primary text | `#17202a` | `#e6edf3` |
| Secondary text | `#596674` | `#9aa9b8` |
| Border | `#d7dde4` | `#344252` |
| Accent | `#0f766e` | `#2bb3a7` |

System sans-serif stack: Inter, Segoe UI, PingFang SC, Microsoft YaHei, Arial.
No external font dependency, so offline packages remain self-contained.
Hero titles: 32–48 px / 1.2 / 500. Section titles: 22–26 px / 1.3 / 600.
Body: 14–16 px / 1.6. Technical metadata: 12 px. Use 4 px spacing increments,
16–24 px card padding and 32–48 px between major sections.

## Components and behavior

- Prefer flat surfaces and 1 px borders to shadows or gradients.
- Give each section one clear primary action. Secondary links use a border
  or text treatment; do not make every action a filled teal button.
- Tool cards show a name, a concise purpose, a transport label, and an action.
  Preserve their registered device routing and customized device names.
- Preserve the direct, versioned standalone MicroScope Power product link.
- Connection controls remain visible on device pages and during an active
  session. Overview pages do not show unused connection settings.
- Internal workspaces have a page title, Home breadcrumb, and a wider monitoring column.
  Keep parameter fields readable and stack the columns below 1050 px.
  On desktop (at least 1051 x 640 CSS pixels), fit the workbench to `100dvh`:
  compact title, controls on the left, chart and log on the right. Use 34 px
  mouse/keyboard controls and retain 44 px touch controls on small screens.
  Check 1512 x 828 (the supplied maximized Mac reference) and 1366 x 768.
  Separate long tasks with accessible tabs; keep the actual form nodes so
  unsaved values survive tab switches. Expanded or unusual forms may scroll
  within their panel; never hide inaccessible controls to force a fit.
- Every internal navigation must update browser history. Honor existing hash links
  and Home anchors; Back/Forward must not add entries or reset the same active device.
- Hardware cards use equal 16:9 image areas and per-photo focal points so the
  devices have comparable visual size. Do not stretch photos or crop screens.
- Product introductions, software pages and the HART knowledge base share
  `pages/shared/editorial.css`. Reading pages keep normal document scrolling.
- Keep technical detail in expandable documentation or product introductions.
  Curve settings open in a separate, labelled modal with a scrollable body,
  visible close action, Escape dismissal and focus returned to the trigger.
- Keep existing accuracy caveats (setpoint versus measured values, nominal
  voltage, sample-rate limits, estimated power/energy). Never invent readings.
- All new copy belongs in `src/i18n.js`, in both Chinese and English.
- Use semantic headings, labeled sections, visible focus rings, and native
  buttons/links. Touch controls should be at least 44 px high.
- Use the established 1050 px sidebar collapse breakpoint, two-column cards
  on intermediate widths, and one-column cards below 600 px.
- Check light/dark, Chinese/English, 1440 px desktop, 768 px tablet, and
  390/320 px mobile. Respect reduced motion. Do not use animated status text.

## Validation

Run `npm test` and `npm run build`. Inspect the actual app in a browser,
including tool navigation, search, product dialogs, standalone links, and
theme/language switching. A local UI check does not validate physical devices.
