#!/bin/bash
# Start the EPIP Pandoc Worker mini-service
cd /home/z/my-project/mini-services/pandoc-worker
exec bun index.ts
