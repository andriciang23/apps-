import "dotenv/config";
import { createServer } from "./server.js";

const requiredEnvVars = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_ADMIN_ACCESS_TOKEN",
  "ANTHROPIC_API_KEY",
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.META_APP_SECRET) {
  console.warn(
    "META_APP_SECRET is not set: incoming webhook signatures will not be verified. " +
      "Set it before deploying to production."
  );
}

const port = Number(process.env.PORT) || 3000;
const app = createServer();

app.listen(port, () => {
  console.log(`whatsapp-shopify-agent listening on port ${port}`);
});
