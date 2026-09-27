import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
const logs = [];
page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") logs.push(`console: ${msg.text()}`);
});

async function shot(name) {
  await page.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
}

await page.setViewport({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:38421/", { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForFunction(() => document.body.innerText.includes("LCX/EUR"), { timeout: 20000 });
const homeText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log("HOME_SNIP", homeText.replaceAll("\n", " | "));
await shot("lcx-markets");
await page.type("input[aria-label='Search markets']", "bitcoin");
await page.waitForFunction(
  () => document.body.textContent.includes("BTC/EUR") && !document.body.textContent.includes("LCX/EUR"),
  { timeout: 5000 },
);
console.log("SEARCH", "ok");
await page.evaluate(() => {
  const input = document.querySelector("input[aria-label='Search markets']");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForFunction(() => document.body.textContent.includes("LCX/EUR"), { timeout: 5000 });

await page.click("a[href='/trade/LCX/EUR']");
await page.waitForFunction(() => location.pathname.includes("/trade/LCX/EUR"), { timeout: 10000 });
await page.waitForFunction(() => document.body.textContent.includes("Order ticket"), { timeout: 20000 });
await page.waitForFunction(
  () => document.body.textContent.includes("Order book") && !document.body.textContent.includes("Loading candles"),
  { timeout: 20000 },
);
await new Promise((resolve) => setTimeout(resolve, 1500));
console.log("TRADE_URL", page.url());
console.log("TRADE_SNIP", (await page.evaluate(() => document.body.innerText.slice(0, 900))).replaceAll("\n", " | "));
await shot("lcx-trade");

const bookClicked = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll("button")].filter((button) => button.querySelector("span"));
  const priceButton = buttons.find((button) => /0\.\d+/.test(button.innerText));
  if (!priceButton) return null;
  priceButton.click();
  return priceButton.innerText.split("\n")[0];
});
await new Promise((resolve) => setTimeout(resolve, 200));
const priceValue = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")];
  return inputs.map((input) => input.value);
});
console.log("BOOK_CLICK", bookClicked, "INPUTS", priceValue);

await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")];
  const amount = inputs[inputs.length - 1];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(amount, "100");
  amount.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Buy LCX");
  button.click();
});
await page.waitForFunction(
  () => /Paper order|Not enough|Enter an amount/.test(document.body.innerText),
  { timeout: 8000 },
);
console.log("ORDER_RESULT", (await page.evaluate(() => {
  const text = document.body.innerText;
  const hit = text.match(/Paper order[^\n]*|Not enough[^\n]*|Enter an amount[^\n]*/);
  return hit?.[0] ?? "missing";
})));
await shot("lcx-order");

await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(inputs[0], "0.02");
  inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  setter.call(inputs[1], "50");
  inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
});
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Buy LCX");
  button.click();
});
await page.waitForFunction(() => document.body.textContent.includes("Funds stay locked"), { timeout: 8000 });
console.log("RESTING", "ok");

await page.goto("http://127.0.0.1:38421/portfolio", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.textContent.includes("Paper book") && document.body.textContent.includes("EUR"), {
  timeout: 10000,
});
console.log("PORTFOLIO_SNIP", (await page.evaluate(() => document.body.innerText.slice(0, 1400))).replaceAll("\n", " | "));
const cancelled = await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Cancel");
  if (!button) return false;
  button.click();
  return true;
});
await new Promise((resolve) => setTimeout(resolve, 300));
const stillOpen = await page.evaluate(() => document.body.textContent.includes("No resting paper orders."));
console.log("CANCEL", cancelled, "CLEARED", stillOpen);
const liveTab = await page.evaluate(() => {
  const tab = [...document.querySelectorAll("button,[role=tab]")].find((item) => item.textContent.includes("Live account"));
  if (!tab) return false;
  tab.click();
  return true;
});
await new Promise((resolve) => setTimeout(resolve, 300));
const liveText = await page.evaluate(() => document.body.innerText.includes("API key"));
console.log("LIVE_TAB", liveTab, liveText);
await shot("lcx-portfolio");

await page.setViewport({ width: 390, height: 800 });
await page.goto("http://127.0.0.1:38421/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("LCX/EUR"), { timeout: 15000 });
await shot("lcx-mobile-markets");
const overflow = await page.evaluate(() => {
  const doc = document.documentElement;
  return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
});
console.log("MOBILE_OVERFLOW", overflow);
await page.goto("http://127.0.0.1:38421/trade/LCX/EUR", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("Order ticket"), { timeout: 15000 });
await shot("lcx-mobile-trade");
const mobileTrade = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  hasTicket: document.body.innerText.includes("Buy LCX"),
}));
console.log("MOBILE_TRADE", mobileTrade);
console.log("LOGS", logs);
await browser.close();
