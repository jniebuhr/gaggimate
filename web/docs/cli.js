#!/usr/bin/env node
import { annotateAndScreenshot } from './index.js';
import config from './config.js';
import puppeteer from 'puppeteer';

const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
const outputPath = 'docs/out/';

async function main() {
  const browser = await puppeteer.launch();
  for (const page of config) {
    try {
      console.log('Screenshotting ' + baseUrl + page.url);
      await annotateAndScreenshot(browser, baseUrl + page.url, page.annotations, outputPath, page.id)
    } catch (e) {
      console.error('❌ Error taking screenshot:', e);
    }
  }
  await browser.close();
}

main();
