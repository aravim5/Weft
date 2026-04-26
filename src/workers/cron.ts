// Cron worker — run with: npm run cron
// Calls Next.js API routes so the app server must be running on port 3000
import cron from "node-cron";

const BASE = process.env.APP_URL ?? "http://localhost:3000";

async function callRoute(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, { method: "POST" });
    const json = await res.json();
    console.log(`[cron] ${path}`, json);
  } catch (err) {
    console.error(`[cron] ${path} failed:`, err);
  }
}

console.log("Cron worker started. BASE:", BASE);

// Every other Monday at 7am — biweekly check-in reminders
cron.schedule("0 7 * * 1", () => {
  const weekNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  if (weekNum % 2 === 0) callRoute("/api/cron/biweekly-reminders");
});

// Daily at 2am — decay signal check
cron.schedule("0 2 * * *", () => {
  callRoute("/api/cron/decay-signals");
});

// Every Monday at 8am — cycle countdown reminders
cron.schedule("0 8 * * 1", () => {
  callRoute("/api/cron/cycle-reminders");
});
