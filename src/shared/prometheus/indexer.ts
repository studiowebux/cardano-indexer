import PromClient from "prom-client";

export const prom_client_indexer: typeof PromClient = PromClient;
export const indexer_registry: PromClient.Registry<"text/plain; version=0.0.4; charset=utf-8"> =
  new prom_client_indexer.Registry();

//
// INDEXER
//

export const processing_histogram: PromClient.Histogram<"task"> =
  new prom_client_indexer.Histogram({
    name: "indexer_filter_check_seconds",
    help: "The latency of processing blocks.",
    labelNames: ["task"],
    buckets: [0.0005, 0.001, 0.005, 0.01, 0.05, 1, 3],
    registers: [indexer_registry],
  });
export const block_size_histogram: PromClient.Histogram<"blockSize"> =
  new prom_client_indexer.Histogram({
    name: "indexer_block_size",
    help: "The size of processing blocks.",
    labelNames: ["blockSize"],
    buckets: [0, 1000, 5000, 10000, 50000, 100000, 200000, 500000, 1000000],
    registers: [indexer_registry],
  });

export const processing_counter: PromClient.Counter<"task"> =
  new prom_client_indexer.Counter({
    name: "indexer_block_processed",
    help: "Number of block processed.",
    labelNames: ["task"],
    registers: [indexer_registry],
  });
export const published_counter: PromClient.Counter<"task"> =
  new prom_client_indexer.Counter({
    name: "indexer_block_published",
    help: "Number of block published to kafka.",
    labelNames: ["task"],
    registers: [indexer_registry],
  });
export const indexer_running: PromClient.Gauge<string> =
  new prom_client_indexer.Gauge({
    name: "indexer_running",
    help: "Track indexer running or not.",
    registers: [indexer_registry],
  });
export const indexer_tip_slot: PromClient.Gauge<string> =
  new prom_client_indexer.Gauge({
    name: "indexer_tip_slot",
    help: "Track indexer tip (slot).",
    registers: [indexer_registry],
  });
export const indexer_tip_height: PromClient.Gauge<string> =
  new prom_client_indexer.Gauge({
    name: "indexer_tip_height",
    help: "Track indexer tip (height).",
    registers: [indexer_registry],
  });

export const local_queue_size: PromClient.Gauge<string> =
  new prom_client_indexer.Gauge({
    name: "indexer_local_queue_size",
    help: "Track indexer Local queue.",
    registers: [indexer_registry],
  });

export const indexer_tip_synced: PromClient.Gauge<string> =
  new prom_client_indexer.Gauge({
    name: "indexer_tip_synced",
    help: "Track indexer Tip synchronosity.",
    registers: [indexer_registry],
  });

export const indexer_error_count: PromClient.Counter<"error"> =
  new prom_client_indexer.Counter({
    name: "indexer_error_count",
    help: "Number of errors.",
    labelNames: ["error"],
    registers: [indexer_registry],
  });

export const indexer_stopped_count: PromClient.Counter<"occurence"> =
  new prom_client_indexer.Counter({
    name: "indexer_stopped_count",
    help: "Number of time stopped.",
    labelNames: ["occurence"],
    registers: [indexer_registry],
  });

export const indexer_started_count: PromClient.Counter<"occurence"> =
  new prom_client_indexer.Counter({
    name: "indexer_started_count",
    help: "Number of time started.",
    labelNames: ["occurence"],
    registers: [indexer_registry],
  });

export function register_metric(id: string): PromClient.Counter<string> {
  return new prom_client_indexer.Counter({
    name: id,
    help: `Filter Metric for ${id}`,
    registers: [indexer_registry],
  });
}
