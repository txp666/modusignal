import i18n from "../i18n.js";
import { assetUrl } from "../asset-url.js";
import {
  CUSTOM_DEVICE_ID,
  DEFAULT_DEVICE_ID,
  DEVICE_PAGE_IDS,
  HART_DEVICE_ID,
  MODBUS_DEVICE_ID,
  MQTT_DEVICE_ID,
  WEBSOCKET_DEVICE_ID,
  isStandaloneDevice,
  listDeviceLibrary,
} from "../protocols.js";

export function createDeviceNavigationUi({ elements, state, getCustomConfig, getModbusConfig }) {
  let searchQuery = "";

  function isDevicePageActive() {
    return DEVICE_PAGE_IDS.includes(state.pageId);
  }

  function updatePage() {
    const isDevice = isDevicePageActive();
    const standalone = isDevice && isStandaloneDevice(state.deviceId);
    elements.pages = [...document.querySelectorAll("[data-page-id]")];
    elements.appShell?.classList.toggle("standalone-device", standalone);
    elements.deviceShell.classList.toggle("active", isDevice);
    elements.deviceShell.classList.toggle("standalone", standalone);
    elements.pages.forEach((page) => {
      if (page.classList.contains("device-page")) {
        page.classList.toggle("active", isDevice && page.dataset.pageId === state.deviceId);
      } else {
        page.classList.toggle("active", !isDevice && page.dataset.pageId === state.pageId);
      }
    });
    document.querySelectorAll("[data-page-target]").forEach((target) => {
      const active = target.dataset.pageTarget === state.pageId
        || (isDevice && target.dataset.deviceId === state.deviceId);
      target.classList.toggle("active", active);
    });
  }

  function createIcon(entry) {
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    if (!entry.profile.image) {
      icon.className = "device-icon";
      icon.textContent = entry.profile.name.slice(0, 1).toUpperCase();
      return icon;
    }
    icon.className = "device-icon has-image";
    const image = document.createElement("img");
    image.src = assetUrl(entry.profile.image);
    image.alt = "";
    icon.append(image);
    return icon;
  }

  function getEntries() {
    return listDeviceLibrary(getCustomConfig(), getModbusConfig());
  }

  function matchesSearch(entry) {
    const normalized = searchQuery.trim().toLowerCase();
    return !normalized || [entry.deviceId, entry.profile.id, entry.profile.name, entry.profile.type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  }

  function handleSearchInput(event) {
    searchQuery = event.target.value;
    renderLibrary();
  }

  function renderLibrary() {
    elements.deviceLibrary.innerHTML = "";
    const entries = getEntries().filter(matchesSearch);
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "device-library-empty";
      empty.textContent = searchQuery.trim() ? i18n("device.noMatch") : i18n("device.libraryEmpty");
      elements.deviceLibrary.append(empty);
      return;
    }
    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "device-item";
      button.type = "button";
      button.dataset.pageTarget = entry.pageTarget;
      button.dataset.deviceId = entry.deviceId;
      const text = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = entry.profile.name;
      if (entry.deviceId === CUSTOM_DEVICE_ID) {
        title.id = "customDeviceNavName";
        elements.customDeviceNavName = title;
      }
      const subtitle = document.createElement("small");
      subtitle.textContent = entry.deviceId === CUSTOM_DEVICE_ID ? i18n("custom.cardDesc") : entry.profile.type;
      text.append(title, subtitle);
      button.append(createIcon(entry), text);
      elements.deviceLibrary.append(button);
    });
  }

  function getSummaryKey(deviceId) {
    if (deviceId === DEFAULT_DEVICE_ID) return "home.aomasterCardDesc";
    if (deviceId === MODBUS_DEVICE_ID) return "home.modbusCardDesc";
    if (deviceId === HART_DEVICE_ID) return "home.hartCardDesc";
    if (deviceId === WEBSOCKET_DEVICE_ID) return "home.card.websocket";
    if (deviceId === MQTT_DEVICE_ID) return "home.mqttCardDesc";
    if (isStandaloneDevice(deviceId)) return "home.microscopePowerCardDesc";
    return "home.customCardDesc";
  }

  function renderHomeCards() {
    const grid = document.querySelector("#homeDeviceGrid");
    if (!grid) return;
    grid.innerHTML = "";
    getEntries().forEach((entry) => {
      const button = document.createElement("button");
      button.className = "home-card";
      button.type = "button";
      button.dataset.pageTarget = entry.pageTarget;
      button.dataset.deviceId = entry.deviceId;
      const body = document.createElement("span");
      body.className = "home-card-body";
      const title = document.createElement("strong");
      title.textContent = entry.profile.name;
      const summary = document.createElement("span");
      summary.textContent = i18n(getSummaryKey(entry.deviceId));
      body.append(title, summary);
      button.append(createIcon(entry), body);
      grid.append(button);
    });

    const requestButton = document.createElement("button");
    requestButton.className = "home-card";
    requestButton.type = "button";
    requestButton.dataset.pageTarget = "request";
    const requestIcon = document.createElement("span");
    requestIcon.className = "device-icon";
    requestIcon.setAttribute("aria-hidden", "true");
    requestIcon.textContent = "R";
    const requestBody = document.createElement("span");
    requestBody.className = "home-card-body";
    const requestTitle = document.createElement("strong");
    requestTitle.textContent = i18n("home.requestDevice");
    const requestSummary = document.createElement("span");
    requestSummary.textContent = i18n("home.requestCardDesc");
    requestBody.append(requestTitle, requestSummary);
    requestButton.append(requestIcon, requestBody);
    grid.append(requestButton);
  }

  return { handleSearchInput, isDevicePageActive, renderHomeCards, renderLibrary, updatePage };
}
