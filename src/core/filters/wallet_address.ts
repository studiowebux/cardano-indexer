import type Logger from "@studiowebux/deno-minilog";
import type { Transaction, TransactionOutput } from "@cardano-ogmios/schema";

import type { LocalBlock, MatchOutput } from "../../shared/types.ts";
import { Filter } from "./index.ts";

export class WalletAddress extends Filter {
  private wallet_address: string[];

  constructor(id: string, logger: Logger, wallet_address: string[]) {
    super(id, logger);
    this.wallet_address = wallet_address;

    this.logger.info(`Initializing wallet address: ${this.wallet_address}`);
  }

  Match(block: LocalBlock): Record<string, MatchOutput> {
    if (
      block?.transactions?.length > 0 &&
      block?.transactions?.some((transaction: Transaction) =>
        Object.values(transaction?.outputs || {}).some(
          (output: TransactionOutput) =>
            this.wallet_address.includes(output.address),
        ),
      )
    ) {
      if (this.metric) {
        this.metric.inc(1);
      }
      this.logger.info(
        `At least one wallet address from ${this.wallet_address} found in block height: ${block.height}`,
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
