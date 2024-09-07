import type Logger from "@studiowebux/deno-minilog";
import type PromClient from "prom-client";

import type { LocalBlock, Match, Transaction } from "../../shared/types.ts";
import { Filter } from "./index.ts";

export class WalletAddress extends Filter {
  private wallet_address: string;

  constructor(
    id: string,
    logger: Logger,
    wallet_address: string,
    prom_client: typeof PromClient | null = null,
  ) {
    super(id, logger, prom_client);
    this.wallet_address = wallet_address;

    this.logger.info(`Initializing wallet address: ${this.wallet_address}`);
  }

  Match(block: LocalBlock): Record<string, Match> {
    if (
      block.transactions &&
      block.transactions.length > 0 &&
      block.transactions.some(
        (transaction: Transaction) =>
          Object.values(transaction?.outputs || {}).some(
            (output) => output.address === this.wallet_address,
          ) ||
          Object.values(transaction?.inputs || {}).some(
            (output) => output.address === this.wallet_address,
          ),
      )
    ) {
      if (this.metric) {
        this.metric.inc(1);
      }
      this.logger.info(
        `policy id ${this.wallet_address} found in block height: ${block.height}`,
      );
      return {
        [this.id]: {
          matches: true,
          wallet_address: this.wallet_address,
          id: this.id,
        },
      };
    }

    return { [this.id]: { matches: false, id: this.id } };
  }
}
