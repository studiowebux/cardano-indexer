#!/bin/bash

deno run -A src/indexer/index.ts &
deno run -A src/processor/index.ts
