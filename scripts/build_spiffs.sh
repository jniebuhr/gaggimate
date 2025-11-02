#!/usr/bin/env bash

# Clean data
rm -rf data/w
mkdir -p data/w
mkdir -p data/p
touch data/p/.keep

# Build web application
cd web || exit
npm ci
npm run build

cp -R dist/* ../data/w/
gzip ../data/w/assets/*.js
gzip ../data/w/assets/*.css
gzip ../data/w/*.html
