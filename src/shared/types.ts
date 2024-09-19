import type { Block, Origin, Tip, Transaction } from "@cardano-ogmios/schema";

export type LocalBlock = Block & {
  slot: number;
  height: number;
  transactions: Transaction[];
};

export type Match = {
  matches: boolean;
  policy_id?: string[];
  wallet_address?: string[];
  rollback?: Tip | Origin;
  id: string;
};

export type ProcessorInput = {
  block: LocalBlock | null;
  matches: Record<string, Match>;
  rollback: Tip | Origin | undefined;
};

export type Status = {
  started_at: Date | undefined;
  stopped_at: Date | undefined;
  state: "ACTIVE" | "INACTIVE";
};
