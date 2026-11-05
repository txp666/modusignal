// The link cards (serial / TCP over WebSocket / MQTT), configured and connected on the card as in
// the desktop software, and the debug cards (DataRecvCard, DataSendCard, LogBox). In design mode
// they show inert; in run mode they drive the runtime's links.

import i18n from "../../i18n.js";
import { textEncoding } from "../../hmi/parsers.js";
import { PROJECT_PARSER, propValue } from "../../hmi/uidp.js";
import { optionLabel } from "./property-panel.js";
import { logText } from "./canvas-messages.js";

const WEB_SERIAL_BAUDS = ["9600", "19200", "38400", "57600", "115200", "230400", "460800", "921600"];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const str = (widget, name) => String(propValue(widget, name) ?? "");

function field(labelText, control) {
  const wrap = el("label", "hmi-card-field");
  wrap.append(el("span", "", labelText), control);
  return wrap;
}

function input(value, onInput, type = "text") {
  const node = el("input");
  node.type = type;
  node.value = value;
  node.spellcheck = false;
  node.addEventListener("input", () => onInput(node.value));
  return node;
}

function select(options, value, onChange, label = (option) => option) {
  const node = el("select");
  for (const option of options) {
    const item = el("option", "", label(option));
    item.value = option;
    node.append(item);
  }
  node.value = options.includes(value) ? value : options[0];
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

function baseCard(widget, className) {
  const root = el("div", `hmi-widget hmi-cardwidget ${className}`);
  root.dataset.widgetId = widget.id ?? "";
  root.dataset.type = widget.type;
  return { el: root, body: root, setValue() {}, destroy() {}, resize() {} };
}

const parserName = (project, widget) => {
  const mode = str(widget, "defaultParser");
  return mode === PROJECT_PARSER ? `${optionLabel(PROJECT_PARSER)}（${project.serial?.parser ?? "line"}）` : mode;
};

// -- link cards ---------------------------------------------------------------------------

/** The form a card starts with in run mode, from its default* properties. */
function initialForm(widget) {
  if (widget.type === "SerialConfigCard") {
    const parity = str(widget, "defaultParity").toLowerCase();
    return {
      baudRate: str(widget, "defaultBaud"),
      dataBits: str(widget, "defaultDatabits") === "7" ? "7" : "8",
      parity: ["even", "odd"].includes(parity) ? parity : "none",
      stopBits: str(widget, "defaultStopbits") === "2" ? "2" : "1",
      flowControl: str(widget, "defaultFlow") === "RTS/CTS" ? "hardware" : "none",
    };
  }
  if (widget.type === "TcpConfigCard") {
    return { url: `ws://${str(widget, "defaultHost")}:${str(widget, "defaultPort")}` };
  }
  const scheme = propValue(widget, "defaultTls") === true ? "wss" : "ws";
  return {
    brokerUrl: `${scheme}://${str(widget, "defaultHost")}:${str(widget, "defaultPort")}/mqtt`,
    clientId: str(widget, "defaultClientId"),
    username: str(widget, "defaultUsername"),
    password: str(widget, "defaultPassword"),
    subscribeTopic: str(widget, "defaultSubscribe"),
    publishTopic: str(widget, "defaultPublish"),
    qos: str(widget, "defaultQos"),
  };
}

function connectOptions(widget, form) {
  if (widget.type === "SerialConfigCard") {
    return {
      options: {
        baudRate: Number(form.baudRate) || 115200, dataBits: Number(form.dataBits), parity: form.parity,
        stopBits: Number(form.stopBits), flowControl: form.flowControl,
      },
      description: `${i18n("hmi.card.serial")} ${form.baudRate}`,
    };
  }
  if (widget.type === "TcpConfigCard") return { options: { url: form.url.trim() }, description: form.url.trim() };
  return { options: { ...form, brokerUrl: form.brokerUrl.trim() }, description: form.brokerUrl.trim() };
}

function linkStateText(link, pollText) {
  if (!link) return i18n("hmi.link.idle");
  if (link.state === "connecting") return i18n("hmi.link.connecting");
  if (link.state === "error") return `${i18n("hmi.link.error")}${link.message}`;
  if (link.state === "connected") {
    const base = `${i18n("hmi.link.connected")} · ${link.description}`;
    return pollText ? `${base} · ${pollText}` : base;
  }
  return i18n("hmi.link.idle");
}

export function linkCardView(widget, ctx) {
  const view = baseCard(widget, "hmi-linkcard");
  const mode = str(widget, "displayMode");
  view.el.classList.add(`hmi-card-${{ 完整: "full", 简洁: "compact", 单行: "line" }[mode] ?? "full"}`);
  const run = ctx.mode === "run";
  const link = run ? ctx.runtime?.linkOf(widget) : null;
  if (link) link.form ??= initialForm(widget);
  const form = link?.form ?? initialForm(widget);
  const server = widget.type === "TcpConfigCard" && str(widget, "defaultMode") === "服务端";
  const unsupported = widget.type === "SerialConfigCard" && typeof navigator !== "undefined" && !("serial" in navigator);

  const head = el("div", "hmi-card-head");
  const status = el("span", "hmi-card-status");
  head.append(el("strong", "hmi-card-title", str(widget, "title")), status);
  const fields = el("div", "hmi-card-fields");
  const set = (key) => (value) => {
    form[key] = value;
  };
  const controls = [];
  const add = (labelKey, control, inLine = true) => {
    controls.push(control);
    if (mode === "单行" && !inLine) return;
    fields.append(mode === "单行" ? control : field(i18n(labelKey), control));
    if (mode === "单行") control.setAttribute("aria-label", i18n(labelKey));
  };
  if (widget.type === "SerialConfigCard") {
    add("hmi.card.baud", select(WEB_SERIAL_BAUDS.includes(form.baudRate) ? WEB_SERIAL_BAUDS : [form.baudRate, ...WEB_SERIAL_BAUDS], form.baudRate, set("baudRate")));
    if (mode === "完整") {
      add("hmi.card.dataBits", select(["8", "7"], form.dataBits, set("dataBits")), false);
      add("hmi.card.parity", select(["none", "even", "odd"], form.parity, set("parity"), (v) => optionLabel({ none: "None", even: "Even", odd: "Odd" }[v])), false);
      add("hmi.card.stopBits", select(["1", "2"], form.stopBits, set("stopBits")), false);
      add("hmi.card.flow", select(["none", "hardware"], form.flowControl, set("flowControl"), (v) => (v === "none" ? optionLabel("无") : "RTS/CTS")), false);
    }
  } else if (widget.type === "TcpConfigCard") {
    add("hmi.card.url", input(form.url, set("url")));
  } else {
    add("hmi.card.broker", input(form.brokerUrl, set("brokerUrl")));
    if (mode !== "单行") {
      if (mode === "完整") {
        add("hmi.card.clientId", input(form.clientId, set("clientId")), false);
        add("hmi.card.username", input(form.username, set("username")), false);
        add("hmi.card.password", input(form.password, set("password"), "password"), false);
      }
      add("hmi.card.subscribe", input(form.subscribeTopic, set("subscribeTopic")), false);
      add("hmi.card.publish", input(form.publishTopic, set("publishTopic")), false);
    }
  }
  const actions = el("div", "hmi-card-actions");
  const connect = el("button", "hmi-card-connect", i18n("hmi.link.connect"));
  connect.type = "button";
  actions.append(connect);
  const note = el("div", "hmi-card-note");
  const notes = [`${i18n("hmi.card.parser")}${parserName(ctx.project, widget)}`];
  if (widget.type === "TcpConfigCard") notes.push(i18n(server ? "hmi.card.serverUnsupported" : "hmi.card.viaWebSocket"));
  if (unsupported) notes.push(i18n("hmi.card.serialUnsupported"));
  if (propValue(widget, "modbusRole") === "从站" && widget.type !== "MqttConfigCard") notes.push(i18n("hmi.card.slaveNote"));
  note.textContent = notes.join(" · ");
  if (mode === "单行") {
    fields.append(connect, status);
    view.el.append(el("strong", "hmi-card-title", str(widget, "title")), fields);
  } else {
    view.el.append(head, fields, actions);
    if (mode === "完整" || server || unsupported) view.el.append(note);
  }

  const refresh = () => {
    const connected = Boolean(link?.connected);
    const busy = link?.state === "connecting";
    status.textContent = run ? linkStateText(link, link && ctx.runtime.isPollingLink(link) ? ctx.pollText() : "") : i18n("hmi.link.idle");
    status.dataset.state = link?.state ?? "idle";
    status.title = status.textContent;
    connect.textContent = i18n(connected ? "hmi.link.disconnect" : "hmi.link.connect");
    connect.disabled = !run || busy || server || unsupported;
    connect.classList.toggle("connected", connected);
    for (const control of controls) control.disabled = !run || connected || busy;
  };
  connect.addEventListener("click", () => {
    if (!link) return;
    if (link.connected) {
      void link.disconnect();
      return;
    }
    const { options, description } = connectOptions(widget, form);
    void link.connect(options, description);
  });
  refresh();
  if (link) {
    const off = ctx.runtime.events.links.on((changed) => {
      if (changed === link) refresh();
    });
    view.refresh = refresh;
    view.destroy = off;
  }
  return view;
}

// -- debug cards --------------------------------------------------------------------------

const stamp = (withMs) => {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  return withMs ? `${time}.${String(now.getMilliseconds()).padStart(3, "0")}` : time;
};
const hexText = (bytes) => [...bytes].map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");

function terminal() {
  const output = el("div", "hmi-terminal");
  output.setAttribute("role", "log");
  return output;
}

function appendLine(output, parts, maxLines, follow = true) {
  const line = el("div", "hmi-terminal-line");
  for (const [className, text] of parts) line.append(el("span", className, text));
  output.append(line);
  while (output.childElementCount > maxLines) output.firstElementChild.remove();
  if (follow) output.scrollTop = output.scrollHeight;
}

const decoders = {};
function decode(bytes, encoding) {
  decoders[encoding] ??= new TextDecoder(encoding === "gbk" ? "gbk" : "utf-8");
  return decoders[encoding].decode(bytes);
}

export function dataRecvCardView(widget, ctx) {
  const view = baseCard(widget, "hmi-recvcard");
  const head = el("div", "hmi-card-head");
  const counter = el("span", "hmi-card-status", i18n("hmi.recv.count").replace("{n}", "0"));
  head.append(el("strong", "hmi-card-title", str(widget, "title")), counter);
  const options = el("div", "hmi-card-options");
  const hexBox = el("input");
  hexBox.type = "checkbox";
  // 自动滚动, on at first: off, new lines still arrive but the view stays where it is.
  const followBox = el("input");
  followBox.type = "checkbox";
  followBox.checked = true;
  const hexLabel = el("label", "hmi-check");
  hexLabel.append(hexBox, el("span", "", i18n("hmi.recv.hex")));
  const followLabel = el("label", "hmi-check");
  followLabel.append(followBox, el("span", "", i18n("hmi.recv.autoScroll")));
  const clear = el("button", "hmi-card-small", i18n("hmi.recv.clear"));
  clear.type = "button";
  options.append(hexLabel, followLabel, clear);
  const output = terminal();
  view.el.append(head, options, output);
  const run = ctx.mode === "run";
  for (const control of [hexBox, followBox, clear]) control.disabled = !run;
  const maxLines = Math.max(50, Number(propValue(widget, "maxLines")) || 1000);
  let count = 0;
  clear.addEventListener("click", () => {
    output.replaceChildren();
    count = 0;
    counter.textContent = i18n("hmi.recv.count").replace("{n}", "0");
  });
  if (run && ctx.runtime) {
    const offTraffic = ctx.runtime.events.traffic.on(({ direction, bytes, link, topic }) => {
      let text;
      if (hexBox.checked) {
        text = hexText(bytes);
      } else {
        text = decode(bytes, direction === "rx" ? textEncoding(link.settings.parser, link.settings.parserConfig) : "utf-8").replace(/[\r\n]+$/, "");
        if (!text) return;
      }
      const prefix = topic ? `[${topic}] ` : "";
      appendLine(output, [["hmi-term-time", `[${stamp(true)}] `], [direction === "rx" ? "hmi-term-rx" : "hmi-term-tx", `${direction === "rx" ? "<<" : ">>"} ${prefix}${text}`]], maxLines, followBox.checked);
      if (direction === "rx") {
        count += 1;
        counter.textContent = i18n("hmi.recv.count").replace("{n}", String(count));
      }
    });
    const offLinks = ctx.runtime.events.links.on((link) => {
      if (link.state === "connected") appendLine(output, [["hmi-term-sys", `[${stamp(false)}] --- ${i18n("hmi.log.connected")}${link.description} ---`]], maxLines, followBox.checked);
      if (link.state === "idle" && link.description) appendLine(output, [["hmi-term-sys", `[${stamp(false)}] --- ${i18n("hmi.log.disconnected")} ---`]], maxLines, followBox.checked);
    });
    view.destroy = () => {
      offTraffic();
      offLinks();
    };
  }
  return view;
}

const NEWLINES = { 无: "", "\\r\\n": "\r\n", "\\n": "\n", "\\r": "\r" };

export function dataSendCardView(widget, ctx) {
  const view = baseCard(widget, "hmi-sendcard");
  const run = ctx.mode === "run";
  const row = el("div", "hmi-send-row");
  const text = el("input");
  text.type = "text";
  text.placeholder = str(widget, "placeholder");
  text.setAttribute("aria-label", str(widget, "title"));
  const send = el("button", "hmi-card-connect");
  send.type = "button";
  const sendLabel = el("span", "", i18n("hmi.send.send"));
  send.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M2 2.5 14 8 2 13.5l1.6-5.5z"/><path d="M3.6 8H9"/></svg>';
  send.append(sendLabel);
  row.append(text, send);
  const options = el("div", "hmi-card-options");
  const hexBox = el("input");
  hexBox.type = "checkbox";
  const hexLabel = el("label", "hmi-check");
  hexLabel.append(hexBox, el("span", "", i18n("hmi.send.hex")));
  const newline = select(Object.keys(NEWLINES), "\\r\\n", () => {}, optionLabel);
  newline.setAttribute("aria-label", i18n("hmi.send.newline"));
  const newlineLabel = el("label", "hmi-check hmi-send-newline");
  newlineLabel.append(el("span", "", i18n("hmi.send.newline")), newline);
  options.append(hexLabel, newlineLabel);
  view.el.append(el("strong", "hmi-card-title", str(widget, "title")), row, options);
  for (const control of [text, send, hexBox, newline]) control.disabled = !run;
  let tipTimer = null;
  const flash = (code) => {
    sendLabel.textContent = i18n(`hmi.send.${code}`);
    send.disabled = true;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      sendLabel.textContent = i18n("hmi.send.send");
      send.disabled = false;
    }, 1200);
  };
  const doSend = async () => {
    if (!ctx.runtime) return;
    const problem = await ctx.runtime.sendRaw(text.value.trim(), { hex: hexBox.checked, newline: NEWLINES[newline.value] ?? "\r\n" });
    if (problem) flash(problem);
    else text.select();
  };
  send.addEventListener("click", () => void doSend());
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) void doSend();
  });
  view.destroy = () => clearTimeout(tipTimer);
  return view;
}

export function logBoxView(widget, ctx) {
  const view = baseCard(widget, "hmi-logbox");
  const output = terminal();
  view.el.append(output);
  const maxLines = Math.max(50, Number(propValue(widget, "maxLines")) || 500);
  if (ctx.mode === "run" && ctx.runtime) {
    view.destroy = ctx.runtime.events.log.on((entry) => {
      appendLine(output, [["hmi-term-time", `[${stamp(false)}] `], [`hmi-log-${entry.level}`, logText(entry)]], maxLines);
    });
  } else {
    appendLine(output, [["hmi-term-time", "[--:--:--] "], ["hmi-log-info", i18n("hmi.log.preview")]], maxLines);
  }
  return view;
}
