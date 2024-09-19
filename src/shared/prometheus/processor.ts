import PromClient from "prom-client";

export const prom_client_processor: typeof PromClient = PromClient;
export const processor_registry: PromClient.Registry<"text/plain; version=0.0.4; charset=utf-8"> =
  new prom_client_processor.Registry();

//
// CONSUMER
//

export const consumer_histogram: PromClient.Histogram<"task"> =
  new prom_client_processor.Histogram({
    name: "processor_processing_seconds",
    help: "The latency of processing blocks.",
    labelNames: ["task"],
    buckets: [0.0005, 0.001, 0.005, 0.01, 0.05, 1, 3],
    registers: [processor_registry],
  });
export const consumer_counter: PromClient.Counter<"task"> =
  new prom_client_processor.Counter({
    name: "processor_block_processed",
    help: "Number of block processed.",
    labelNames: ["task"],
    registers: [processor_registry],
  });
