import type { Origin, Point, Tip } from "@cardano-ogmios/schema";
import {
  type ChainSynchronization,
  createChainSynchronizationClient,
  getServerHealth,
} from "@cardano-ogmios/client";
import PromClient, { type Counter, type Gauge, type Histogram } from "prom-client";
import type { Producer } from "kafkajs";
import type Logger from "@studiowebux/deno-minilog";
import type { Document, UpdateResult } from "mongodb";
import { hrtime } from "node:process";

import type { Cursor, LocalBlock, Match } from "../../shared/types.ts";
import { kafkaProducer } from "../../shared/kafka/index.ts";
import { BLOCK_TOPIC } from "../../shared/constant.ts";

import type { Hooks } from "../hook/index.ts";
import { context } from "../ogmios/context.ts";
import { replacer } from "../utils/index.ts";
import {
  indexer_running,
  processing_counter,
  processing_histogram,
  published_counter,
} from "../../shared/prometheus/index.ts";

export class Indexer {
  private client: ChainSynchronization.ChainSynchronizationClient | null = null; // ogmios client
  private producer: Producer; // kafka producer
  private start_point: string[] | Cursor[] = [];
  private current_intersection: Cursor | null = null;
  private queued_intersection: Cursor | null = null;
  private local_queue: { block: LocalBlock; matches: Record<string, Match> }[] =
    [];
  private block_to_wait: number = 6;
  private hooks: Hooks;
  private tip_synced: boolean = false;
  private logger: Logger;

  private status: {
    started_at: Date | undefined;
    stopped_at: Date | undefined;
    state: "ACTIVE" | "INACTIVE";
  };

  private snapshot_interval: number;

  private upsert_cursor:
    | ((
        logger: Logger,
        cursor: Cursor | "origin",
      ) => Promise<UpdateResult<Document> | void>)
    | undefined;

  private prom_client: typeof PromClient;
  private processing_histogram: Histogram;
  private processing_counter: Counter;
  private published_counter: Counter;
  private indexer_running: Gauge;

  constructor(
    hooks: Hooks,
    logger: Logger,
    start_point: string[] | Cursor[] = ["origin"],
    block_to_wait = 6,
    upsert_cursor:
      | ((
          logger: Logger,
          cursor: Cursor | "origin",
        ) => Promise<UpdateResult<Document> | void>)
      | undefined = undefined,
    snapshot_interval = 60 * 1000,
  ) {
    this.logger = logger;
    this.start_point = start_point;
    this.snapshot_interval = snapshot_interval;

    // MongoDB External Queries
    this.upsert_cursor = upsert_cursor;

    this.status = {
      started_at: undefined,
      stopped_at: undefined,
      state: "INACTIVE",
    };

    this.block_to_wait = block_to_wait;
    this.hooks = hooks;

    this.producer = kafkaProducer.producer();
    this.Setup();

    this.producer.on("producer.disconnect", () => {
      this.logger.warn("Kafka producer disconnected.");
    });
    this.producer.on("producer.network.request_timeout", () => {
      this.logger.error("Kafka producer request has timeout.");
    });

    this.prom_client = PromClient;
    this.processing_histogram = processing_histogram;
    this.processing_counter = processing_counter;
    this.published_counter = published_counter;
    this.indexer_running = indexer_running;

    setInterval(async () => {
      this.logger.info("Saving cursor to database.");
      await this.SaveCursor();
    }, this.snapshot_interval);
  }

  Setup(): Indexer {
    this.logger.info(`Trying to start the indexer`);
    this.producer.on("producer.connect", async () => {
      this.logger.info("Kafka producer connected.");
      // Reset metrics from prometheus
      this.processing_counter.reset();
      this.processing_histogram.reset();
      this.published_counter.reset();
      this.indexer_running.reset();

      const intersection = await this.client?.resume(
        this.start_point as Point[],
      );
      this.logger.info("Ogmios Client Started.");
      this.indexer_running.set(1);
      this.current_intersection = intersection?.intersection as Cursor;
      this.status.started_at = new Date();
      this.status.stopped_at = undefined;
      this.status.state = "ACTIVE";
    });

    return this;
  }

  async Stop(): Promise<Indexer> {
    await this.client?.shutdown();
    this.logger.info("Ogmios Client Stopped.");
    await this.producer.disconnect();
    this.logger.info("Kafka Producer Stopped.");

    this.status.started_at = undefined;
    this.status.stopped_at = new Date();
    this.status.state = "INACTIVE";

    await this.SaveCursor();
    this.indexer_running.set(0);
    return this;
  }

  GetStatus() {
    return this.status;
  }

  GetCurrentIntersection() {
    return this.current_intersection;
  }

  async SaveCursor() {
    if (this.upsert_cursor) {
      if (this.queued_intersection) {
        this.logger.info("Save cursor at", this.queued_intersection);
        await this.upsert_cursor(this.logger, this.queued_intersection);
        return;
      } else if (this.current_intersection) {
        this.logger.info("Save cursor at", this.current_intersection);
        await this.upsert_cursor(this.logger, this.current_intersection);
        return;
      }
      this.logger.error("Unable to save the cursor.");
    }
  }

  async GetOgmiosServerHealth() {
    const ctx = await context(this.logger);
    return await getServerHealth({ connection: ctx.connection });
  }

  async RollForward(
    { block, tip }: { block: LocalBlock; tip: Tip | Origin },
    requestNextBlock: () => void,
  ) {
    const start = hrtime();
    if (!block.slot) {
      this.logger.warn("Block slot is undefined", block);
    }
    this.current_intersection = { id: block.id, slot: block.slot };
    await this.ProcessQueue(tip);
    await this.Process(block);

    if (tip !== "origin" && tip.slot === block.slot) {
      if (this.tip_synced === false) {
        this.logger.info("Tip is synced", tip);
      }
      this.tip_synced = true;
    } else {
      if (this.tip_synced === true) {
        this.logger.warn("Tip is out of synced", tip);
      }
      this.tip_synced = false;
    }

    requestNextBlock();
    const end = hrtime(start);
    this.processing_counter.inc({ task: "rollForward" });
    this.processing_histogram.observe(
      { task: "rollForward" },
      end[0] + end[1] / Math.pow(10, 9),
    );
  }

  async RollBackard(
    { point }: { point: "origin" | Point },
    requestNextBlock: () => void,
  ) {
    const start = hrtime();

    // Reset cursor
    if (this.upsert_cursor) {
      await this.upsert_cursor(this.logger, point);
    }
    if (point !== "origin") {
      this.current_intersection = point;
      // Clean the local queue
      this.local_queue = this.local_queue.filter(
        (lq) => lq.block.slot < point.slot,
      );
    } else {
      this.current_intersection = null;
      this.local_queue = [];
    }

    this.tip_synced = false;

    await this.Rollback(point);

    requestNextBlock();
    const end = hrtime(start);
    this.processing_counter.inc({ task: "rollBackward" });
    this.processing_histogram.observe(
      { task: "rollBackward" },
      end[0] + end[1] / Math.pow(10, 9),
    );
  }

  async ConnectAndStart(): Promise<Indexer> {
    this.logger.info("Connect and start the indexer.");
    await this.producer.connect();
    return this;
  }

  async Initialize(): Promise<Indexer> {
    this.logger.info("Initialize indexer.");
    this.client = await createChainSynchronizationClient(
      await context(this.logger),
      {
        rollForward: (
          { block, tip }: { block: LocalBlock; tip: Tip | Origin },
          requestNextBlock: () => void,
        ) => this.RollForward({ block, tip }, requestNextBlock),

        rollBackward: ({ point }, requestNextBlock: () => void) =>
          this.RollBackard({ point }, requestNextBlock),
      },
      {
        sequential: true,
      },
    );

    return this;
  }

  async Process(block: LocalBlock) {
    const matches = await this.hooks.Match(block);
    if (Object.values(matches).some((match) => match.matches)) {
      const data = {
        block,
        matches,
      };
      // Queue locally
      if (this.block_to_wait > 0) {
        this.local_queue.push(data);
      } else {
        await this.Publish(data);
      }
    }
  }

  async Publish(data: { block: LocalBlock; matches: Record<string, Match> }) {
    await this.producer.send({
      topic: BLOCK_TOPIC,
      messages: [{ key: data.block.id, value: JSON.stringify(data, replacer) }],
    });
    this.published_counter.inc();
    this.logger.info(
      `Message ${data.block.id}/${data.block.slot} sent successfully`,
    );
    // Set or reset the current intersection to avoid losing pending blocks
    this.current_intersection = {
      id: data.block.id,
      slot: data.block.slot,
    };
  }

  async ProcessQueue(tip: Tip | Origin) {
    if (this.local_queue.length > 0) {
      this.logger.info(
        "Check block(s) in local queue: ",
        this.local_queue.length,
      );
      const processed_blocks: string[] = [];
      for (const queued_block of this.local_queue) {
        if (
          tip !== "origin" &&
          tip.slot &&
          tip.slot - queued_block.block.slot > this.block_to_wait
        ) {
          await this.Publish(queued_block);
          processed_blocks.push(queued_block.block.id);
        }
      }
      this.local_queue = this.local_queue.filter(
        (lq) => !processed_blocks.includes(lq.block.id),
      );
      // Tracking the queue intersection to save the cursor at the correct location to avoid losing queued blocks.
      if (this.local_queue.length > 0) {
        this.queued_intersection = {
          id: this.local_queue[0].block.id,
          slot: this.local_queue[0].block.slot,
        };
      } else {
        this.queued_intersection = null;
      }
    }
  }

  async Rollback(tip: Point | Tip | Origin) {
    await this.producer.send({
      topic: BLOCK_TOPIC,
      messages: [
        {
          key: tip !== "origin" ? tip.slot.toString() : tip,
          value: JSON.stringify(
            {
              block: null,
              matches: {},
              rollback: tip,
            },
            replacer,
          ),
        },
      ],
    });
    this.logger.info(
      `Message ${tip !== "origin" ? tip.slot : tip}/${tip !== "origin" ? tip.id : tip} sent successfully`,
    );
  }

  GetMetrics(): Promise<string> {
    return this.prom_client.register.metrics();
  }
}
