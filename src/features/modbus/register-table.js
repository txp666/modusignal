import { decodeRegisterPair } from "../../modbus/modbus.js";

const PAIR_FORMATS = new Set(["uint32", "int32", "float32"]);

export function isPairFormat(format) {
  return PAIR_FORMATS.has(format);
}

/**
 * Builds display rows for a read response. 32-bit formats show the value on the first
 * register of each pair; the second row is marked `continued`.
 */
export function formatRegisterRows(data, startAddress, { format = "uint16", wordOrder = "ABCD", previous = null } = {}) {
  const count = Math.floor(data.length / 2);
  const rows = [];
  for (let index = 0; index < count; index++) {
    const raw = (data[index * 2] << 8) | data[index * 2 + 1];
    const row = {
      address: startAddress + index,
      hex: raw.toString(16).toUpperCase().padStart(4, "0"),
      value: "",
      continued: false,
      changed: Boolean(previous && previous.length >= index * 2 + 2 &&
        ((previous[index * 2] << 8) | previous[index * 2 + 1]) !== raw),
    };
    if (!isPairFormat(format)) {
      row.value = formatWord(raw, format);
    } else if (index % 2 === 1) {
      row.continued = true;
    } else if (index + 1 < count) {
      row.value = formatPair(decodeRegisterPair(data.subarray(index * 2, index * 2 + 4), format, wordOrder), format);
    } else {
      row.value = "—";
    }
    rows.push(row);
  }
  return rows;
}

function formatWord(raw, format) {
  if (format === "int16") return String(raw >= 0x8000 ? raw - 0x10000 : raw);
  if (format === "hex") return `0x${raw.toString(16).toUpperCase().padStart(4, "0")}`;
  if (format === "binary") return raw.toString(2).padStart(16, "0").replace(/(\d{4})(?=\d)/g, "$1 ");
  return String(raw);
}

function formatPair(value, format) {
  if (format !== "float32") return String(value);
  if (!Number.isFinite(value)) return String(value);
  return String(Number(value.toPrecision(7)));
}

export function formatModbusAddress(address) {
  return `0x${address.toString(16).toUpperCase().padStart(4, "0")}`;
}
