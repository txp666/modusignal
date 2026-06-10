const FUNCTION_CODES = {
  READ_HOLDING: 3,
  READ_INPUT: 4,
  WRITE_SINGLE: 6,
  WRITE_MULTIPLE: 16,
};

export function crc16Modbus(bytes) {
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
  }

  return crc & 0xffff;
}

export function appendCrc(pdu) {
  const crc = crc16Modbus(pdu);
  const frame = new Uint8Array(pdu.length + 2);
  frame.set(pdu);
  frame[pdu.length] = crc & 0xff;
  frame[pdu.length + 1] = (crc >> 8) & 0xff;
  return frame;
}

export function verifyCrc(frame) {
  if (frame.length < 4) {
    return false;
  }

  const pdu = frame.subarray(0, frame.length - 2);
  const crc = crc16Modbus(pdu);
  return frame[frame.length - 2] === (crc & 0xff) && frame[frame.length - 1] === (crc >> 8) & 0xff;
}

export function isReadFunctionCode(functionCode) {
  return functionCode === FUNCTION_CODES.READ_HOLDING || functionCode === FUNCTION_CODES.READ_INPUT;
}

export function isWriteFunctionCode(functionCode) {
  return functionCode === FUNCTION_CODES.WRITE_SINGLE || functionCode === FUNCTION_CODES.WRITE_MULTIPLE;
}

export function registersForDataType(dataType) {
  return dataType === "float32" ? 2 : 1;
}

export function buildReadRegistersRequest(slaveId, functionCode, address, quantity) {
  const pdu = new Uint8Array(6);
  pdu[0] = slaveId & 0xff;
  pdu[1] = functionCode & 0xff;
  pdu[2] = (address >> 8) & 0xff;
  pdu[3] = address & 0xff;
  pdu[4] = (quantity >> 8) & 0xff;
  pdu[5] = quantity & 0xff;
  return appendCrc(pdu);
}

export function buildWriteSingleRegisterRequest(slaveId, address, value) {
  const safeValue = clampUint16(value);
  const pdu = new Uint8Array(6);
  pdu[0] = slaveId & 0xff;
  pdu[1] = FUNCTION_CODES.WRITE_SINGLE;
  pdu[2] = (address >> 8) & 0xff;
  pdu[3] = address & 0xff;
  pdu[4] = (safeValue >> 8) & 0xff;
  pdu[5] = safeValue & 0xff;
  return appendCrc(pdu);
}

export function buildWriteMultipleRegistersRequest(slaveId, address, values) {
  const registerValues = values.map((value) => clampUint16(value));
  const byteCount = registerValues.length * 2;
  const pdu = new Uint8Array(7 + byteCount);
  pdu[0] = slaveId & 0xff;
  pdu[1] = FUNCTION_CODES.WRITE_MULTIPLE;
  pdu[2] = (address >> 8) & 0xff;
  pdu[3] = address & 0xff;
  pdu[4] = (registerValues.length >> 8) & 0xff;
  pdu[5] = registerValues.length & 0xff;
  pdu[6] = byteCount & 0xff;

  registerValues.forEach((value, index) => {
    const offset = 7 + index * 2;
    pdu[offset] = (value >> 8) & 0xff;
    pdu[offset + 1] = value & 0xff;
  });

  return appendCrc(pdu);
}

export function extractRtuFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (buffer.length - offset >= 5) {
    const slaveId = buffer[offset];
    const functionCode = buffer[offset + 1];
    let frameLength = expectedRtuFrameLength(buffer.subarray(offset));

    if (frameLength === null) {
      offset += 1;
      continue;
    }

    if (buffer.length - offset < frameLength) {
      break;
    }

    const frame = buffer.subarray(offset, offset + frameLength);

    if (!verifyCrc(frame)) {
      offset += 1;
      continue;
    }

    if (frame[0] !== slaveId) {
      offset += 1;
      continue;
    }

    frames.push(frame);
    offset += frameLength;
  }

  return {
    frames,
    remaining: buffer.subarray(offset),
  };
}

export function parseReadRegistersResponse(frame, config) {
  if (frame.length < 5 || frame[1] & 0x80) {
    return null;
  }

  const byteCount = frame[2];
  const data = frame.subarray(3, 3 + byteCount);
  const rawValue = decodeRegisterValue(data, config.dataType, config.byteOrder);

  if (!Number.isFinite(rawValue)) {
    return null;
  }

  const value = rawValue * config.scale + config.offset;
  return {
    fieldName: config.fieldName,
    unit: config.unit,
    value,
    rawValue,
  };
}

export function decodeRegisterValue(data, dataType, byteOrder) {
  if (dataType === "float32") {
    if (data.length < 4) {
      return null;
    }

    const ordered = orderBytes(data.subarray(0, 4), byteOrder);
    const view = new DataView(ordered.buffer, ordered.byteOffset, ordered.byteLength);
    return view.getFloat32(0, false);
  }

  if (data.length < 2) {
    return null;
  }

  const ordered = orderBytes(data.subarray(0, 2), byteOrder === "BA" ? "BA" : "AB");
  const raw = (ordered[0] << 8) | ordered[1];
  return dataType === "int16" ? toInt16(raw) : raw;
}

function expectedRtuFrameLength(buffer) {
  const functionCode = buffer[1];

  if (functionCode & 0x80) {
    return 5;
  }

  if (functionCode === FUNCTION_CODES.READ_HOLDING || functionCode === FUNCTION_CODES.READ_INPUT) {
    if (buffer.length < 3) {
      return null;
    }

    return 5 + buffer[2];
  }

  if (functionCode === FUNCTION_CODES.WRITE_SINGLE) {
    return 8;
  }

  if (functionCode === FUNCTION_CODES.WRITE_MULTIPLE) {
    return 8;
  }

  return null;
}

function orderBytes(bytes, byteOrder) {
  const copy = Uint8Array.from(bytes);

  if (byteOrder === "BA") {
    return new Uint8Array([copy[1], copy[0]]);
  }

  if (byteOrder === "ABCD") {
    return copy;
  }

  if (byteOrder === "DCBA") {
    return new Uint8Array([copy[3], copy[2], copy[1], copy[0]]);
  }

  if (byteOrder === "BADC") {
    return new Uint8Array([copy[1], copy[0], copy[3], copy[2]]);
  }

  if (byteOrder === "CDAB") {
    return new Uint8Array([copy[2], copy[3], copy[0], copy[1]]);
  }

  return copy;
}

function clampUint16(value) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(65535, Math.max(0, number));
}

function toInt16(value) {
  return value >= 0x8000 ? value - 0x10000 : value;
}
