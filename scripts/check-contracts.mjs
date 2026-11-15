import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
for (const [app, source] of [
  ["src/lib/orbita/client.ts", "API/sdk/typescript/client.ts"],
  ["src/lib/orbita/schema.ts", "API/sdk/typescript/schema.ts"],
  ["src/app/api/mission/[...path]/route.ts", "API/integrations/nextjs/app/api/mission/[...path]/route.ts"],
]) {
  assert.equal(readFileSync(new URL(app, root), "utf8").replaceAll("\r\n", "\n").trim(), readFileSync(new URL(source, root), "utf8").replaceAll("\r\n", "\n").trim(), `${app} difiere de ${source}`);
}
console.log("SDK, esquema y proxy del frontend coinciden con el contrato del backend.");
