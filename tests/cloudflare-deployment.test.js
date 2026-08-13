import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production Worker deploys to the modusignal.cn custom domain", async () => {
  const config = JSON.parse(
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );

  assert.equal(config.name, "modusignal");
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.routes, [
    {
      pattern: "modusignal.cn",
      custom_domain: true,
    },
  ]);
});
