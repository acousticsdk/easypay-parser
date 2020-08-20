const puppeteer = require('puppeteer-extra');
const queryString = require('query-string');
const axios = require('axios');
const sha1 = require('sha1');
const schedule = require('node-schedule');
const fs = require('fs');

const requestEasyPayToken = async (login, password, safetyData) => {
  try {
    const easypayData = await axios({
      url: 'https://api.easypay.ua/api/system/createApp',
      method: 'POST',
      headers: {
        'authority': 'api.easypay.ua',
        'content-length': '0',
        'appid': 'null',
        'locale': 'ru',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
        'content-type': 'application/json; charset=UTF-8',
        'accept': 'application/json, text/plain, */*',
        'sec-fetch-dest': 'empty',
        'pageid': 'null',
        'partnerkey': 'easypay-v2',
        'origin': 'https://easypay.ua',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'referer': 'https://easypay.ua/',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });
    const easypayToken = await axios({
      url: 'https://api.easypay.ua/api/token',
      method: 'POST',
      headers: {
        'authority': 'api.easypay.ua',
        'content-length': '0',
        'appid': `${easypayData.data.appId}`,
        'locale': 'ru',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
        'content-type': 'application/json; charset=UTF-8',
        'accept': 'application/json, text/plain, */*',
        'sec-fetch-dest': 'empty',
        'pageid': `${easypayData.data.pageId}`,
        'partnerkey': 'easypay-v2',
        'origin': 'https://easypay.ua',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'referer': 'https://easypay.ua/',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'safetydata': `${safetyData}`,
      },
      data:`grant_type=password&username=${login}&password=${password}&client_id=easypay-v2`,
    });
    fs.writeFileSync('../easypayData.dat', `${easypayData.data.pageId}\n${easypayData.data.appId}\n${easypayToken.data.access_token}`);
    console.log('EasyPay, at:', new Date().toLocaleString('ru-RU', {timeZone: 'Europe/Kiev'}));
  } catch(err) {
    console.log(err, err.response);
  };
};

const easyPayGetToken = async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
  try {
    const [login, password] = await fs.readFileSync('../easypayCredentials.dat', 'utf-8').split(/\r?\n/);
    const page = await browser.newPage();
    await page.goto('https://easypay.ua/ua', { waitUntil: 'networkidle0' });
    await page.click('button[class="header__sign-in shrink medium-5 column"]');
    await page.type('input[id="sign-in-phone"]', login);
    await page.type('input[id="password"]', password);
    await page.click('button[class="button relative"]');
    await new Promise(r => setTimeout(r, 5000));
    if (await page.$('body > div > div:nth-child(2) > iframe') !== null) {
      const recaptcha = await page.evaluate('document.querySelector("body > div > div:nth-child(2) > iframe").getAttribute("src")');
      const twoCaptcha = await axios.get(`https://2captcha.com/in.php?key=963da7930c5487d24a126bfde6a163a8&method=userrecaptcha&googlekey=${queryString.parse(recaptcha).k}&pageurl=https://easypay.ua/ua`);
      await new Promise(r => setTimeout(r, 61000));
      const twoCaptchaResponse = await axios.get(`https://2captcha.com/res.php?key=963da7930c5487d24a126bfde6a163a8&action=get&id=${twoCaptcha.data.split('|')[1]}`); 
      const splitedData = twoCaptchaResponse.data.split('|');
      if (splitedData[0] === 'OK') {
        await browser.close();
        await requestEasyPayToken(login, password, splitedData[1]);
      } else {
        throw new Error(`2Captcha Status is Failed: ${splitedData}`);
      };
    } else {
      await browser.close();
      await requestEasyPayToken(login, password, null);
    };
  } catch(err) {
    await browser.close();
    console.log(err.message);
  };
};



schedule.scheduleJob('*/20 * * * *', async () => {
  await easyPayGetToken();
});



(async () => {
  await easyPayGetToken();
})();
