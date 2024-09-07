import type { Block, Origin, Tip } from "@cardano-ogmios/schema";

export type Cursor = { id: string; slot: number };

export type Transaction = {
  scripts: Record<string, { language: string; json: object }>;
  outputs: { address: string; value: Record<string, object[]> }[];
};

export type LocalBlock = Block & {
  slot: number;
  height: number;
  transactions: Transaction[];
};

export type Match = {
  matches: boolean;
  policy_id?: string;
  wallet_address?: string;
  rollback?: Tip | Origin;
  id: string;
};

export type ProcessorInput = {
  block: LocalBlock | null;
  matches: Record<string, Match>;
  rollback: Tip | Origin | undefined;
};
