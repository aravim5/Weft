// TODO: Phase 8/9/12 — cron worker for biweekly reminders, cycle reminders, decay signals
import cron from "node-cron";

console.log("Cron worker started.");

// Every Monday at 7am — biweekly check-in reminders
cron.schedule("0 7 * * 1", () => {
  console.log("[cron] biweekly-reminders — TODO: implement Phase 8");
});

// Daily at 2am — decay signal check
cron.schedule("0 2 * * *", () => {
  console.log("[cron] decay-signals — TODO: implement Phase 12");
});

// Every Monday at 8am — cycle countdown reminders
cron.schedule("0 8 * * 1", () => {
  console.log("[cron] cycle-reminders — TODO: implement Phase 9");
});
