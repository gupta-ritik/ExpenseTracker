const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const { readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { resolve } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const fixture = readFileSync(resolve(__dirname, "../../tests/fixtures/alerts/hdfc.txt"), "utf8")
  .replace(/\r\n/g, "\n").split("\n---\n")[0].split("\n").slice(2).join("\n");
const masked = fixture.replace("*1234", "****1234").replace("7308080808", "[PHONE]").replace("18002586161", "[PHONE]");

function adb(...args) {
  return execFileSync("adb", args, { encoding: "utf8", timeout: 10000 }).trim();
}

function packSeptets(text) {
  const bytes = Buffer.alloc(Math.ceil(text.length * 7 / 8));
  for (const [index, char] of Array.from(text).entries()) {
    assert.match(char, /^[\n0-9A-Za-z .,/?:*-]$/);
    const value = char.charCodeAt(0);
    const bit = index * 7;
    bytes[bit >> 3] |= value << (bit % 8);
    if (bit % 8 > 1) bytes[(bit >> 3) + 1] |= value >> (8 - bit % 8);
  }
  return bytes;
}

function inject(text = fixture) {
  const sender = "HDFCBK";
  const command = text.replaceAll("\n", "\\n");
  let direct;
  try {
    direct = adb("emu", "sms", "send", sender, command);
    if (!/\bKO\b/i.test(direct)) return;
  } catch (error) {
    const output = [error.stdout, error.stderr].join(" ");
    if (!/bad phone number|KO.*number/i.test(output)) throw error;
    direct = output;
  }
  assert.match(direct, /phone number|\bKO\b/i);
  assert.ok(text.length <= 160);
  const timestamp = new Date().toISOString().slice(2, 19).replace(/\D/g, "");
  const timestampHex = timestamp.match(/../g).map(([a, b]) => b + a).join("") + "00";
  const pdu = Buffer.concat([
    Buffer.from([0, 4, Math.ceil(sender.length * 7 / 4), 0xd0]),
    packSeptets(sender),
    Buffer.from([0, 0]),
    Buffer.from(timestampHex, "hex"),
    Buffer.from([text.length]),
    packSeptets(text),
  ]).toString("hex");
  assert.doesNotMatch(adb("emu", "sms", "pdu", pdu), /\bKO\b/i);
}

async function main() {
  assert.equal(adb("get-state"), "device");
  adb("logcat", "-c");
  const requests = [];
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, ...json });
      res.writeHead([503, 200, 401][requests.length - 1] ?? 500, { "Content-Type": "application/json" });
      res.end("{}");
    } catch {
      res.writeHead(400).end();
    }
  });
  server.listen(18764, "127.0.0.1");
  await once(server, "listening");
  const windows = process.platform === "win32";
  const tests = spawn(windows ? "gradlew.bat" : "./gradlew", [":bank-sms:connectedDebugAndroidTest"], {
    cwd: resolve(__dirname, "../android"), shell: windows, stdio: "inherit",
  });
  let finished = false;
  try {
    const completion = once(tests, "exit").then(([status]) => { finished = true; return status; });
    const deadline = Date.now() + 600000;
    while (!adb("logcat", "-d", "-s", "BankSmsTest:I").includes("READY_FOR_SMS")) {
      if (finished || Date.now() > deadline) throw new Error("Instrumentation did not prepare the SMS receiver.");
      await delay(500);
    }
    inject();
    assert.equal(await completion, 0);
    assert.equal(requests.length, 3);
    for (const request of requests) {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/api/ingest/sms");
      assert.equal(request.auth, "Bearer mock-device-token");
      assert.equal(request.messages.length, 1);
    }
    assert.equal(requests[0].messages[0].sender, "HDFCBK");
    assert.equal(requests[0].messages[0].text, masked);
    assert.deepEqual(requests[0].messages, requests[1].messages);
    console.log("Verified masked SMS delivery, 503 retry and 401 queue retention.");
  } finally {
    if (!finished) tests.kill();
    server.close();
  }
}

async function run() {
  if (process.argv[2] === "--inject") {
    const reference = process.argv[3] ?? "433112345678";
    assert.match(reference, /^\d{12}$/);
    inject(fixture.replace("433112345678", reference));
    return;
  }
  await main();
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
