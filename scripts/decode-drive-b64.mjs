import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const src =
  process.env.AGENT_TOOL_FILE ||
  "C:/Users/amull/.cursor/projects/c-Users-amull-Documents-des-psd-automation/agent-tools/c9f40d0d-7d5b-4913-919d-02f0b9afb7d5.txt";
const dest = "fixtures/references/SAMPLE_reference_not_schema.psd";
mkdirSync(dirname(dest), { recursive: true });
const j = JSON.parse(readFileSync(src, "utf8"));
const b64 = j.base64Content || j.content || j.data;
if (!b64) {
  console.error("keys", Object.keys(j));
  process.exit(1);
}
const buf = Buffer.from(b64, "base64");
writeFileSync(dest, buf);
console.log("wrote", dest, buf.length);
