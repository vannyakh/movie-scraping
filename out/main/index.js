import { ipcMain, shell, app, BrowserWindow, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { promises } from "node:fs";
import ExcelJS from "exceljs";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
class ScrapeController {
  _aborted = false;
  _paused = false;
  abort() {
    this._aborted = true;
    this._paused = false;
  }
  pause() {
    this._paused = true;
  }
  resume() {
    this._paused = false;
  }
  get aborted() {
    return this._aborted;
  }
  get paused() {
    return this._paused;
  }
  async checkPause(onLog) {
    if (!this._paused) return;
    onLog("⏸ Paused — waiting for resume…");
    while (this._paused && !this._aborted) await sleep(250);
    if (!this._aborted) onLog("▶ Resumed");
  }
  throwIfAborted(msg = "Scraping stopped by user.") {
    if (this._aborted) throw new Error(msg);
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function scrapeCategories(page, config, onLog) {
  onLog("Step 1 › Navigating to home page…");
  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: 3e4 });
  const customSel = config.selectors?.categories;
  const categories = await page.evaluate(
    ({ origin, sel }) => {
      const selectors = sel ? [sel] : ["nav a[href]", ".categories a[href]", ".genres a[href]", ".menu a[href]", "ul.nav a[href]"];
      const seen = /* @__PURE__ */ new Set();
      const results = [];
      for (const s of selectors) {
        for (const el of Array.from(document.querySelectorAll(s))) {
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
    },
    { origin: new URL(config.baseUrl).origin, sel: customSel }
  );
  onLog(`Step 1 › Found ${categories.length} categories.`);
  return categories;
}
async function scrapeMovieList(page, category, config, controller2, onLog) {
  const maxItems = config.maxMoviesPerCategory ?? Infinity;
  const maxPages = config.maxPagesPerCategory ?? Infinity;
  const delayMs = config.delayMs ?? 0;
  const movieSel = config.selectors?.movieList;
  const nextSel = config.selectors?.nextPage;
  const collected = [];
  let currentUrl = category.url;
  let pageNum = 1;
  while (currentUrl && !controller2.aborted && collected.length < maxItems && pageNum <= maxPages) {
    await controller2.checkPause(onLog);
    controller2.throwIfAborted();
    onLog(`  Step 2 › "${category.name}" — page ${pageNum}`);
    await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 3e4 });
    const items = await page.evaluate(
      ({ cat, sel }) => {
        const sels = sel ? [sel] : [".movie-item a[href]", ".film-item a[href]", "article.item a[href]", ".card a[href]", ".movie a[href]"];
        const seen = /* @__PURE__ */ new Set();
        const out = [];
        for (const s of sels) {
          for (const el of Array.from(document.querySelectorAll(s))) {
            const title = (el.textContent?.trim() || el.getAttribute("title") || "").trim();
            const url = el.href;
            if (!title || !url || seen.has(url)) continue;
            seen.add(url);
            out.push({ title, url, category: cat });
          }
          if (out.length) break;
        }
        return out;
      },
      { cat: category.name, sel: movieSel }
    );
    collected.push(...items.slice(0, maxItems - collected.length));
    const nextUrl = await page.evaluate((sel) => {
      const candidates = sel ? [document.querySelector(sel)] : [
        document.querySelector("a.next"),
        document.querySelector('a[rel="next"]'),
        document.querySelector(".pagination .next a"),
        document.querySelector(".pager-next a")
      ];
      return candidates.find(Boolean)?.href ?? null;
    }, nextSel);
    currentUrl = nextUrl;
    pageNum++;
    if (delayMs > 0) await sleep(delayMs);
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
        description: text('.description, .synopsis, [itemprop="description"], p.overview, .plot'),
        castArr: Array.from(
          document.querySelectorAll('.cast a, [itemprop="actor"] a, .actors a')
        ).slice(0, 10).map((el) => el.innerText?.trim()).filter(Boolean),
        poster: document.querySelector('.poster img, [itemprop="image"]')?.src
      };
    });
    return { ...movie, ...detail };
  } catch {
    onLog(`  Warning: could not load "${movie.title}"`);
    return movie;
  }
}
function toCsv(movies) {
  const headers = ["Title", "Category", "Year", "Rating", "Duration", "Director", "Cast", "Description", "URL"];
  const escape = (v) => `"${v.replace(/"/g, '""')}"`;
  const rows = movies.map(
    (m) => [
      m.title,
      m.category,
      m.year ?? "",
      m.rating ?? "",
      m.duration ?? "",
      m.director ?? "",
      m.cast ?? "",
      m.description ?? "",
      m.url
    ].map((v) => escape(String(v))).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
async function saveResults(movies, config, onLog) {
  const { outputDir, exportJson = true, exportExcel = true, exportCsv = true } = config;
  await promises.mkdir(outputDir, { recursive: true });
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const result = { totalMovies: movies.length, movies };
  if (exportJson) {
    result.jsonPath = path.join(outputDir, `movies-${stamp}.json`);
    await promises.writeFile(result.jsonPath, JSON.stringify(movies, null, 2), "utf-8");
    onLog(`✓ JSON  → ${result.jsonPath}`);
  }
  if (exportCsv) {
    result.csvPath = path.join(outputDir, `movies-${stamp}.csv`);
    await promises.writeFile(result.csvPath, toCsv(movies), "utf-8");
    onLog(`✓ CSV   → ${result.csvPath}`);
  }
  if (exportExcel) {
    result.excelPath = path.join(outputDir, `movies-${stamp}.xlsx`);
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
      { header: "URL", key: "url", width: 60 }
    ];
    const hRow = sheet.getRow(1);
    hRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1f2937" } };
    for (const m of movies) sheet.addRow(m);
    await wb.xlsx.writeFile(result.excelPath);
    onLog(`✓ Excel → ${result.excelPath}`);
  }
  return result;
}
async function runScraper(config, onProgress, onLog, onMovieBatch, controller2) {
  const delayMs = config.delayMs ?? 0;
  const launchOpts = { headless: config.headless };
  if (config.userAgent) ;
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({
    userAgent: config.userAgent,
    viewport: { width: 1280, height: 720 }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(3e4);
  try {
    const categories = await scrapeCategories(page, config, onLog);
    onProgress({ step: 1, label: "Categories", current: categories.length, total: categories.length, message: `Found ${categories.length} categories` });
    controller2.throwIfAborted();
    const allItems = [];
    for (let i = 0; i < categories.length; i++) {
      controller2.throwIfAborted();
      await controller2.checkPause(onLog);
      const cat = categories[i];
      onProgress({ step: 2, label: "Movie List", current: i, total: categories.length, message: `Scraping "${cat.name}"…` });
      const items = await scrapeMovieList(page, cat, config, controller2, onLog);
      allItems.push(...items);
      onLog(`  "${cat.name}": ${items.length} movies found`);
      if (delayMs > 0) await sleep(delayMs);
    }
    onProgress({ step: 2, label: "Movie List", current: categories.length, total: categories.length, message: `${allItems.length} movies collected` });
    controller2.throwIfAborted();
    const unique = Array.from(new Map(allItems.map((m) => [m.url, m])).values());
    const details = [];
    for (let i = 0; i < unique.length; i++) {
      controller2.throwIfAborted();
      await controller2.checkPause(onLog);
      const movie = unique[i];
      onProgress({ step: 3, label: "Detail Pages", current: i, total: unique.length, message: `"${movie.title}"` });
      const raw = await scrapeMovieDetail(page, movie, onLog);
      const detail = {
        title: raw.title,
        url: raw.url,
        category: raw.category,
        year: raw.year,
        rating: raw.rating,
        duration: raw.duration,
        director: raw.director,
        cast: raw.castArr?.join(", "),
        description: raw.description,
        poster: raw.poster
      };
      details.push(detail);
      onMovieBatch([detail]);
      if (delayMs > 0) await sleep(delayMs);
    }
    onProgress({ step: 3, label: "Detail Pages", current: details.length, total: unique.length, message: "All details scraped" });
    onLog("Saving results…");
    const result = await saveResults(details, config, onLog);
    return result;
  } finally {
    await browser.close();
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "../..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(process.env.APP_ROOT, "out/renderer");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let controller = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: path.join(__dirname$1, "../preload/index.cjs"),
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
  controller?.abort();
  controller = new ScrapeController();
  try {
    const result = await runScraper(
      config,
      (progress) => win?.webContents.send("scrape:progress", progress),
      (log) => win?.webContents.send("scrape:log", log),
      (movies) => win?.webContents.send("scrape:movieBatch", movies),
      controller
    );
    win?.webContents.send("scrape:complete", result);
    return { success: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    win?.webContents.send("scrape:error", message);
    return { success: false, error: message };
  } finally {
    controller = null;
  }
});
ipcMain.handle("scrape:stop", () => {
  controller?.abort();
  controller = null;
});
ipcMain.handle("scrape:pause", () => {
  controller?.pause();
});
ipcMain.handle("scrape:resume", () => {
  controller?.resume();
});
ipcMain.handle("open:path", (_event, filePath) => {
  shell.showItemInFolder(filePath);
});
ipcMain.handle("dialog:selectFolder", async () => {
  if (!win) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"]
  });
  return canceled ? null : filePaths[0];
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
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
