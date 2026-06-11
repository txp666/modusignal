import { concatBytes } from "../utils/bytes.js";

const LINE_DELIMITERS = {
  lf: "\n",
  crlf: "\r\n",
  cr: "\r",
};

export function normalizeLineDelimiter(value) {
  if (value === "lf" || value === "\\n" || value === "\n") {
    return "lf";
  }

  if (value === "cr" || value === "\\r" || value === "\r") {
    return "cr";
  }

  return "crlf";
}

export function createLineFrameBuffer(delimiter = "crlf") {
  const normalized = normalizeLineDelimiter(delimiter);
  let textBuffer = "";

  return {
    reset() {
      textBuffer = "";
    },
    push(chunkText) {
      const frames = [];
      textBuffer += String(chunkText ?? "");
      const token = LINE_DELIMITERS[normalized];

      while (true) {
        const index = textBuffer.indexOf(token);
        if (index < 0) {
          break;
        }

        const frame = textBuffer.slice(0, index);
        textBuffer = textBuffer.slice(index + token.length);
        if (frame.length > 0) {
          frames.push(frame);
        }
      }

      return frames;
    },
    flush() {
      const remaining = textBuffer;
      textBuffer = "";
      return remaining.trim() ? [remaining] : [];
    },
  };
}

export function parseHexTokenSpec(input) {
  const tokens = String(input ?? "")
    .trim()
    .replace(/0x/gi, "")
    .split(/[\s,;:-]+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return new Uint8Array(0);
  }

  return new Uint8Array(
    tokens.map((token) => {
      if (!/^[0-9a-fA-F]{1,2}$/.test(token)) {
        throw new Error(`HEX 帧界无效：${token}`);
      }
      return Number.parseInt(token, 16);
    }),
  );
}

export function stripPrefixSuffixBytes(payload, prefix = new Uint8Array(0), suffix = new Uint8Array(0)) {
  if (!(payload instanceof Uint8Array) || payload.length === 0) {
    return null;
  }

  let start = 0;
  let end = payload.length;

  if (prefix.length > 0) {
    if (payload.length < prefix.length + suffix.length) {
      return null;
    }

    for (let index = 0; index < prefix.length; index += 1) {
      if (payload[index] !== prefix[index]) {
        return null;
      }
    }

    start = prefix.length;
  }

  if (suffix.length > 0) {
    if (payload.length - start < suffix.length) {
      return null;
    }

    for (let index = 0; index < suffix.length; index += 1) {
      if (payload[payload.length - suffix.length + index] !== suffix[index]) {
        return null;
      }
    }

    end = payload.length - suffix.length;
  }

  if (end <= start) {
    return null;
  }

  return payload.subarray(start, end);
}

export function extractDelimitedByteFrames(bufferState, prefix, suffix) {
  const frames = [];
  const prefixBytes = prefix instanceof Uint8Array ? prefix : new Uint8Array(0);
  const suffixBytes = suffix instanceof Uint8Array ? suffix : new Uint8Array(0);
  const minimumLength = prefixBytes.length + suffixBytes.length + 1;

  while (bufferState.bytes.length >= minimumLength) {
    let prefixIndex = 0;
    if (prefixBytes.length > 0) {
      prefixIndex = indexOfSubarray(bufferState.bytes, prefixBytes);
      if (prefixIndex < 0) {
        bufferState.bytes = bufferState.bytes.subarray(Math.max(0, bufferState.bytes.length - prefixBytes.length + 1));
        break;
      }
    }

    const searchStart = prefixIndex + prefixBytes.length;
    let suffixIndex = -1;
    if (suffixBytes.length > 0) {
      suffixIndex = indexOfSubarray(bufferState.bytes.subarray(searchStart), suffixBytes);
      if (suffixIndex < 0) {
        if (prefixIndex > 0) {
          bufferState.bytes = bufferState.bytes.subarray(prefixIndex);
        }
        break;
      }
    }

    const frameEnd = suffixBytes.length > 0 ? searchStart + suffixIndex : bufferState.bytes.length;
    const frame = bufferState.bytes.subarray(prefixIndex + prefixBytes.length, frameEnd);
    frames.push(frame);
    bufferState.bytes = bufferState.bytes.subarray(frameEnd + suffixBytes.length);
  }

  return frames;
}

export function createByteFrameBuffer() {
  return { bytes: new Uint8Array(0) };
}

export function appendByteFrameBuffer(bufferState, chunk) {
  if (!(chunk instanceof Uint8Array) || chunk.length === 0) {
    return;
  }

  bufferState.bytes = concatBytes(bufferState.bytes, chunk);
}

function indexOfSubarray(source, pattern) {
  if (!pattern.length || source.length < pattern.length) {
    return -1;
  }

  outer: for (let index = 0; index <= source.length - pattern.length; index += 1) {
    for (let offset = 0; offset < pattern.length; offset += 1) {
      if (source[index + offset] !== pattern[offset]) {
        continue outer;
      }
    }
    return index;
  }

  return -1;
}
