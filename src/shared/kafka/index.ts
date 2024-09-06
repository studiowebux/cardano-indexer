import { Kafka } from "kafkajs";

import { env } from "../env.ts";

export const kafkaProducer = new Kafka({
  clientId: "indexer-producer",
  brokers: env.KAFKA_HOSTS.split(","),
});

export const kafkaConsumer = new Kafka({
  clientId: "indexer-consumer",
  brokers: env.KAFKA_HOSTS.split(","),
});
