import type Logger from "@studiowebux/deno-minilog";
import type { Signatory, Transaction } from "@cardano-ogmios/schema";

import type { LocalBlock, MatchOutput } from "../../shared/types.ts";
import { Filter } from "./index.ts";

export class Vkey extends Filter {
  private vkey: string[];

  constructor(id: string, logger: Logger, vkey: string[]) {
    super(id, logger);
    this.vkey = vkey;

    this.logger.info(`Initializing vkey: ${this.vkey}`);
  }

  Match(block: LocalBlock): Record<string, MatchOutput> {
    if (
      block?.transactions?.length > 0 &&
      block?.transactions?.some((transaction: Transaction) =>
        transaction?.signatories.some((signatory: Signatory) =>
          this.vkey.includes(signatory.key),
        ),
      )
    ) {
      if (this.metric) {
        this.metric.inc(1);
      }
      this.logger.info(
        `At least one vkey from ${this.vkey} found in block height: ${block.height}`,
      );
      return {
        [this.id]: {
          matches: true,
          vkey: this.vkey,
          id: this.id,
        },
      };
    }

    return { [this.id]: { matches: false, id: this.id } };
  }
}
