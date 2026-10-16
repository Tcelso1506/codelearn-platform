import { env } from "./config/env";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`API rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
