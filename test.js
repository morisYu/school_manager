const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    await page.goto('http://localhost:5500/pages/manage.html', { waitUntil: 'domcontentloaded' });

    console.log("Waiting for teacher select...");
    await page.waitForSelector('#teacherSelect option:nth-child(2)', { timeout: 10000 });

    console.log("Selecting instructor...");
    const optionValue = await page.$eval('#teacherSelect option:nth-child(2)', el => el.value);
    await page.select('#teacherSelect', optionValue);

    console.log("Waiting for profile to load...");
    await new Promise(r => setTimeout(r, 1000));

    console.log("Clicking edit button...");
    await page.click('.btn-profile-edit');

    console.log("Waiting 2s to catch errors...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if modal has is-open class
    const isModalOpen = await page.$eval('#profile-modal', el => el.classList.contains('is-open'));
    console.log("Modal is open:", isModalOpen);

    await browser.close();
})();
