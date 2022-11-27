import * as log from 'https://deno.land/std@0.165.0/log/mod.ts'

export async function getLogger() {
  await log.setup({
    //define handlers
    handlers: {
      console: new log.handlers.ConsoleHandler("DEBUG", {
        formatter: "{levelName} {msg}"
      }),
      file: new log.handlers.RotatingFileHandler('INFO', {
        filename: './log/log.txt',
        maxBytes: 10485760,
        maxBackupCount: 1,
        formatter: rec => JSON.stringify({ app: rec.datetime, level: rec.levelName, msg: rec.msg })
      })
    },

    //assign handlers to loggers  
    loggers: {
      default: {
        level: "DEBUG",
        handlers: ["console", "file"],
      },
      client: {
        level: "INFO",
        handlers: ["console", "file"]
      }
    },
  });
  const logger = log.getLogger("client")
  return logger
}
