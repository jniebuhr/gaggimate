#!/usr/bin/env bash

# Clean data
mkdir -p data
rm -rf data/*

# Build web application
cd web || exit
npm ci
npm run build

cp -R dist/* ../data/
