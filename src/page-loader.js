import { assetUrl } from "./asset-url.js";

const PAGE_PATHS = {
  home: "pages/home.html",
  request: "pages/request.html",
  workbench: "pages/shared/workbench.html",
  devices: {
    aomaster: "pages/devices/aomaster.html",
    modbus: "pages/devices/modbus.html",
    hart: "pages/devices/hart.html",
    custom: "pages/devices/custom.html",
  },
};

async function fetchPageFragment(path) {
  const response = await fetch(assetUrl(path));
  if (!response.ok) {
    throw new Error(`无法加载页面片段 ${path}（${response.status}）`);
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
    throw new Error("页面挂载点不存在");
  }

  host.replaceChildren(fragment);
}

export async function loadAppPages() {
  const [home, request, workbench, aomaster, modbus, hart, custom] = await Promise.all([
    fetchPageFragment(PAGE_PATHS.home),
    fetchPageFragment(PAGE_PATHS.request),
    fetchPageFragment(PAGE_PATHS.workbench),
    fetchPageFragment(PAGE_PATHS.devices.aomaster),
    fetchPageFragment(PAGE_PATHS.devices.modbus),
    fetchPageFragment(PAGE_PATHS.devices.hart),
    fetchPageFragment(PAGE_PATHS.devices.custom),
  ]);

  mountFragment(document.querySelector("#homeMount"), home);
  mountFragment(document.querySelector("#requestMount"), request);
  const deviceHost = document.querySelector("#devicePagesMount");
  deviceHost.replaceChildren();
  deviceHost.append(aomaster, modbus, hart, custom);
  mountFragment(document.querySelector("#workbenchMount"), workbench);
}

export { PAGE_PATHS };
