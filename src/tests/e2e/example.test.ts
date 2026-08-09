import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

/*
 * Using Playwright with Electron:
 * https://www.electronjs.org/pt/docs/latest/tutorial/automated-testing#using-playwright
 */

let electronApp: ElectronApplication;

test.beforeAll(async () => {
  const latestBuild = findLatestBuild();
  const appInfo = parseElectronApp(latestBuild);
  process.env.CI = "e2e";

  electronApp = await electron.launch({
    args: [appInfo.main],
  });
  electronApp.on("window", async (page) => {
    const filename = page.url()?.split("/").pop();
    console.log(`Window opened: ${filename}`);

    page.on("pageerror", (error) => {
      console.error(error);
    });
    page.on("console", (msg) => {
      console.log(msg.text());
    });
  });
});

test.afterAll(async () => {
  await electronApp?.close();
});

test("renders the first page", async () => {
  const page: Page = await electronApp.firstWindow();
  const title = await page.waitForSelector("h1");
  const text = await title.textContent();
  expect(text?.trim()).toBe("Rush Meme");
});

test("renders the platform configuration controls", async () => {
  const page: Page = await electronApp.firstWindow();
  await expect(
    page.getByText("Platform shortcuts", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Preferences", { exact: true })).toBeVisible();
});
