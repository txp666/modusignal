# Modusignal frontend architecture

`src/app.js` is the composition root. It may coordinate features, but feature state machines, protocol-specific UI, persistence, monitoring, and reusable UI infrastructure belong in separate modules.

## Layers

- `src/core/`: application state, session lifecycle, transport coordination, and feature registration.
- `src/features/<feature>/`: device- or workflow-specific controllers and views. These modules may use protocol modules, but protocol modules must not import feature UI.
- `src/monitoring/`: chart lifecycle, chart import/export, and telemetry presentation shared by multiple devices.
- `src/ui/`: application-wide UI infrastructure such as logs, navigation, dialogs, and responsive layout.
- `src/devices/`, `src/hart/`, `src/modbus/`, `src/transports/`, `src/framing/`: protocol/domain layer. These modules encode, decode, normalize, and describe data without owning application UI.

## Dependency direction

```text
app.js → core / features / monitoring / ui
features → devices / protocol modules / shared ui
core → transports / protocol registries
monitoring → chart utilities
protocol modules → utils only
```

Lower layers must not import `app.js` or reach into its mutable state. Controllers receive state access and side effects through explicit callbacks.

## Controller conventions

- A controller owns only the state for its workflow.
- DOM references are injected through the cached `elements` object.
- Mutable application configuration is accessed through `getConfig` and `setConfig` callbacks.
- Transport writes, logging, and chart activation are injected effects.
- Parsing and validation stay in protocol modules so they can be unit tested without a browser.

## Current composition

- `core/transport-controller.js` owns transport selection, connection state, secure-context checks, and transport defaults.
- `core/polling-controller.js` owns polling eligibility, timers, and polling status UI across devices.
- `features/hart/`, `features/aomaster/`, `features/modbus/`, `features/custom/`, and `features/message-debug/` own device/workflow UI behavior.
- `monitoring/chart-csv-controller.js` owns CSV import/export orchestration while `chart-csv.js` remains the pure data layer.
- `ui/app-event-bindings.js` is the event wiring boundary; `ui/app-elements.js` builds the DOM registry.
- `ui/device-navigation-ui.js`, `ui/sidebar-controller.js`, `ui/debug-curve-controller.js`, and `ui/log-controller.js` own reusable UI workflows.

`app.js` is allowed to retain cross-feature state, bootstrap ordering, high-level telemetry dispatch, and controller dependency injection. New device-specific form logic or timers must not be added there.

## Migration order

1. Move existing device UI and runtime logic into `features/`.
2. Extract chart lifecycle and CSV import/export into `monitoring/`.
3. Extract connection/session orchestration into `core/`.
4. Extract navigation, sidebar, dialogs, and device-library rendering into `ui/`.
5. Keep `app.js` as bootstrapping and cross-feature composition only.
