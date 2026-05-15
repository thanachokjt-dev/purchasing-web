import { execFile } from "node:child_process";
import os from "node:os";

const PORT = 3000;

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function getListeningPids(netstatOutput) {
  const pids = new Set();

  for (const line of netstatOutput.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);

    if (columns.length < 5 || columns[0] !== "TCP") {
      continue;
    }

    const localAddress = columns[1];
    const state = columns[3];
    const pid = columns[4];

    if (state !== "LISTENING") {
      continue;
    }

    if (localAddress.endsWith(`:${PORT}`) && /^\d+$/.test(pid)) {
      pids.add(pid);
    }
  }

  return [...pids];
}

async function waitForPortToClear() {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const { stdout } = await run("netstat", ["-ano"]);
    const pids = getListeningPids(stdout);

    if (pids.length === 0) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

async function main() {
  if (os.platform() !== "win32") {
    console.log("kill:3000 is intended for Windows local development.");
    console.log("No process killed.");
    return;
  }

  const { stdout } = await run("netstat", ["-ano"]);
  const pids = getListeningPids(stdout);

  if (pids.length === 0) {
    console.log(`No process found on port ${PORT}`);
    return;
  }

  for (const pid of pids) {
    console.log(`Killing stale process PID ${pid}`);
    await run("taskkill", ["/PID", pid, "/T", "/F"]);
  }

  if (await waitForPortToClear()) {
    console.log(`Port ${PORT} cleared`);
    return;
  }

  throw new Error(`Port ${PORT} is still occupied after taskkill.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
