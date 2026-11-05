import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import {
  createCosAuthorization,
  isAllowedDownloadPath,
} from "../workers/cos-download-proxy/src/index.js";

function referenceAuthorization({ method, pathname, host, secretId, secretKey, nowSeconds, validitySeconds }) {
  const keyTime = `${nowSeconds - 60};${nowSeconds + validitySeconds}`;
  const httpString = `${method.toLowerCase()}\n${pathname}\n\nhost=${host}\n`;
  const signKey = createHmac("sha1", secretKey).update(keyTime).digest("hex");
  const stringToSign = `sha1\n${keyTime}\n${createHash("sha1").update(httpString).digest("hex")}\n`;
  const signature = createHmac("sha1", signKey).update(stringToSign).digest("hex");
  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;
}

test("COS authorization follows the V5 HMAC-SHA1 request-signing algorithm", async () => {
  const input = {
    method: "GET",
    pathname: "/HARTLinkStudio/ota/releases/v0.3.7/HARTLinkStudio-0.3.7-windows-x64-setup.exe",
    host: "hartlinkstudio-ota-ap-1257631357.cos.ap-hongkong.myqcloud.com",
    secretId: "AKIDEXAMPLE",
    secretKey: "secret-example-value",
    nowSeconds: 1_722_300_000,
    validitySeconds: 600,
  };

  assert.equal(await createCosAuthorization(input), referenceAuthorization(input));
});

test("download path validation confines requests to the configured OTA prefix", () => {
  assert.equal(isAllowedDownloadPath("/HARTLinkStudio/ota/latest.json"), true);
  assert.equal(isAllowedDownloadPath("/HARTForgeStudio/ota/latest.json"), true);
  assert.equal(
    isAllowedDownloadPath("/HARTLinkStudio/ota/releases/v0.3.7/HARTLinkStudio-0.3.7-macos-arm64.dmg"),
    true,
  );
  assert.equal(
    isAllowedDownloadPath("/HARTForgeStudio/ota/releases/v0.1.0/HARTForgeStudio-0.1.0-macos-arm64.dmg"),
    true,
  );
  assert.equal(isAllowedDownloadPath("/HARTLinkStudio/ota/../private.txt"), false);
  assert.equal(isAllowedDownloadPath("/HARTLinkStudio/ota/%2e%2e/private.txt"), false);
  assert.equal(isAllowedDownloadPath("/other-prefix/latest.json"), false);
  assert.equal(isAllowedDownloadPath("/HARTForgeStudio/private/latest.json"), false);
  assert.equal(isAllowedDownloadPath("/HARTLinkStudio/ota//latest.json"), false);
  assert.equal(isAllowedDownloadPath("/HARTForgeStudio/ota/latest.json", "HARTLinkStudio/ota"), false);
  assert.equal(
    isAllowedDownloadPath(
      "/HARTForgeStudio/ota/latest.json",
      "HARTLinkStudio/ota,HARTForgeStudio/ota",
    ),
    true,
  );
});
