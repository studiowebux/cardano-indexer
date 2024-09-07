import PromClient from "prom-client";

export const prom_client: typeof PromClient = PromClient;

//
// INDEXER
//

export const processing_histogram = new prom_client.Histogram({
  name: "processing_ms",
  help: "The latency of processing blocks.",
  labelNames: ["task"],
  buckets: [0.001, 0.005, 0.01, 0.05, 1, 3],
});
export const processing_counter = new prom_client.Counter({
  name: "block_processed",
  help: "Number of block processed.",
  labelNames: ["task"],
});
export const published_counter = new prom_client.Counter({
  name: "block_published",
  help: "Number of block published to kafka.",
  labelNames: ["task"],
});
export const indexer_running = new prom_client.Gauge({
  name: "indexer_running",
  help: "Track indexer running or not.",
});

//
// CONSUMER
//

export const consumer_histogram = new prom_client.Histogram({
  name: "consumer_processing_ms",
  help: "The latency of processing blocks.",
  labelNames: ["task"],
  buckets: [0.001, 0.005, 0.01, 0.05, 1, 3],
});
export const consumer_counter = new prom_client.Counter({
  name: "consumer_block_processed",
  help: "Number of block processed.",
  labelNames: ["task"],
});
