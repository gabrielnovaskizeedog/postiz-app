// Loaded with --require before the backend. The backend sometimes deadlocks
// while booting (main thread stuck in a futex right after connecting to
// Redis, nothing logged). A worker thread keeps running in that case: if the
// API does not answer in time it kills the process and pm2 starts it again.
const { Worker } = require('worker_threads');

const worker = new Worker(
  `
const { workerData } = require('worker_threads');
const fs = require('fs');
const started = Date.now();
let killing = false;

const check = async () => {
  try {
    await fetch('http://127.0.0.1:' + workerData.port + '/', {
      signal: AbortSignal.timeout(5000),
    });
    // Any answer means the server is listening, the watchdog is done
    process.exit(0);
  } catch (err) {}

  if (Date.now() - started > workerData.limit * 1000) {
    if (killing) return;
    killing = true;
    // console.* goes through the (blocked) main thread, write the fd directly
    fs.writeSync(
      2,
      '[boot-watchdog] backend did not start in ' +
        workerData.limit +
        's, killing it so pm2 restarts it\\n'
    );
    process.kill(workerData.pid, 'SIGKILL');
    return;
  }

  setTimeout(check, 5000);
};

setTimeout(check, 5000);
`,
  {
    eval: true,
    workerData: {
      pid: process.pid,
      port: process.env.PORT || 3000,
      limit: +(process.env.BOOT_WATCHDOG_SECONDS || 240),
    },
  }
);

worker.unref();
