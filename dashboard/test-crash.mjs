import puppeteer from 'puppeteer';

async function test() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  console.log('Loading dashboard...');
  try {
    await page.goto('http://localhost:3377', { timeout: 30000, waitUntil: 'networkidle0' });
    console.log('Page loaded, waiting 10s...');
    await new Promise(r => setTimeout(r, 10000));
    
    const nodeCount = await page.evaluate(() => {
      const stats = document.querySelector('#stats')?.textContent || '';
      return stats;
    });
    console.log('Stats:', nodeCount);
    console.log('Errors:', errors.length ? errors : 'none');
    
    await page.screenshot({ path: 'dashboard/test-screenshot.png' });
    console.log('Screenshot saved to dashboard/test-screenshot.png');
  } catch (e) {
    console.log('CRASH:', e.message);
  }
  
  await browser.close();
  console.log('Test complete');
}

test();
