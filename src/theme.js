import i18n from "./i18n.js";

const THEME_STORAGE_KEY = "modusignal-theme";
const DARK_THEME_QUERY = "(prefers-color-scheme: dark)";

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function getSystemTheme() {
  return window.matchMedia?.(DARK_THEME_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent("modusignal:themechange", { detail: { theme } }));
}

function updateButton(button, theme) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = i18n(`theme.switchTo.${nextTheme}`);
  button.textContent = nextTheme === "dark" ? "☾" : "☀";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.setAttribute("aria-pressed", String(theme === "dark"));
}

export function initTheme(button) {
  const mediaQuery = window.matchMedia?.(DARK_THEME_QUERY);
  let theme = readStoredTheme() ?? getSystemTheme();

  applyTheme(theme);
  if (button) {
    updateButton(button, theme);
    button.addEventListener("click", () => {
      theme = theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // The selected theme still applies for this session when storage is unavailable.
      }
      applyTheme(theme);
      updateButton(button, theme);
    });
  }

  const handleSystemThemeChange = (event) => {
    if (readStoredTheme()) return;
    theme = event.matches ? "dark" : "light";
    applyTheme(theme);
    if (button) updateButton(button, theme);
  };
  mediaQuery?.addEventListener?.("change", handleSystemThemeChange);

  return {
    refreshLabel() {
      if (button) updateButton(button, theme);
    },
  };
}
