import type Logger from "@studiowebux/deno-minilog";
import type PromClient from "prom-client";
import type { LocalBlock, Transaction } from "../../shared/types.ts";
import { Filter } from "./index.ts";

export class PolicyId extends Filter {
  private policy_id: string;

  constructor(
    id: string,
    logger: Logger,
    policy_id: string,
    prom_client: typeof PromClient | null = null,
  ) {
    super(id, logger, prom_client);
    this.policy_id = policy_id;

    this.logger.info(`Initializing policy id: ${this.policy_id}`);
  }

  Match(block: LocalBlock) {
    if (
      block.transactions &&
      block.transactions.length > 0 &&
      block.transactions.some((transaction: Transaction) =>
        Object.keys(transaction?.scripts || {}).some(
          (script_key) => script_key === this.policy_id,
        ),
      )
    ) {
      if (this.metric) {
        this.metric.inc(1);
      }
      this.logger.info(
        `policy id ${this.policy_id} found in block height: ${block.height}`,
      );
      return {
        [this.id]: {
          matches: true,
          policy_id: this.policy_id,
          id: this.id,
        },
      };
    }
    return { [this.id]: { matches: false, id: this.id } };
  }
}
