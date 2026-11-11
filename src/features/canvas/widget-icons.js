import industrialCatalog from "../../hmi/industrial-catalog.js";
import { renderIndustrialSvg } from "../../hmi/industrial.js";

// Palette icons (16 × 16, currentColor).

const icon = (body) => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const WIDGET_ICONS = {
  PushButton: icon('<rect x="1.5" y="4" width="13" height="8" rx="2"/><path d="M5.5 8h5"/>'),
  Label: icon('<path d="M3 4h10M8 4v9"/>'),
  LineEdit: icon('<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M4.5 6v4"/>'),
  ComboBox: icon('<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M9.5 7l1.5 1.5L12.5 7"/>'),
  ToggleSwitch: icon('<rect x="1.5" y="4.5" width="13" height="7" rx="3.5"/><circle cx="11" cy="8" r="2" fill="currentColor"/>'),
  Slider: icon('<path d="M2 8h12"/><circle cx="6" cy="8" r="2" fill="currentColor"/>'),
  SpinBox: icon('<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M10.5 6.5l1 -1 1 1M10.5 9.5l1 1 1 -1"/>'),
  LEDIndicator: icon('<circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/>'),
  NumericDisplay: icon('<rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M4.5 10V6l-1 1M7 6h2v2H7v2h2"/>'),
  ProgressBar: icon('<rect x="1.5" y="6" width="13" height="4" rx="2"/><path d="M3.5 8h5" stroke-width="2"/>'),
  ProgressRingDisplay: icon('<circle cx="8" cy="8" r="5.5" opacity=".35"/><path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5"/>'),
  RealtimeChart: icon('<path d="M2 13V3M2 13h12"/><path d="M4 10l3-3 2 2 4-4"/>'),
  GaugeMeter: icon('<path d="M2.5 11a5.5 5.5 0 1 1 11 0"/><path d="M8 11l2.5-3"/>'),
  DataTable: icon('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M1.5 6h13M1.5 9.5h13M6 2.5v11"/>'),
  TabWidget: icon('<path d="M1.5 6V2.5h5V6"/><path d="M6.5 4h4.5v2"/><rect x="1.5" y="6" width="13" height="7.5" rx="1"/>'),
  HBoxLayout: icon('<rect x="1.5" y="3.5" width="13" height="9" rx="1"/><path d="M6 3.5v9M10 3.5v9"/>'),
  VBoxLayout: icon('<rect x="2.5" y="1.5" width="11" height="13" rx="1"/><path d="M2.5 6h11M2.5 10h11"/>'),
  FlexLayout: icon('<rect x="1.5" y="2.5" width="6" height="5" rx="1"/><rect x="8.5" y="2.5" width="6" height="5" rx="1"/><rect x="1.5" y="8.5" width="9" height="5" rx="1"/>'),
  GroupBox: icon('<rect x="1.5" y="3.5" width="13" height="10" rx="1"/><path d="M3.5 3.5h4"/>'),
  CardContainer: icon('<rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="M1.5 6h13"/>'),
  Separator: icon('<path d="M2 8h12"/>'),
  SerialConfigCard: icon('<rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 7h0M8 7h0M11 7h0M6.5 9.5h0M9.5 9.5h0" stroke-width="1.8"/>'),
  TcpConfigCard: icon('<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11"/>'),
  MqttConfigCard: icon('<path d="M3 12a9 9 0 0 1 9-9M3 12a5 5 0 0 1 5-5"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/>'),
  DataRecvCard: icon('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M8 4.5v5M5.5 7.5L8 10l2.5-2.5M4.5 11.5h7"/>'),
  DataSendCard: icon('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M8 11.5v-5M5.5 8.5L8 6l2.5 2.5M4.5 4.5h7"/>'),
  LogBox: icon('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4 5.5h1M6.5 5.5h5.5M4 8h1M6.5 8h4M4 10.5h1M6.5 10.5h5"/>'),
};

for (const item of industrialCatalog) WIDGET_ICONS[item.type] = renderIndustrialSvg(item);
