export function concatBytes(left, right) {
  const leftBytes = left instanceof Uint8Array ? left : new Uint8Array(left ?? []);
  const rightBytes = right instanceof Uint8Array ? right : new Uint8Array(right ?? []);
  if (leftBytes.length === 0) {
    return rightBytes;
  }
  if (rightBytes.length === 0) {
    return leftBytes;
  }

  const merged = new Uint8Array(leftBytes.length + rightBytes.length);
  merged.set(leftBytes);
  merged.set(rightBytes, leftBytes.length);
  return merged;
}

export function looksLikeHexPayload(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return false;
  }

  return /^[\dA-Fa-fxX\s,;:\-]+$/.test(trimmed);
}

export function resolvePayloadBytes(text, bytes, parseHexPayload) {
  const trimmed = String(text || "").trim();
  if (looksLikeHexPayload(trimmed) && typeof parseHexPayload === "function") {
    try {
      return parseHexPayload(trimmed);
    } catch {
      return null;
    }
  }

  if (bytes instanceof Uint8Array && bytes.length > 0) {
    return bytes;
  }

  if (bytes && typeof bytes.length === "number" && bytes.length > 0) {
    return new Uint8Array(bytes);
  }

  if (!trimmed) {
    return null;
  }

  return new TextEncoder().encode(trimmed);
}

export function bytesToAsciiPreview(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    return "";
  }

  return Array.from(bytes, (byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".")).join("");
}
