#!/usr/bin/env bash

# Clean data
rm -rf data/w
mkdir -p data/w
mkdir -p data/p

# Build web application
cd web || exit
npm ci
npm run build

cp -R dist/* ../data/w/
# Compress assets for SPIFFS storage savings, but keep originals for browsers that don't support gzip
gzip -k ../data/w/assets/*.js
gzip -k ../data/w/assets/*.css
gzip -k ../data/w/*.html
