import Logger from "@studiowebux/deno-minilog";
import { hrtime } from "node:process";

import { BLOCK_TOPIC } from "../../src/shared/constant.ts";
import { kafkaConsumer } from "../../src/shared/kafka/index.ts";
import { processMessage } from "./processor.ts";
import { exponentialRetry } from "../../src/shared/utils/retry.ts";
import {
  consumer_counter,
  consumer_histogram,
  prom_client,
} from "../../src/shared/prometheus/index.ts";

const logger = new Logger();

const consumer = kafkaConsumer.consumer({ groupId: "indexer" });

await consumer.connect();
await consumer.subscribe({ topic: BLOCK_TOPIC, fromBeginning: true });

setInterval(async () => {
  logger.info(await prom_client.register.metrics());
}, 10000);

await consumer.run({
  // topic, partition, heartbeat
  eachMessage: async ({ message, pause }) => {
    const start = hrtime();
    const key = message.key?.toString();
    const value = message.value?.toString();
    logger.info(`Received message: ${key} - ${value?.length}`);

    try {
      await exponentialRetry<void>(() => processMessage(logger, key, value));
    } catch (e) {
      logger.error("Something went wrong", e);
      pause();
    } finally {
      const end = hrtime(start);
      consumer_counter.inc({ task: "store" });
      consumer_histogram.observe(
        { task: "store" },
        end[0] + end[1] / Math.pow(10, 9),
      );
    }
  },
});
