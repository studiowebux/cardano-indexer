import Logger from "@studiowebux/deno-minilog";
import PromClient from "prom-client";
import { hrtime } from "node:process";

import { BLOCK_TOPIC } from "../../src/shared/constant.ts";
import { kafkaConsumer } from "../../src/shared/kafka/index.ts";
import { processMessage } from "./processor.ts";
import { exponentialRetry } from "../../src/shared/utils/retry.ts";

const logger = new Logger();

const prom_client = PromClient;
const processing_histogram = new prom_client.Histogram({
  name: "consumer_processing_ms",
  help: "The latency of processing blocks.",
  labelNames: ["task"],
  buckets: [0.001, 0.005, 0.01, 0.05, 1, 3],
});
const processing_counter = new prom_client.Counter({
  name: "consumer_block_processed",
  help: "Number of block processed.",
  labelNames: ["task"],
});

const consumer = kafkaConsumer.consumer({ groupId: "indexer" });

await consumer.connect();
await consumer.subscribe({ topic: BLOCK_TOPIC, fromBeginning: true });

setInterval(async () => {
  logger.info(await prom_client.register.metrics());
}, 10000);

await consumer.run({
  eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
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
      processing_counter.inc({ task: "store" });
      processing_histogram.observe(
        { task: "store" },
        end[0] + end[1] / Math.pow(10, 9),
      );
    }
  },
});
