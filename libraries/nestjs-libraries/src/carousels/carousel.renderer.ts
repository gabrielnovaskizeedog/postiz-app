import puppeteer from 'puppeteer-core';
import { FIT_SLIDE_SCRIPT } from '@gitroom/nestjs-libraries/carousels/carousel.template';

// Renders every slide of a carousel HTML to a 1080x1350 PNG with the Chromium
// installed in the image (CHROMIUM_PATH). One browser per carousel, slides are
// captured one after the other from the same page.
export const renderCarousel = async (html: string, slides: number) => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    // Google Fonts and the brand photos are loaded from the network
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    // CSS backgrounds (avatar) and web fonts are not part of "load"
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 30_000 })
      .catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);

    const images: Buffer[] = [];
    for (let index = 0; index < slides; index++) {
      await page.evaluate(`(${FIT_SLIDE_SCRIPT})(${index})`);
      images.push(
        Buffer.from(
          await page.screenshot({
            type: 'png',
            clip: { x: 0, y: 0, width: 1080, height: 1350 },
          })
        )
      );
    }

    return images;
  } finally {
    await browser.close();
  }
};
