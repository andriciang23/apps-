import "dotenv/config";
import { validateEnv } from "./config/env.js";
import { createServer } from "./server.js";
import { selfCheck } from "./startup.js";

const missing = validateEnv();
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error(
    "META_APP_SECRET and OWNER_PHONE_NUMBERS are required, not optional: without them the " +
      "webhook cannot verify who is talking to it."
  );
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

createServer().listen(port, () => {
  console.log(`hojichaya-ops-assistant listening on ${port}`);

  // Runs after the listener is up so /healthz answers immediately: the service
  // supervisor should see a healthy process even while the checks are in flight.
  selfCheck().catch((err) => console.error("[startup] self-check crashed:", err));
});
