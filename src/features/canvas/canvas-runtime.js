import { EXTENDED_FEEDBACK_TYPES, createExtendedFeedbackState } from "../../hmi/extended-feedback.js";
// The running .uidp project. Every link card is a link of its own (Web Serial, a WebSocket
// client, MQTT over WebSocket) with its own parser; what any link reads goes through the same
// bindings and chart curves. Controls send to every connected link (Modbus framed per link);
// the first connected link card that parses Modbus polls the Modbus bindings.

import { BindingEntry, CurveEntry, curveConfigs } from "../../hmi/binding.js";
import { CommandError, commandForEvent, commandHex, modbusFrame } from "../../hmi/commands.js";
import { createModbusMaster, createModbusPoller } from "../../hmi/modbus-poll.js";
import { createParser, MODBUS_PARSERS, ModbusRequests } from "../../hmi/parsers.js";
import { displayString } from "../../hmi/py-values.js";
import { TRANSPORT_FOR_CARD, cardLinkSettings, isSupported, linkCards, walkWidgets } from "../../hmi/uidp.js";
import { createTransportSession } from "../../transports/registry.js";

const MQTT_PARSER_LIMIT = 256;

function endsWith(bytes, tail) {
  if (bytes.length < tail.length) return false;
  for (let i = 0; i < tail.length; i += 1) if (bytes[bytes.length - tail.length + i] !== tail[i]) return false;
  return true;
}

function emitter() {
  const listeners = new Set();
  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit(...args) {
      for (const fn of [...listeners]) fn(...args);
    },
  };
}

/**
 * options: project, onValue(widgetId, value), onCurvePoint(widgetId, index, number),
 * onStatus(status), notify(level, code, args)
 * Events for the cards: links (state changes), traffic ({ direction, bytes, text, link, topic }),
 * log ({ level, code, args, text }).
 */
export function createCanvasRuntime(options) {
  const { project, onValue, onCurvePoint, onStatus, notify, isShown = () => true } = options;
  const bindings = [];
  const bindingWidget = new Map();
  const curves = [];
  const feedbackStates = new Map();
  for (const { widget } of walkWidgets(project.widgets)) {
    if (!isSupported(widget)) continue;
    if (EXTENDED_FEEDBACK_TYPES.has(widget.type)) feedbackStates.set(widget.id, createExtendedFeedbackState(widget.type, widget.properties));
    const entry = BindingEntry.fromWidget(widget, project);
    if (entry) {
      bindings.push(entry);
      bindingWidget.set(entry, widget);
    }
    if (widget.type === "RealtimeChart") {
      curveConfigs(widget.properties ?? {}).forEach((cfg, index) => curves.push({ widgetId: widget.id, index, entry: new CurveEntry(cfg) }));
    }
  }
  function deliverBinding(entry, values) {
    const feedback = feedbackStates.get(entry.widgetId);
    for (const observation of entry.takeObservations()) feedback?.observe(observation.value, observation.state);
    for (const value of values) onValue(entry.widgetId, value);
    if (entry.bindingState) options.onBindingState?.(entry.widgetId, entry.bindingState);
  }
  const events = { links: emitter(), traffic: emitter(), log: emitter(), data: emitter() };
  let stopped = false;

  const log = (level, code, args = [], text = "") => events.log.emit({ level, code, args, text });

  function deliver(link, unit, parser, topic = null) {
    for (const entry of bindings) {
      if (!entry.usesRaw) continue;
      deliverBinding(entry, entry.onRaw(unit));
    }
    for (const curve of curves) {
      for (const number of curve.entry.onRaw(unit)) onCurvePoint(curve.widgetId, curve.index, number);
    }
    let data = unit;
    if (topic !== null && link.settings.parser === "line" && !endsWith(unit, parser.terminator)) {
      data = new Uint8Array(unit.length + parser.terminator.length);
      data.set(unit);
      data.set(parser.terminator, unit.length);
    }
    for (const message of parser.parse(data)) {
      if (topic !== null && Object.keys(message).length === 1 && Object.hasOwn(message, "ch0")) message[topic] = message.ch0;
      link.master.handleMessage(message);
      events.data.emit(message);
      for (const entry of bindings) {
        deliverBinding(entry, entry.onParsed(message));
      }
      for (const curve of curves) {
        for (const number of curve.entry.onParsed(message)) onCurvePoint(curve.widgetId, curve.index, number);
      }
      log("info", "data", [], Object.entries(message).map(([key, value]) => `${key}=${displayString(value)}`).join(", "));
    }
  }

  function createLink(card) {
    const settings = cardLinkSettings(project, card);
    const requests = new ModbusRequests();
    const link = {
      card,
      settings,
      transportId: TRANSPORT_FOR_CARD[card.type],
      session: null,
      state: "idle",
      message: "",
      description: "",
      parser: null,
      topicParsers: new Map(),
      idleTimer: null,
      get connected() {
        return Boolean(this.session?.connected) && this.state === "connected";
      },
      get modbus() {
        return MODBUS_PARSERS.includes(settings.parser);
      },
    };
    link.master = createModbusMaster({
      write: (frame) => link.session.write(frame),
      parserType: () => settings.parser,
      isConnected: () => link.connected,
    });

    const newParser = () => createParser(settings.parser, settings.parserConfig, requests);
    const setState = (state, message = "") => {
      link.state = state;
      link.message = message;
      events.links.emit(link);
      poller?.refresh();
    };

    function resetStreams() {
      link.parser = null;
      link.topicParsers.clear();
      clearTimeout(link.idleTimer);
      for (const entry of bindings) entry.resetStream();
      for (const curve of curves) curve.entry.resetStream();
    }

    function onRx({ bytes, text, topic }) {
      if (stopped || !bytes?.length) return;
      events.traffic.emit({ direction: "rx", bytes, text, link, topic });
      try {
        if (link.transportId === "mqtt") {
          const key = topic ?? "";
          let parser = link.topicParsers.get(key);
          if (!parser) {
            if (link.topicParsers.size >= MQTT_PARSER_LIMIT) link.topicParsers.clear();
            parser = newParser();
            link.topicParsers.set(key, parser);
          }
          const units = parser.frames(bytes);
          if (parser.idleTimeout > 0) units.push(...parser.flush());
          for (const unit of units) deliver(link, unit, parser, key);
          return;
        }
        link.parser ??= newParser();
        const parser = link.parser;
        for (const unit of parser.frames(bytes)) deliver(link, unit, parser);
        if (parser.idleTimeout > 0) {
          clearTimeout(link.idleTimer);
          link.idleTimer = setTimeout(() => {
            if (!stopped && link.parser === parser) for (const unit of parser.flush()) deliver(link, unit, parser);
          }, parser.idleTimeout);
        }
      } catch (error) {
        log("error", "parse", [error.message]);
      }
    }

    function onTx({ bytes, text, topic }) {
      if (stopped || !bytes?.length) return;
      events.traffic.emit({ direction: "tx", bytes, text, link, topic });
      if (link.modbus) requests.noteFrame(bytes, settings.parser);
    }

    link.connect = async (connectOptions, description) => {
      if (stopped || link.state === "connecting" || link.connected) return;
      try {
        newParser();
      } catch (error) {
        setState("error", error.message);
        log("error", "error", [error.message]);
        return;
      }
      const session = createTransportSession(link.transportId);
      link.session = session;
      link.description = description;
      session.addEventListener("rx", (event) => onRx(event.detail));
      session.addEventListener("tx", (event) => onTx(event.detail));
      session.addEventListener("error", (event) => {
        const message = event.detail.error?.message ?? String(event.detail.error);
        link.message = message;
        log("error", "error", [message]);
        events.links.emit(link);
      });
      session.addEventListener("disconnected", () => {
        if (link.session !== session) return;
        const wasConnected = link.state === "connected";
        link.master.cancelAll();
        resetStreams();
        if (wasConnected) log("warn", "disconnected", [link.description]);
        if (link.state !== "error") setState("idle");
      });
      resetStreams();
      link.master.resetTransactions();
      setState("connecting");
      try {
        // Web Serial asks for the port inside this click: nothing is awaited before connect().
        await session.connect(connectOptions);
        if (stopped || link.session !== session) {
          void session.disconnect().catch(() => {});
          return;
        }
        setState("connected");
        log("ok", "connected", [description]);
      } catch (error) {
        link.session = null;
        const message = error?.message || String(error);
        setState("error", message);
        log("error", "error", [message]);
      }
    };

    link.disconnect = async () => {
      const session = link.session;
      if (!session) return;
      try {
        await session.disconnect();
      } catch (error) {
        log("error", "error", [error.message]);
      }
      if (link.session === session) {
        link.session = null;
        if (link.state !== "idle") setState("idle");
      }
    };
    return link;
  }

  const links = linkCards(project).filter(isSupported).map(createLink);
  const linkOf = new Map(links.map((link) => [link.card, link]));
  const connectedLinks = () => links.filter((link) => link.connected);
  const pollingLink = () => links.find((link) => link.connected && link.modbus && !link.settings.slaveRole) ?? null;

  const poller = links.some((link) => link.modbus && !link.settings.slaveRole)
    ? createModbusPoller({
      getMaster: () => pollingLink()?.master ?? null,
      // Bindings on screen (not on a hidden tab page) and every chart curve, as the reference polls them.
      getNeeds: () => [
        ...bindings.filter((entry) => entry.type === "DigitalTimingChart" || isShown(bindingWidget.get(entry))).map((entry) => entry.modbusNeed()),
        ...curves.map((curve) => curve.entry.modbusNeed()),
      ].filter(Boolean),
      getSettings: () => {
        const link = pollingLink();
        return link ? { period: link.settings.period, timeout: link.settings.timeout, slave: link.settings.slave } : { period: 500, timeout: 1000, slave: 1 };
      },
      onStatus: (status) => onStatus({ kind: "modbus", ...status }),
    })
    : null;

  /** Writes one command to every connected link; false when none is connected. */
  async function writeAll(command) {
    const targets = connectedLinks();
    if (!targets.length) {
      notify("warning", "notConnected");
      return false;
    }
    for (const link of targets) {
      try {
        if (command.kind === "modbus") {
          if (link.modbus) {
            link.master.enqueue(command.request, link.settings.timeout, "write", (result) => {
              if (result.problem?.kind === "exception") {
                notify("error", "modbusException", [result.problem.code]);
                log("error", "modbusException", [result.problem.code]);
              } else if (result.problem?.kind === "timeout") {
                notify("warning", "modbusTimeout", [result.problem.timeout]);
                log("warn", "modbusTimeout", [result.problem.timeout]);
              }
              poller?.refresh();
            });
          } else {
            await link.session.write(modbusFrame(command.request, link.settings.parser, 0));
          }
        } else {
          // Text goes as text (a WebSocket text frame); HEX as bytes.
          await link.session.write(command.text ?? command.bytes);
        }
      } catch (error) {
        notify("error", "sendFailed", [error.message]);
        log("error", "sendFailed", [error.message]);
      }
    }
    return true;
  }

  return {
    events,
    feedbackState: (id) => feedbackStates.get(id)?.snapshot() ?? null,
    links,
    linkOf: (card) => linkOf.get(card) ?? null,
    /** What is on screen changed (a tab page): plan the Modbus reads again. */
    refreshPolling: () => poller?.refresh(),
    isPollingLink: (link) => pollingLink() === link,
    /** A user action on a control: encode its command and send it. */
    async send(widget, event) {
      let command;
      try {
        command = commandForEvent(widget.type, widget.properties ?? {}, event);
      } catch (error) {
        if (error instanceof CommandError) {
          notify("error", "command", [error]);
          log("error", "command", [error]);
          return;
        }
        throw error;
      }
      if (command === null) return;
      if (command.kind === "can") {
        notify("warning", "canUnsupported");
        return;
      }
      await writeAll(command);
    },
    /** DataSendCard: text with its line ending, or HEX. Returns a problem code, or null once sent. */
    async sendRaw(text, { hex, newline }) {
      if (!text) return "empty";
      if (!connectedLinks().length) return "notConnected";
      if (hex) {
        let bytes;
        try {
          bytes = commandHex(text.replace(/ /g, ""));
        } catch {
          return "hexInvalid";
        }
        await writeAll({ kind: "bytes", bytes });
      } else {
        const full = text + newline;
        await writeAll({ kind: "bytes", bytes: new TextEncoder().encode(full), text: full });
      }
      return null;
    },
    start() {
      if (!links.length) onStatus({ kind: "noLinks" });
      else if (links.some((link) => link.settings.slaveRole)) onStatus({ kind: "slave" });
      else if (!poller) onStatus({ kind: "idle" });
      poller?.start();
    },
    async stop() {
      stopped = true;
      poller?.stop();
      for (const link of links) {
        clearTimeout(link.idleTimer);
        link.master.cancelAll();
      }
      await Promise.all(links.map((link) => link.disconnect()));
    },
  };
}
