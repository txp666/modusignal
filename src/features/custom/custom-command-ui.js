import i18n from "../../i18n.js";
import { buildCustomCommand, COMMAND_LIBRARY_KEY, MAX_COMMANDS, MAX_LIBRARY_SIZE, parseCommandLibrary,
  serializeCommandLibrary, validateSavedCommand, mergeCommandLibraries } from "./command-library.js";
import { createCommandRunner } from "./command-runner.js";

export function createCustomCommandUi({ elements, getSession, isActive, appendLog }) {
  const e = elements;
  let commands = [];
  let selected = -1;
  let statusKey = "customTools.localOnly";
  let errorText = "";
  let importing = false;
  let rows = [];
  const editor = [e.customQuickName, e.customQuickPayload, e.customQuickFormat,
    e.customQuickEnding, e.customQuickChecksum, e.customQuickEscapes, e.customQuickInterval, e.customQuickLimit];
  const runner = createCommandRunner({ getSession, isActive, onChange: refresh, onError: reportError });

  function reportError(error) {
    errorText = error.message;
    refresh();
    appendLog("error", i18n("customTools.title"), errorText);
  }
  function message(key) { errorText = ""; statusKey = key; refresh(); }
  function read() {
    return { name: e.customQuickName.value, payload: e.customQuickPayload.value,
      format: e.customQuickFormat.value, lineEnding: e.customQuickEnding.value,
      checksum: e.customQuickChecksum.value, escapes: e.customQuickEscapes.checked };
  }
  function populate(command = { name: "", payload: "", format: "ascii", lineEnding: "\\r\\n", checksum: "none" }) {
    e.customQuickName.value = command.name;
    e.customQuickPayload.value = command.payload;
    e.customQuickFormat.value = command.format;
    e.customQuickEnding.value = command.lineEnding;
    e.customQuickChecksum.value = command.checksum;
    e.customQuickEscapes.checked = command.escapes === true;
    message("customTools.localOnly");
  }
  function select(index) {
    selected = index;
    renderLibrary();
    populate(commands[index]);
    rows[index]?.load.focus();
  }
  // Each saved command is a row: the name loads it into the editor, Send writes it as saved.
  function renderLibrary() {
    e.customQuickLibrary.replaceChildren();
    rows = commands.map((command, index) => {
      const row = document.createElement("li");
      row.className = `custom-command-row${index === selected ? " selected" : ""}`;
      const load = document.createElement("button");
      load.type = "button";
      load.className = "custom-command-load";
      load.title = i18n("customTools.loadTitle");
      if (index === selected) load.setAttribute("aria-current", "true");
      const name = document.createElement("span");
      name.textContent = command.name;
      const payload = document.createElement("code");
      payload.textContent = command.payload;
      let meta = command.format === "hex" ? "HEX" : i18n("customTools.textShort");
      try { meta += ` · ${buildCustomCommand(command).bytes.length} B`; } catch {}
      const info = document.createElement("small");
      info.textContent = meta;
      load.append(name, payload, info);
      load.addEventListener("click", () => select(index));
      const send = document.createElement("button");
      send.type = "button";
      send.className = "ghost-button custom-command-row-send";
      send.textContent = i18n("customTools.sendRow");
      send.setAttribute("aria-label", `${i18n("customTools.sendRow")} ${command.name}`);
      send.addEventListener("click", safely(() => sendBytes(buildCustomCommand(command).bytes)));
      row.append(load, send);
      e.customQuickLibrary.append(row);
      return { load, send };
    });
    e.customQuickLibrary.hidden = !commands.length;
    e.customQuickEmpty.hidden = commands.length > 0;
    e.customQuickCount.textContent = `${commands.length} / ${MAX_COMMANDS}`;
    e.customQuickEditorTitle.textContent = selected < 0 ? i18n("customTools.newCommand")
      : `${i18n("customTools.editing")}${commands[selected].name}`;
    e.customQuickEditorTitle.title = e.customQuickEditorTitle.textContent;
  }
  function persist(next) {
    const text = serializeCommandLibrary(next);
    try { localStorage.setItem(COMMAND_LIBRARY_KEY, text); }
    catch { throw new Error(i18n("customTools.storageFailed")); }
    commands = next;
  }
  function refresh() {
    const run = runner.snapshot();
    const locked = run.active || run.pending || importing;
    let payload = null;
    let previewError = "";
    try { payload = buildCustomCommand(read()); } catch (error) { previewError = error.message; }
    e.customQuickPreview.textContent = payload?.hex || (e.customQuickPayload.value ? previewError : i18n("customTools.previewEmpty"));
    e.customQuickPreview.classList.toggle("invalid", Boolean(e.customQuickPayload.value && !payload));
    e.customQuickBytes.textContent = payload ? `${payload.bytes.length} B${payload.checksumHex ? ` · ${i18n("customTools.checksum")}: ${payload.checksumHex}` : ""}` : "0 B";
    editor.forEach((control) => { control.disabled = locked; });
    e.customQuickEnding.disabled = locked || e.customQuickFormat.value === "hex";
    e.customQuickEscapes.disabled = locked || e.customQuickFormat.value === "hex";
    for (const control of [e.customQuickNew, e.customQuickSave, e.customQuickImport]) control.disabled = locked;
    e.customQuickDelete.disabled = locked || selected < 0;
    e.customQuickExport.disabled = !commands.length;
    const connected = Boolean(isActive() && getSession()?.connected);
    const ready = connected && payload && !locked;
    for (const row of rows) {
      row.load.disabled = locked;
      row.send.disabled = !connected || locked;
    }
    e.customQuickSend.disabled = !ready;
    e.customQuickStart.disabled = !ready;
    e.customQuickStop.disabled = !run.active;
    e.customQuickRunStatus.textContent = run.reason === "ready" ? i18n("customTools.ready")
      : `${i18n(`customTools.${run.reason}`)} · ${run.sent}${run.limit ? ` / ${run.limit}` : ""}`;
    e.customQuickRunStatus.classList.toggle("connected", run.active);
    e.customQuickStatus.textContent = errorText || i18n(statusKey);
    e.customQuickStatus.classList.toggle("invalid", Boolean(errorText));
    e.customQuickConnection.textContent = i18n(getSession()?.connected && isActive() ? "customTools.connected" : "customTools.connectFirst");
  }
  function safely(action) { return () => { try { action(); } catch (error) { reportError(error); } }; }
  function sendBytes(bytes, schedule) {
    errorText = "";
    void runner.start(bytes, schedule);
  }
  function send(repeat) {
    const { bytes } = buildCustomCommand(read());
    sendBytes(bytes, repeat ? { interval: Number(e.customQuickInterval.value), limit: Number(e.customQuickLimit.value) } : undefined);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([serializeCommandLibrary(commands)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "modusignal-serial-commands.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  e.customQuickNew.addEventListener("click", () => { selected = -1; renderLibrary(); populate(); e.customQuickPayload.focus(); });
  editor.forEach((control) => control.addEventListener("input", () => { errorText = ""; refresh(); }));
  e.customQuickSave.addEventListener("click", safely(() => {
    const command = validateSavedCommand(read());
    const next = commands.slice();
    const index = selected < 0 ? next.length : selected;
    next[index] = command;
    persist(next);
    selected = index;
    renderLibrary();
    message("customTools.saved");
  }));
  e.customQuickDelete.addEventListener("click", safely(() => {
    if (selected < 0) return;
    persist(commands.filter((_, index) => index !== selected));
    selected = -1;
    renderLibrary();
    // Keep the editor contents so an accidental removal can be saved again.
    message("customTools.removed");
  }));
  e.customQuickSend.addEventListener("click", safely(() => send(false)));
  e.customQuickStart.addEventListener("click", safely(() => send(true)));
  e.customQuickStop.addEventListener("click", () => runner.stop());
  e.customQuickPayload.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!e.customQuickSend.disabled) safely(() => send(false))();
    }
  });
  e.customQuickExport.addEventListener("click", safely(download));
  e.customQuickImport.addEventListener("click", () => e.customQuickFile.click());
  e.customQuickFile.addEventListener("change", async () => {
    const file = e.customQuickFile.files?.[0];
    if (!file) return;
    importing = true;
    refresh();
    try {
      if (file.size > MAX_LIBRARY_SIZE) throw new Error(i18n("customTools.fileLimit"));
      const imported = parseCommandLibrary(await file.text());
      persist(mergeCommandLibraries(commands, imported));
      renderLibrary();
      message("customTools.imported");
    } catch (error) { reportError(error); }
    finally { importing = false; e.customQuickFile.value = ""; refresh(); }
  });
  // A tab switch must not leave a sender running behind a hidden panel.
  for (const eventName of ["click", "keydown"]) {
    e.customPage.addEventListener(eventName, () => {
      if (e.customQuickPayload.closest("section").hidden) runner.stop();
    });
  }
  window.addEventListener("pagehide", () => runner.stop("stopped"));
  try {
    const saved = localStorage.getItem(COMMAND_LIBRARY_KEY);
    if (saved) commands = parseCommandLibrary(saved);
  } catch { errorText = i18n("customTools.loadFailed"); }
  renderLibrary();
  refresh();
  return { refresh, stop: runner.stop, localize() { renderLibrary(); refresh(); } };
}
