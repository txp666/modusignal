// Replay the shared project's bindings and production views with its local feedback file.
import { industrialView } from "../../src/features/canvas/industrial-view.js";
import { BindingEntry } from "../../src/hmi/binding.js";
import { EXTENDED_FEEDBACK_TYPES } from "../../src/hmi/extended-feedback.js";
import { createParser } from "../../src/hmi/parsers.js";
import { parseProject } from "../../src/hmi/uidp.js";

async function readText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path + " (" + response.status + ")");
  return response.text();
}

async function start() {
  const [projectText, feedback] = await Promise.all([
    readText("./动态控件全景.uidp"), readText("./动态反馈.jsonl"),
  ]);
  const project = parseProject(projectText);
  const gallery = project.widgets.find(widget => widget.type === "TabWidget");
  const pageNames = gallery.properties.tabNames.split("\n");
  const parser = createParser(project.serial.parser, project.serial.parserConfig);
  const frames = parser.parse(new TextEncoder().encode(feedback));
  const pages = document.getElementById("pages");
  const cards = document.getElementById("cards");
  const stages = document.getElementById("stage");
  const playback = document.getElementById("playback");
  const signalStageNames = frames.map((frame, i) => {
    if (!frame.cell_voltages.length || (i && !frames[i - 1].cell_voltages.length)) return frame.demo_step;
    const step = frame.demo_step.split(" · ", 1)[0];
    return step + " · 编码器 " + frame.encoder_count + " 脉冲 · 电源 " + frame.bench_supply.mode;
  });
  let views = [];
  let currentPage = 0;
  let timer = null;
  let automatic = true;

  function deliver({ binding, view }, frame) {
    const values = binding.onParsed(frame);
    if (EXTENDED_FEEDBACK_TYPES.has(binding.type)) {
      for (const sample of binding.takeObservations()) {
        if (sample.state === "ready") view.setValue(sample.value);
        else view.setBindingState(sample.state);
      }
      return;
    }
    for (const value of values) view.setValue(value);
    view.setBindingState(binding.bindingState);
  }

  function displayFrame(index) {
    stages.selectedIndex = index;
    for (const item of views) deliver(item, frames[index]);
  }

  function showPage(index) {
    currentPage = index;
    for (const { view } of views) view.destroy();
    views = gallery.children.filter(widget => widget.tabIndex === index).map(widget => ({
      widget, binding: BindingEntry.fromWidget(widget, project), view: industrialView(widget, { mode: "run", project }),
    }));
    cards.replaceChildren(...views.map(({ view }) => view.el));
    cards.dataset.count = String(views.length);
    const signals = pageNames[index] === "信号与诊断";
    Array.from(stages.options).forEach((option, i) => { option.label = signals ? signalStageNames[i] : frames[i].demo_step; });
    Array.from(pages.children).forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    // Seeking or changing pages reconstructs real prior samples for the trace and encoder direction.
    for (const item of views) {
      if (item.widget.type === "DigitalTimingChart" || item.widget.type === "RotaryEncoder") {
        for (const frame of frames.slice(0, stages.selectedIndex)) deliver(item, frame);
      }
    }
    displayFrame(stages.selectedIndex);
  }

  function updatePlayback() {
    clearInterval(timer);
    playback.textContent = automatic ? "暂停换帧" : "继续换帧";
    if (automatic && !document.hidden) {
      timer = setInterval(() => {
        const next = (stages.selectedIndex + 1) % frames.length;
        if (next === 0) {
          stages.selectedIndex = 0;
          showPage(currentPage);
        } else {
          displayFrame(next);
        }
      }, 2000);
    }
  }

  frames.forEach(frame => stages.add(new Option(frame.demo_step)));
  pageNames.forEach((title, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = title;
    button.addEventListener("click", () => showPage(index));
    pages.append(button);
  });
  stages.addEventListener("change", () => {
    automatic = false;
    updatePlayback();
    showPage(currentPage);
  });
  playback.addEventListener("click", () => {
    automatic = !automatic;
    updatePlayback();
  });
  document.addEventListener("visibilitychange", updatePlayback);
  const requestedPage = new URLSearchParams(location.search).get("page");
  showPage(Math.max(0, pageNames.indexOf(requestedPage)));
  stages.disabled = playback.disabled = false;
  updatePlayback();
}

start().catch(error => {
  const message = document.getElementById("error");
  message.textContent = "无法加载回放文件：" + error.message;
  message.hidden = false;
});
