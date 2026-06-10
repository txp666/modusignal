export const AOMASTER_DEVICE_ID = "aomaster";

export const AOMASTER_PROFILE = {
  id: AOMASTER_DEVICE_ID,
  name: "AOMaster",
  type: "模拟量信号发生器",
  protocolStatus: "pending",
  modes: {
    current: {
      label: "电流设定",
      unit: "mA",
      min: 4,
      max: 20,
      step: 0.001,
      presets: {
        min: 4,
        mid: 12,
        max: 20,
      },
    },
    voltage: {
      label: "电压设定",
      unit: "V",
      min: 0,
      max: 10,
      step: 0.001,
      presets: {
        min: 0,
        mid: 5,
        max: 10,
      },
    },
  },
};

export function createAOMasterSetOutputCommand() {
  return {
    supported: false,
    preview: "等待 AOMaster 协议定义",
    bytes: null,
  };
}

export function parseAOMasterTelemetry(text, parseNumericTelemetry) {
  const value = parseNumericTelemetry(text);
  return value === null
    ? null
    : {
        fieldName: "数值",
        unit: "",
        value,
        rawValue: value,
      };
}
