import { assetUrl } from "./asset-url.js";
import { DEVICE_REGISTRY } from "./device-registry.js";
import i18n from "./i18n.js";

const PAGE_PATHS = {
  home: "pages/home.html",
  request: "pages/request.html",
  workbench: "pages/shared/workbench.html",
  devices: Object.fromEntries(DEVICE_REGISTRY.map((entry) => [entry.id, entry.pagePath])),
};

async function fetchPageFragment(path) {
  const response = await fetch(assetUrl(path));
  if (!response.ok) {
    throw new Error(`${i18n("pageLoader.cannotLoad")} ${path}（${response.status}）`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const fragment = document.createDocumentFragment();

  [...doc.body.children].forEach((node) => {
    fragment.append(node);
  });

  return fragment;
}

function mountFragment(host, fragment) {
  if (!host) {
    throw new Error(i18n("pageLoader.noMount"));
  }

  host.replaceChildren(fragment);
  i18n.apply(host);
}

export async function loadAppPages() {
  const deviceLoads = DEVICE_REGISTRY.map((entry) => fetchPageFragment(entry.pagePath));
  const [home, request, workbench, ...deviceFragments] = await Promise.all([
    fetchPageFragment(PAGE_PATHS.home),
    fetchPageFragment(PAGE_PATHS.request),
    fetchPageFragment(PAGE_PATHS.workbench),
    ...deviceLoads,
  ]);

  mountFragment(document.querySelector("#homeMount"), home);
  mountFragment(document.querySelector("#requestMount"), request);
  const deviceHost = document.querySelector("#devicePagesMount");
  deviceHost.replaceChildren();
  deviceHost.append(...deviceFragments);
  i18n.apply(deviceHost);
  mountFragment(document.querySelector("#workbenchMount"), workbench);
}

export { PAGE_PATHS };
