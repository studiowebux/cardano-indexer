import type { Origin, Point, Tip } from "@cardano-ogmios/schema";
import {
  type ChainSynchronization,
  createChainSynchronizationClient,
  getServerHealth,
} from "@cardano-ogmios/client";
import type { Counter, Gauge, Histogram } from "prom-client";
import type { Producer } from "kafkajs";
import type Logger from "@studiowebux/deno-minilog";
import type { Document, UpdateResult } from "mongodb";
import { hrtime } from "node:process";
import type { ServerHealth } from "@cardano-ogmios/client";

import type { LocalBlock, MatchOutput, Status } from "../../shared/types.ts";
import { kafkaProducer } from "../../shared/kafka/index.ts";
import { BLOCK_TOPIC } from "../../shared/constant.ts";

import type { Hooks } from "../hook/index.ts";
import { context } from "../ogmios/context.ts";
import { replacer } from "../utils/index.ts";
import {
  block_size_histogram,
  indexer_running,
  indexer_tip_height,
  indexer_tip_slot,
  processing_counter,
  processing_histogram,
  published_counter,
  local_queue_size,
  indexer_tip_synced,
  indexer_error_count,
  indexer_stopped_count,
  indexer_started_count,
  indexer_registry,
} from "../../shared/prometheus/indexer.ts";

export class Indexer {
  private client: ChainSynchronization.ChainSynchronizationClient | null = null; // ogmios client
  private producer: Producer; // kafka producer
  private start_point: string[] | Tip[] = [];
  private current_intersection: Tip | null = null;
  private last_current_intersection: Tip | null = null;
  private queued_intersection: Tip | null = null;
  private local_queue: {
    block: LocalBlock;
    matches: Record<string, MatchOutput>;
  }[] = [];
  private block_to_wait: number = 6;
  private hooks: Hooks;
  private tip_synced: boolean = false;
  private logger: Logger;

  private status: Status;

  private snapshot_interval: number;

  private upsert_cursor:
    | ((
        logger: Logger,
        cursor: Tip | Origin,
      ) => Promise<UpdateResult<Document> | void>)
    | undefined;

  private processing_histogram: Histogram;
  private block_size_histogram: Histogram;
  private processing_counter: Counter;
  private published_counter: Counter;
  private indexer_running: Gauge;
  private indexer_tip_slot: Gauge;
  private indexer_tip_height: Gauge;
  private local_queue_size: Gauge;
  private indexer_tip_synced: Gauge;
  private indexer_error_count: Counter;
  private indexer_stopped_count: Counter;
  private indexer_started_count: Counter;

  private statusInterval: ReturnType<typeof setInterval> | undefined;
  private snapshotInterval: ReturnType<typeof setInterval> | undefined;

  constructor(
    hooks: Hooks,
    logger: Logger,
    start_point: string[] | Tip[] = ["origin"],
    block_to_wait = 6,
    upsert_cursor:
      | ((
          logger: Logger,
          cursor: Tip | Origin,
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

    this.producer.on("producer.disconnect", (d) => {
      this.logger.warn("Kafka producer disconnected.", d);
    });
    this.producer.on("producer.network.request_timeout", (t) => {
      this.logger.error("Kafka producer request has timeout.", t);
    });
    this.producer.on("producer.network.request", (r) => {
      this.logger.info("Kafka producer request.", r);
    });
    this.producer.on("producer.network.request_queue_size", (q) => {
      this.logger.info("Kafka producer request queue size.", q);
    });

    this.processing_histogram = processing_histogram;
    this.processing_counter = processing_counter;
    this.published_counter = published_counter;
    this.indexer_running = indexer_running;
    this.indexer_tip_slot = indexer_tip_slot;
    this.indexer_tip_height = indexer_tip_height;
    this.block_size_histogram = block_size_histogram;
    this.local_queue_size = local_queue_size;
    this.indexer_tip_synced = indexer_tip_synced;
    this.indexer_error_count = indexer_error_count;
    this.indexer_stopped_count = indexer_stopped_count;
    this.indexer_started_count = indexer_started_count;
  }

  Setup(): Indexer {
    this.logger.info(`Trying to start the indexer`);
    this.producer.on("producer.connect", async () => {
      this.logger.info("Kafka producer connected.");
      try {
        const intersection = await this.client?.resume(
          this.start_point as Point[],
          100,
        );

        this.logger.info(
          "Ogmios Client Started. At",
          intersection?.intersection,
        );
        this.indexer_running.set(1);
        this.current_intersection = intersection?.intersection as Tip;
        this.status.started_at = new Date();
        this.status.stopped_at = undefined;
        this.status.state = "ACTIVE";
      } catch (e) {
        this.logger.error("An error occured while resuming.");
        this.logger.error(e);
      }
    });

    return this;
  }

  async Stop(): Promise<Indexer> {
    try {
      if (this.status.state === "INACTIVE") {
        this.logger.warn("Indexer already stopped.");
        return this;
      }
      this.indexer_stopped_count.inc();

      try {
        await this.client?.shutdown();
        this.client = null;
        this.logger.info("Ogmios Client Stopped.");
      } catch (e) {
        this.logger.error("An error occured while stopping ogmios.");
        this.logger.error(e);
      }

      try {
        await this.producer.disconnect();
        this.logger.info("Kafka Producer Stopped.");
      } catch (e) {
        this.logger.error("An error occured while disconnecting producer.");
        this.logger.error(e);
      }
      this.status.started_at = undefined;
      this.status.stopped_at = new Date();
      this.status.state = "INACTIVE";

      clearInterval(this.snapshotInterval);
      clearInterval(this.statusInterval);

      await this.SaveCursor();
      this.indexer_running.set(0);
      this.indexer_tip_synced.set(0);
    } catch (e) {
      this.logger.error("Failed to stop indexer");
      console.error(e);
      this.logger.error(e);
    }

    return this;
  }

  async SaveCursor(): Promise<Indexer> {
    if (!this.upsert_cursor) {
      return this;
    }

    if (this.queued_intersection) {
      this.logger.info(
        "Save cursor (from queued intersection) at",
        this.queued_intersection,
      );
      await this.upsert_cursor(this.logger, this.queued_intersection);
      // Set the start point to the current point
      this.start_point = this.queued_intersection
        ? [this.queued_intersection]
        : ["origin"];
    } else if (this.current_intersection) {
      this.logger.info(
        "Save cursor (from current intersection) at",
        this.current_intersection,
      );
      await this.upsert_cursor(this.logger, this.current_intersection);
      // Set the start point to the current point
      this.start_point = this.current_intersection
        ? [this.current_intersection]
        : ["origin"];
    } else {
      this.logger.error("Unable to save the cursor.");
      this.Stop();
    }

    return this;
  }

  async RollForward(
    { block, tip }: { block: LocalBlock; tip: Tip | Origin },
    requestNextBlock: () => void,
  ): Promise<void> {
    const start = hrtime();
    try {
      if (
        tip !== "origin" &&
        this.current_intersection &&
        this.current_intersection.slot - tip.slot === 0
      ) {
        this.logger.error(
          "The indexer might be stuck (or rollbacked) at",
          this.current_intersection?.slot,
          tip.slot,
        );
      }
      // Track Block size over time.
      this.block_size_histogram.observe(
        { blockSize: "bytes" },
        new Blob([JSON.stringify(block, replacer)]).size,
      );

      if (!block.slot) {
        this.logger.warn("Block slot is undefined", block);
      }
      this.current_intersection = {
        id: block.id,
        slot: block.slot,
        height: block.height,
      };
      await this.ProcessQueue(tip);
      await this.Process(block);

      if (tip !== "origin" && tip.height === block.height) {
        if (this.tip_synced === false) {
          this.indexer_tip_synced.set(1);
          this.logger.info("Tip is synced", tip);
        }
        this.tip_synced = true;
      } else {
        if (this.tip_synced === true) {
          this.indexer_tip_synced.set(0);
          this.logger.warn("Tip is out of synced", tip);
        }

        this.tip_synced = false;
      }
    } catch (e) {
      this.logger.error("Failed to roll forward.", block, tip);
      this.logger.error(e);
      this.Stop();
    } finally {
      const end = hrtime(start);
      this.processing_counter.inc({ task: "rollForward" });
      this.processing_histogram.observe(
        { task: "rollForward" },
        end[0] + end[1] / Math.pow(10, 9),
      );

      const state = this.GetSocketState();
      if (!state.ready) {
        this.logger.error("Websocket connection is not ready.");
      }
      try {
        requestNextBlock();
      } catch (e) {
        console.error(e);
        this.logger.error("An error occured while requesting next block.");
      }
    }
  }

  async RollBackard(
    { point, tip }: { point: Origin | Point; tip: Origin | Tip },
    requestNextBlock: () => void,
  ): Promise<void> {
    const start = hrtime();

    try {
      // Reset cursor
      if (this.upsert_cursor) {
        await this.upsert_cursor(this.logger, tip);
      }
      if (point !== "origin") {
        this.current_intersection = tip !== "origin" ? tip : null;
        // Clean the local queue
        this.local_queue = this.local_queue.filter(
          (lq) => lq.block.height < (tip !== "origin" ? tip.height : 0),
        );
      } else {
        this.current_intersection = null;
        this.local_queue = [];
      }

      this.local_queue_size.set(this.local_queue.length);

      this.tip_synced = false;

      await this.Rollback(point);
    } catch (e) {
      this.logger.error("Failed to roll backward.");
      this.logger.error(e);
      this.Stop();
    } finally {
      const end = hrtime(start);
      this.processing_counter.inc({ task: "rollBackward" });
      this.processing_histogram.observe(
        { task: "rollBackward" },
        end[0] + end[1] / Math.pow(10, 9),
      );

      const state = this.GetSocketState();
      if (!state.ready) {
        this.logger.error("Websocket connection is not ready.");
      }
      requestNextBlock();
    }
  }

  async ConnectAndStart(): Promise<Indexer> {
    if (this.status.state === "ACTIVE") {
      this.logger.warn("Indexer already running.");
      return this;
    }

    this.indexer_started_count.inc();
    this.logger.info("Connect and start the indexer.");
    await this.producer.connect();

    this.snapshotInterval = setInterval(async () => {
      this.logger.info("Saving cursor to database.");
      await this.SaveCursor();
    }, this.snapshot_interval);

    return this;
  }

  async Initialize(): Promise<Indexer> {
    try {
      if (this.status.state === "ACTIVE") {
        this.logger.warn("Indexer already running.");
        return this;
      }
      this.logger.info("Initialize indexer.");
      const ctx = await context(this.logger, this);
      this.client = await createChainSynchronizationClient(
        ctx,
        {
          rollForward: (
            { block, tip }: { block: LocalBlock; tip: Tip | Origin },
            requestNextBlock: () => void,
          ) =>
            this.RollForward({ block, tip }, requestNextBlock).catch((e) => {
              console.error("Roll Forward errored", e);
              this.logger.error("Roll Forward errored", e);
            }),

          rollBackward: (
            { point, tip }: { point: Origin | Point; tip: Origin | Tip },
            requestNextBlock: () => void,
          ) =>
            this.RollBackard({ point, tip }, requestNextBlock).catch((e) => {
              console.error("Roll Backward errored", e);
              this.logger.error("Roll Backward errored", e);
            }),
        },
        {
          sequential: true,
        },
      );

      this.statusInterval = setInterval(
        async () => {
          if (
            this.current_intersection?.slot ===
            this.last_current_intersection?.slot
          ) {
            this.indexer_error_count.inc();
            this.logger.error(
              "The Indexer is probably stuck for an unknown reason. (See troubleshooting)",
            );
            this.logger.info(
              "Trying to automatically restart the indexer",
              this.GetStatus(),
            );
            await this.Stop();
            await this.Initialize();
            await this.ConnectAndStart();
            this.logger.info(this.GetStatus());
          }
          this.last_current_intersection = this.current_intersection;
        },
        60 * 1000 * 3,
      ); // Every 3 minutes check if the ogmios client is stuck or not.
    } catch (e) {
      this.logger.error("Failed to initialize.");
      this.logger.error(e);
      this.Stop();
    }

    return this;
  }

  async Process(block: LocalBlock): Promise<Indexer> {
    try {
      // this.logger.info("Process block:", block.id);
      // Sometimes the slot is undefined
      this.indexer_tip_slot.set(block.slot || -1);
      this.indexer_tip_height.set(block.height || -1);

      const matches = await this.hooks.Match(block);
      if (Object.values(matches).some((match) => match.matches)) {
        const data = {
          block,
          matches,
        };
        // Queue locally
        if (this.block_to_wait > 0) {
          this.local_queue.push(data);
          this.local_queue_size.set(this.local_queue.length);
        } else {
          await this.Publish(data);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to process block: ${block?.id}/${block?.slot}`);
      this.logger.error(e);
      this.Stop();
    }
    return this;
  }

  async Publish(data: {
    block: LocalBlock;
    matches: Record<string, MatchOutput>;
  }): Promise<Indexer> {
    try {
      await this.producer.send({
        topic: BLOCK_TOPIC,
        messages: [
          { key: data.block.id, value: JSON.stringify(data, replacer) },
        ],
      });
      this.published_counter.inc();

      this.logger.info(
        `Message ${data.block.id}/${data.block.slot} sent successfully`,
      );
      // Set or reset the current intersection to avoid losing pending blocks
      this.current_intersection = {
        id: data.block.id,
        slot: data.block.slot,
        height: data.block.height,
      };
    } catch (e) {
      this.logger.error(
        `Failed to publish block: ${data?.block?.id}/${data?.block?.slot}`,
      );
      this.logger.error(e);
      this.Stop();
    }

    return this;
  }

  async ProcessQueue(tip: Tip | Origin): Promise<Indexer> {
    try {
      if (this.local_queue.length > 0) {
        this.logger.info(
          "Check block(s) in local queue: ",
          this.local_queue.length,
        );
        const processed_blocks: string[] = [];
        for (const queued_block of this.local_queue) {
          if (
            tip !== "origin" &&
            tip.height &&
            tip.height - queued_block.block.height > this.block_to_wait
          ) {
            await this.Publish(queued_block);
            processed_blocks.push(queued_block.block.id);
          }
        }
        this.local_queue = this.local_queue.filter(
          (lq) => !processed_blocks.includes(lq.block.id),
        );
        this.local_queue_size.set(this.local_queue.length);
        this.logger.info(
          "Remaining block(s) in local queue: ",
          this.local_queue.length,
        );

        // Tracking the queue intersection to save the cursor at the correct location to avoid losing queued blocks.
        if (this.local_queue.length > 0) {
          this.queued_intersection = {
            id: this.local_queue[0].block.id,
            slot: this.local_queue[0].block.slot,
            height: this.local_queue[0].block.height,
          };
        } else {
          this.queued_intersection = null;
        }
      }
    } catch (e) {
      this.logger.error("Failed to process queue");
      this.logger.error(e);
      this.Stop();
    }

    return this;
  }

  async Rollback(tip: Point | Tip | Origin): Promise<Indexer> {
    try {
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
    } catch (e) {
      this.logger.error("Failed to rollback");
      this.logger.error(e);
      this.Stop();
    }

    return this;
  }

  //
  // Getters
  //

  GetMetrics(): Promise<string> {
    return indexer_registry.metrics();
  }

  GetStatus(): Status {
    return this.status;
  }

  GetCurrentIntersection(): Tip | null {
    return this.current_intersection;
  }

  async GetOgmiosServerHealth(): Promise<ServerHealth> {
    const connection = this.client?.context.connection;
    return await getServerHealth({ connection });
  }

  GetSocketState(): { ready: number | undefined } {
    return {
      ready: (this.client?.context?.socket as WebSocket)?.readyState,
    };
  }
}
