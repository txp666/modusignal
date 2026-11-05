export const HARTLINK_VERSION_QUERY = "HARTLINK:VERSION?\r\n";

const HARTLINK_VERSION_RESPONSE_PATTERN = /HARTLINK:VERSION=([^;\r\n]{1,64});MODEL=([^;\r\n]{1,64})/;

export function parseHartLinkVersionResponse(text) {
  const match = String(text ?? "").match(HARTLINK_VERSION_RESPONSE_PATTERN);
  if (!match) {
    return null;
  }

  const version = match[1].trim();
  const model = match[2].trim();
  return version && model ? { version, model } : null;
}

export function isHartLinkVersionProbeChunk(text) {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }

  return [...text].every((character) => {
    const code = character.charCodeAt(0);
    return code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0x7e);
  });
}
