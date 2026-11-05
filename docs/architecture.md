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
- `core/session-event-controller.js` owns transport session events, receive/transmit logging, parser dispatch, and telemetry routing.
- `features/hart/`, `features/aomaster/`, `features/modbus/`, `features/custom/`, and `features/message-debug/` own device/workflow UI behavior.
- `framing/request-master.js` is the request/response master shared by Modbus and HART: one request in flight, response matching through a protocol adapter, exception/timeout results, statistics and the polling loop.
- `features/modbus/modbus-master.js` adapts it to Modbus RTU. `modbus-controller.js` renders its status and the register table; `register-table.js` holds the pure value formatting.
- `features/hart/hart-master-controller.js` adapts it to HART (responses matched by address, master and command; replies still arriving are not cut off) and renders the HART exchange status. Search and scan (`hart-session-controller.js`), polling, commands and the settings/calibration workspace all send through it; every received frame, including burst messages, goes to `hart-monitor-controller.js`.
- `features/aomaster/aomaster-controller.js` owns AOMaster configuration, value/percent presentation, readback state, and polling reads; waveform editing stays in `aomaster-waveform-ui.js`.
- `monitoring/chart-controller.js` owns chart instances, single/multi-series switching, point limits, resize behavior, summaries, and chart configuration persistence.
- `monitoring/chart-csv-controller.js` owns CSV import/export orchestration while `chart-csv.js` remains the pure data layer.
- `ui/app-event-bindings.js` is the event wiring boundary; `ui/app-elements.js` builds the DOM registry.
- `ui/device-navigation-ui.js`, `ui/sidebar-controller.js`, `ui/debug-curve-controller.js`, and `ui/log-controller.js` own reusable UI workflows.
- `ui/log-controller.js` owns the shared send/receive log: RX coalescing, the Auto/HEX/Text display, pause, byte counters, the line limit and saving. `ui/log-format.js` and `utils/text-escapes.js` hold the pure formatting; the escape syntax is shared with the custom command editor (`features/custom/command-library.js`), which also builds the shared sender's payloads.

`app.js` retains cross-feature state, bootstrap ordering, controller dependency injection, device selection, and the shared command workbench. New protocol dispatch, chart lifecycle, device-specific form logic, or timers must not be added there.

## Migration order

Completed boundaries now include device feature UI, chart lifecycle and CSV workflows, session orchestration, transport/polling, navigation, sidebar, logging, and global event wiring. Further reductions should split the shared command workbench and device-selection presentation only when those areas gain independent state or tests; `app.js` remains the composition root.
