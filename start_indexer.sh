#!/bin/bash

deno run -A app/indexer/index.ts &
deno run -A app/processor/index.ts
