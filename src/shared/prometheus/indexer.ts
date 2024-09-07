import PromClient from "prom-client";

export const prom_client: typeof PromClient = PromClient;

//
// INDEXER
//

export const processing_histogram = new prom_client.Histogram({
  name: "processing_ms",
  help: "The latency of processing blocks.",
  labelNames: ["task"],
  buckets: [0.0005, 0.001, 0.005, 0.01, 0.05, 1, 3],
});
export const block_size_histogram = new prom_client.Histogram({
  name: "block_size",
  help: "The size of processing blocks.",
  labelNames: ["blockSize"],
  buckets: [0, 1000, 5000, 10000, 50000, 100000, 200000, 500000, 1000000],
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
export const indexer_tip_slot = new prom_client.Gauge({
  name: "indexer_tip_slot",
  help: "Track indexer tip (slot).",
});
export const indexer_tip_height = new prom_client.Gauge({
  name: "indexer_tip_height",
  help: "Track indexer tip (height).",
});

export const local_queue_size = new prom_client.Gauge({
  name: "indexer_local_queue_size",
  help: "Track indexer Local queue.",
});

export const indexer_tip_synced = new prom_client.Gauge({
  name: "indexer_tip_synced",
  help: "Track indexer Tip synchronosity.",
});
