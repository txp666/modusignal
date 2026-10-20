// The shared sender applies a line ending only to text, and a checksum to text or HEX (never JSON).
export function syncManualSendOptions(elements) {
  const format = elements.sendFormat?.value;
  if (elements.lineEnding) elements.lineEnding.disabled = format !== "ascii";
  if (elements.sendChecksum) elements.sendChecksum.disabled = format === "json";
}
