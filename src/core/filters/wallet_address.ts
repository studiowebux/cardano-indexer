import Logger from "@studiowebux/deno-minilog";
import type { LocalBlock, Transaction } from "../../shared/types.ts";
import { Filter } from "./index.ts";

export class WalletAddress extends Filter {
  private wallet_address: string;

  constructor(id: string, logger: Logger, wallet_address: string) {
    super(id, logger);
    this.wallet_address = wallet_address;

    this.logger.info(`Initializing wallet address: ${this.wallet_address}`);
  }

  Match(block: LocalBlock) {
    if (
      block.transactions &&
      block.transactions.length > 0 &&
      block.transactions.some((transaction: Transaction) =>
        Object.values(transaction?.outputs || {}).some(
          (output) => output.address === this.wallet_address,
        ),
      )
    ) {
      this.logger.info(
        `policy id ${this.wallet_address} found in block height: ${block.height}`,
      );
      return [{ matches: true, wallet_address: this.wallet_address }];
    }

    return [{ matches: false }];
  }
}
