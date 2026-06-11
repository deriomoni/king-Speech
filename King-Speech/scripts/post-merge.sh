#!/bin/bash
set -e

# Install any new npm dependencies that came in with the merge.
npm install --no-audit --no-fund --prefer-offline
