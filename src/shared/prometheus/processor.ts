import PromClient from "prom-client";

export const prom_client: typeof PromClient = PromClient;

//
// CONSUMER
//

export const consumer_histogram: PromClient.Histogram<"task"> =
  new prom_client.Histogram({
    name: "processor_processing_seconds",
    help: "The latency of processing blocks.",
    labelNames: ["task"],
    buckets: [0.0005, 0.001, 0.005, 0.01, 0.05, 1, 3],
  });
export const consumer_counter: PromClient.Counter<"task"> =
  new prom_client.Counter({
    name: "processor_block_processed",
    help: "Number of block processed.",
    labelNames: ["task"],
  });
