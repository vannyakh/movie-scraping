import { ipcMain, shell, app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { promises } from "node:fs";
import ExcelJS from "exceljs";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
async function scrapeCategories(page, baseUrl, onLog) {
  onLog("Step 1 › Navigating to home page to collect categories…");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 3e4 });
  const categories = await page.evaluate((origin) => {
    const selectors = [
      "nav a[href]",
      ".categories a[href]",
      ".genres a[href]",
      ".menu a[href]",
      "ul.nav a[href]"
    ];
    const seen = /* @__PURE__ */ new Set();
    const results = [];
    for (const sel of selectors) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const name = el.textContent?.trim() ?? "";
        const url = el.href;
        if (!name || !url || url.includes("#") || !url.startsWith(origin)) continue;
        if (!seen.has(url)) {
          seen.add(url);
          results.push({ name, url });
        }
      }
      if (results.length) break;
    }
    return results;
  }, new URL(baseUrl).origin);
  onLog(`Step 1 › Found ${categories.length} categories.`);
  return categories;
}
async function scrapeMovieList(page, category, onLog, signal, maxItems) {
  const collected = [];
  let currentUrl = category.url;
  let pageNum = 1;
  while (currentUrl && !signal.aborted && collected.length < maxItems) {
    onLog(`  Step 2 › "${category.name}" — page ${pageNum}…`);
    await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 3e4 });
    const items = await page.evaluate((cat) => {
      const selectors = [
        ".movie-item a[href]",
        ".film-item a[href]",
        "article.item a[href]",
        ".card a[href]",
        ".movie a[href]"
      ];
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const title = (el.textContent?.trim() || el.getAttribute("title") || "").trim();
          const url = el.href;
          if (!title || !url || seen.has(url)) continue;
          seen.add(url);
          out.push({ title, url, category: cat });
        }
        if (out.length) break;
      }
      return out;
    }, category.name);
    collected.push(...items);
    const nextUrl = await page.evaluate(() => {
      const candidates = [
        document.querySelector("a.next"),
        document.querySelector('a[rel="next"]'),
        document.querySelector(".pagination .next a"),
        document.querySelector(".pager-next a")
      ];
      const next = candidates.find(Boolean);
      return next?.href ?? null;
    });
    currentUrl = nextUrl;
    pageNum++;
  }
  return collected;
}
async function scrapeMovieDetail(page, movie, onLog) {
  try {
    await page.goto(movie.url, { waitUntil: "domcontentloaded", timeout: 3e4 });
    const detail = await page.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.innerText?.trim();
      return {
        year: text('.year, .release-year, [itemprop="dateCreated"], .meta-year'),
        rating: text('.rating, .score, [itemprop="ratingValue"], .imdb-rating'),
        duration: text('.duration, .runtime, [itemprop="duration"], .meta-runtime'),
        director: text('.director a, [itemprop="director"] a, .meta-director'),
        description: text(
          '.description, .synopsis, [itemprop="description"], p.overview, .plot'
        ),
        cast: Array.from(
          document.querySelectorAll('.cast a, [itemprop="actor"] a, .actors a')
        ).slice(0, 10).map((el) => el.innerText?.trim()).filter(Boolean),
        poster: document.querySelector('.poster img, [itemprop="image"]')?.src
      };
    });
    return { ...movie, ...detail };
  } catch {
    onLog(`  Warning: could not load detail for "${movie.title}"`);
    return movie;
  }
}
async function saveResults(movies, outputDir) {
  await promises.mkdir(outputDir, { recursive: true });
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonPath = path.join(outputDir, `movies-${stamp}.json`);
  const excelPath = path.join(outputDir, `movies-${stamp}.xlsx`);
  await promises.writeFile(jsonPath, JSON.stringify(movies, null, 2), "utf-8");
  const wb = new ExcelJS.Workbook();
  wb.creator = "MovieScraping";
  wb.created = /* @__PURE__ */ new Date();
  const sheet = wb.addWorksheet("Movies");
  sheet.columns = [
    { header: "Title", key: "title", width: 42 },
    { header: "Category", key: "category", width: 20 },
    { header: "Year", key: "year", width: 8 },
    { header: "Rating", key: "rating", width: 10 },
    { header: "Duration", key: "duration", width: 12 },
    { header: "Director", key: "director", width: 26 },
    { header: "Cast", key: "cast", width: 52 },
    { header: "Description", key: "description", width: 80 },
    { header: "URL", key: "url", width: 60 },
    { header: "Poster", key: "poster", width: 60 }
  ];
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1f2937" } };
  for (const movie of movies) {
    sheet.addRow({ ...movie, cast: movie.cast?.join(", ") ?? "" });
  }
  await wb.xlsx.writeFile(excelPath);
  return { jsonPath, excelPath, totalMovies: movies.length };
}
async function runScraper(config, onProgress, onLog, signal) {
  const maxPerCat = config.maxMoviesPerCategory ?? Infinity;
  const browser = await chromium.launch({ headless: config.headless });
  const page = await browser.newPage();
  page.setDefaultTimeout(3e4);
  try {
    const categories = await scrapeCategories(page, config.baseUrl, onLog);
    onProgress({
      step: 1,
      label: "Categories",
      current: categories.length,
      total: categories.length,
      message: `Found ${categories.length} categories`
    });
    if (signal.aborted) throw new Error("Scraping stopped by user.");
    const allItems = [];
    for (let i = 0; i < categories.length; i++) {
      if (signal.aborted) break;
      const cat = categories[i];
      onProgress({
        step: 2,
        label: "Movie List",
        current: i,
        total: categories.length,
        message: `Scraping "${cat.name}"…`
      });
      const items = await scrapeMovieList(page, cat, onLog, signal, maxPerCat);
      allItems.push(...items);
      onLog(`  Category "${cat.name}": ${items.length} movies`);
    }
    onProgress({
      step: 2,
      label: "Movie List",
      current: categories.length,
      total: categories.length,
      message: `${allItems.length} movies collected`
    });
    if (signal.aborted) throw new Error("Scraping stopped by user.");
    const unique = Array.from(new Map(allItems.map((m) => [m.url, m])).values());
    const details = [];
    for (let i = 0; i < unique.length; i++) {
      if (signal.aborted) break;
      const movie = unique[i];
      onProgress({
        step: 3,
        label: "Detail Pages",
        current: i,
        total: unique.length,
        message: `"${movie.title}"`
      });
      details.push(await scrapeMovieDetail(page, movie, onLog));
    }
    onProgress({
      step: 3,
      label: "Detail Pages",
      current: details.length,
      total: unique.length,
      message: "All details scraped"
    });
    onLog("Saving results…");
    const result = await saveResults(details, config.outputDir);
    onLog(`✓ JSON  → ${result.jsonPath}`);
    onLog(`✓ Excel → ${result.excelPath}`);
    return result;
  } finally {
    await browser.close();
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "../..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "out/main");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "out/renderer");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let abortController = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 820,
    minHeight: 600,
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: path.join(__dirname$1, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.handle("scrape:start", async (_event, config) => {
  abortController?.abort();
  abortController = new AbortController();
  try {
    const result = await runScraper(
      config,
      (progress) => win?.webContents.send("scrape:progress", progress),
      (log) => win?.webContents.send("scrape:log", log),
      abortController.signal
    );
    win?.webContents.send("scrape:complete", result);
    return { success: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    win?.webContents.send("scrape:error", message);
    return { success: false, error: message };
  } finally {
    abortController = null;
  }
});
ipcMain.handle("scrape:stop", () => {
  abortController?.abort();
  abortController = null;
});
ipcMain.handle("open:path", (_event, filePath) => {
  shell.showItemInFolder(filePath);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
