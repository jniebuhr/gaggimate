import puppeteer from 'puppeteer';
import {setTimeout} from "node:timers/promises";

export async function annotateAndScreenshot(browser, url, annotations, outputPath, id) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.setViewport({
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: false
  });

  // Inject annotation overlay boxes
  await page.evaluate((annotations) => {
    annotations.forEach(({ selector, label }) => {
      const el = document.querySelector(selector);
      if (!el) return;

      const rect = el.getBoundingClientRect();

      const box = document.createElement('div');
      box.innerText = label;
      box.style.position = 'absolute';
      box.style.left = `${rect.left + window.scrollX}px`;
      box.style.top = `${rect.top + window.scrollY - 30}px`;
      box.style.background = 'rgba(255, 255, 0, 0.9)';
      box.style.border = '1px solid #000';
      box.style.padding = '4px 8px';
      box.style.fontFamily = 'Arial, sans-serif';
      box.style.fontSize = '12px';
      box.style.zIndex = 99999;
      document.body.appendChild(box);
    });
  }, annotations);

  await setTimeout(15000);
  await page.screenshot({ path: outputPath + id + '-desktop.png', fullPage: true });

  await page.setViewport({
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    isMobile: true
  });
  await setTimeout(15000);
  await page.screenshot({ path: outputPath + id + '-mobile.png', fullPage: true });

}
