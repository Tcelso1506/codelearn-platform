import pino from "pino";
import { env } from "../config/env";

// Em desenvolvimento, formato legível; em produção, JSON puro (o que qualquer
// agregador de logs — Loki, CloudWatch, Datadog etc. — espera consumir).
// Nunca registrar credenciais: o serializer padrão do pino-http inclui os headers da requisição.
export const redactConfig = {
  paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
  remove: true,
};

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: redactConfig,
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
