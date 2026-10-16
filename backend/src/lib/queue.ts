import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";

// maxRetriesPerRequest: null é exigido pelo BullMQ para conexões usadas em filas.
export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const codeExecutionQueue = new Queue("code-execution", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1, // execução de código não deve ser reprocessada automaticamente
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
