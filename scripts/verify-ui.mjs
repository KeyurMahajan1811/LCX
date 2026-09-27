import fs from "node:fs";
import puppeteer from "puppeteer-core";

const pdf = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
fs.writeFileSync("/tmp/lcx-doc.pdf", pdf);

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.log("PAGE", error.message));
page.setDefaultTimeout(25000);

async function login(email) {
  await page.goto("http://127.0.0.1:38421/login", { waitUntil: "networkidle0" });
  await page.waitForSelector("#email");
  await page.$eval("#email", (el) => (el.value = ""));
  await page.type("#email", email);
  await page.type("#password", "LCX-demo-2026");
  await page.click("button[type=submit]");
  await page.waitForFunction(() => location.pathname.includes("mailbox"), { timeout: 20000 });
}

await login("priya.kulkarni@mahabank.example");
await page.waitForFunction(() => document.body.textContent.includes("LCX-2026-00002"));
const bankMailbox = await page.evaluate(() => document.body.innerText);
if (!bankMailbox.includes("Action Required") || !bankMailbox.includes("Pending at Vendor")) {
  throw new Error(`Bank mailbox labels missing:\n${bankMailbox.slice(0, 800)}`);
}
console.log("BANK_MAILBOX ok");

await page.goto("http://127.0.0.1:38421/vendor/mailbox", { waitUntil: "networkidle0" });
await page.waitForFunction(() => location.pathname.startsWith("/bank"));
console.log("BANK_BLOCKED_FROM_VENDOR", page.url());

await page.goto("http://127.0.0.1:38421/bank/requests/new", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.textContent.includes("Number of applicants"));
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Continue");
  button.click();
});
await page.waitForSelector("input[name='applicants.0.fullName']");
await page.type("input[name='applicants.0.fullName']", "Test Borrower");
await page.type("input[name='applicants.0.panCard']", "ABCDE1234F");
const aadhaar = await page.$("input[placeholder='XXXX XXXX XXXX']");
await aadhaar.type("123412341234");
await page.type("input[name='applicants.0.mobileNo']", "9876500000");
await page.type("input[name='applicants.0.email']", "borrower@example.com");
const buttons = await page.$$("button");
const continueBtn = buttons.find(async () => false);
void continueBtn;
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Continue"));
  button.click();
});
await page.waitForFunction(() => document.body.textContent.includes("Document 7"));
const inputs = await page.$$("input[type=file]");
if (inputs.length !== 7) throw new Error(`expected 7 file inputs, got ${inputs.length}`);
for (const input of inputs) {
  await input.uploadFile("/tmp/lcx-doc.pdf");
}
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Review");
  button.click();
});
await page.waitForFunction(() => document.body.textContent.includes("Submit request"));
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Submit request"));
  button.click();
});
await page.waitForFunction(() => location.pathname.includes("/bank/mailbox") && document.body.textContent.includes("LCX-2026-00005"), {
  timeout: 30000,
});
console.log("CREATED", "LCX-2026-00005");

await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Sign out"));
  button.click();
});
await page.waitForFunction(() => location.pathname.includes("/login"));
await login("sandeep@loanchallanx.example");
await page.waitForFunction(() => document.body.textContent.includes("Bank of Maharashtra") && document.body.textContent.includes("Action Required"));
const vendorText = await page.evaluate(() => document.body.innerText);
if (!vendorText.includes("Bank")) throw new Error("Vendor mailbox missing bank column");
console.log("VENDOR_MAILBOX ok");

const link = await page.evaluate(() => {
  const row = [...document.querySelectorAll("tr")].find((item) => item.textContent.includes("LCX-2026-00005"));
  return row?.querySelector("a")?.getAttribute("href");
});
await page.goto(`http://127.0.0.1:38421${link}`, { waitUntil: "networkidle0" });
await page.waitForSelector("#query");
await page.type("#query", "RBI needs a clearer signature page.");
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Raise query"));
  button.click();
});
await page.waitForFunction(() => document.body.textContent.includes("Pending at Bank"));
console.log("QUERY_RAISED ok");

await page.goto("http://127.0.0.1:38421/login", { waitUntil: "networkidle0" });
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Sign out"));
  if (button) button.click();
});
await page.waitForSelector("#email", { timeout: 10000 }).catch(() => undefined);
if (!page.url().includes("login")) {
  await page.goto("http://127.0.0.1:38421/login");
}
await page.waitForSelector("#email");
await page.click("#email", { clickCount: 3 });
await page.type("#email", "priya.kulkarni@mahabank.example");
await page.type("#password", "LCX-demo-2026");
await page.click("button[type=submit]");
await page.waitForFunction(() => location.pathname.includes("/bank"));
const codeLink = await page.evaluate(() => {
  const row = [...document.querySelectorAll("tr")].find((item) => item.textContent.includes("LCX-2026-00005"));
  return [...row.querySelectorAll("a")].map((item) => item.getAttribute("href")).find((href) => href.includes("/requests/"));
});
await page.goto(`http://127.0.0.1:38421${codeLink}`, { waitUntil: "networkidle0" });
await page.waitForSelector("#reply");
await page.type("#reply", "Clearer Document 2 is attached.");
const file = await page.$("input[type=file]");
await file.uploadFile("/tmp/lcx-doc.pdf");
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Send documents back"));
  button.click();
});
await page.waitForFunction(() => document.body.textContent.includes("Pending at Vendor"));
console.log("BANK_REPLIED ok");
await page.screenshot({ path: "/tmp/lcx-detail.png", fullPage: true });
await browser.close();
console.log("PASS");
