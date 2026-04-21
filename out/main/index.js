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
const CATEGORY_SELECTORS = [
  // User hint first (set in config)
  // Common menu selectors
  "nav a[href]",
  ".main-menu a[href]",
  ".menu-main a[href]",
  ".primary-menu a[href]",
  ".nav-menu a[href]",
  ".navbar a[href]",
  // Genre / category pages
  ".genres a[href]",
  ".categories a[href]",
  ".the-loai a[href]",
  // Vietnamese
  ".genre-list a[href]",
  ".cat-list a[href]",
  // Header nav
  "header nav a[href]",
  "header ul a[href]",
  ".header-menu a[href]",
  "#main-nav a[href]",
  "#menu-primary a[href]",
  // Generic lists
  ".menu a[href]",
  "ul.nav a[href]"
];
const SKIP_URL_KEYWORDS = [
  "login",
  "logout",
  "register",
  "signup",
  "search",
  "tim-kiem",
  "about",
  "contact",
  "privacy",
  "terms",
  "sitemap",
  "rss",
  "feed",
  "dang-nhap",
  "dang-ky",
  "lien-he",
  "gioi-thieu",
  "javascript:",
  "mailto:",
  "tel:",
  "#"
];
async function scrapeCategories(page, config, onLog) {
  onLog("Step 1 › Loading homepage…");
  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: 3e4 });
  const origin = new URL(config.baseUrl).origin;
  const customSel = config.selectors?.categories;
  const categories = await page.evaluate(
    ({ origin: origin2, selectors, skipKw }) => {
      const seen = /* @__PURE__ */ new Set();
      const results = [];
      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const name = el.textContent?.trim() || el.getAttribute("title") || "";
          const href = el.href || "";
          if (!name || !href) continue;
          if (!href.startsWith(origin2)) continue;
          const lhref = href.toLowerCase();
          if (skipKw.some((k) => lhref.includes(k))) continue;
          if (seen.has(href)) continue;
          seen.add(href);
          results.push({ name, url: href });
        }
        if (results.length >= 5) break;
      }
      return results;
    },
    { origin, selectors: customSel ? [customSel] : CATEGORY_SELECTORS, skipKw: SKIP_URL_KEYWORDS }
  );
  if (categories.length === 0) {
    onLog("Step 1 › No category links found — will scrape homepage directly.");
    return [{ name: "Home", url: config.baseUrl }];
  }
  onLog(`Step 1 › Found ${categories.length} categories.`);
  return categories;
}
const LIST_SELECTORS = [
  // --- Specific class names ---
  ".movie-item a[href]",
  ".film-item a[href]",
  ".item .thumb a[href]",
  ".item a.thumb[href]",
  ".item h3 a[href]",
  ".item h2 a[href]",
  ".item .name a[href]",
  ".item .title a[href]",
  // article-based
  "article.item a[href]",
  "article a.thumb[href]",
  "article .thumb a[href]",
  "article h3 a[href]",
  // Vietnamese sites
  ".phim-item a[href]",
  ".phim a[href]",
  ".thumb-item a[href]",
  ".box-phim a[href]",
  ".movies-list a.thumb[href]",
  // Generic card patterns
  ".card a[href]",
  ".card-item a[href]",
  ".movie a[href]",
  ".movies a[href]",
  ".film a[href]",
  ".post-item a[href]",
  // WordPress common
  ".entry-title a[href]",
  "h2.entry-title a[href]",
  "h3.entry-title a[href]",
  // Grid wrappers
  ".grid-item a[href]",
  ".list-movie a[href]",
  ".list-film a[href]"
];
const NEXT_PAGE_SELECTORS = [
  "a.next[href]",
  'a[rel="next"][href]',
  ".pagination .next a[href]",
  '.pagination a[aria-label="Next"][href]',
  ".page-numbers.next[href]",
  "a.page-numbers.next[href]",
  ".pager-next a[href]",
  ".next-page a[href]",
  "li.next a[href]",
  'a[title="Next page"][href]',
  'a[title="Trang sau"][href]',
  ".phan-trang .next[href]"
];
const MOVIE_URL_PATTERNS = [
  "/phim/",
  "/xem-phim/",
  "/movie/",
  "/movies/",
  "/film/",
  "/films/",
  "/watch/",
  "/detail/",
  "/truyen-hinh/",
  "/series/",
  "/tap-",
  "/episode"
];
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
    const origin = new URL(config.baseUrl).origin;
    const items = await page.evaluate(
      ({
        cat,
        origin: origin2,
        customSel,
        listSels,
        moviePatterns,
        skipKw
      }) => {
        const seen = /* @__PURE__ */ new Set();
        const out = [];
        function add(el) {
          const url = el.href;
          const title = (el.getAttribute("title") || el.textContent?.trim() || el.querySelector("img")?.getAttribute("alt") || "").trim();
          if (!title || !url || seen.has(url)) return;
          if (!url.startsWith(origin2)) return;
          seen.add(url);
          out.push({ title, url, category: cat });
        }
        const sels = customSel ? [customSel] : listSels;
        for (const s of sels) {
          for (const el of Array.from(document.querySelectorAll(s))) add(el);
          if (out.length >= 3) break;
        }
        if (out.length >= 3) return out;
        for (const img of Array.from(document.querySelectorAll("img"))) {
          const parentA = img.closest("a[href]");
          if (parentA) {
            add(parentA);
            continue;
          }
          const card = img.closest("li, div, article");
          if (!card) continue;
          for (const a of Array.from(card.querySelectorAll("a[href]"))) add(a);
        }
        if (out.length >= 3) return out;
        for (const a of Array.from(document.querySelectorAll("a[href]"))) {
          const url = a.href;
          if (!url.startsWith(origin2)) continue;
          const path2 = new URL(url).pathname.toLowerCase();
          if (moviePatterns.some((p) => path2.includes(p))) add(a);
        }
        if (out.length >= 3) return out;
        const skipKwLower = skipKw.map((k) => k.toLowerCase());
        const allInternal = Array.from(document.querySelectorAll("a[href]")).filter((a) => {
          const url = a.href;
          if (!url.startsWith(origin2)) return false;
          const low = url.toLowerCase();
          return !skipKwLower.some((k) => low.includes(k));
        });
        const groups = /* @__PURE__ */ new Map();
        for (const a of allInternal) {
          const key = a.parentElement?.className ?? "__none__";
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(a);
        }
        let best = [];
        for (const [, grp] of groups) {
          if (grp.length > best.length) best = grp;
        }
        for (const a of best) add(a);
        return out;
      },
      { cat: category.name, origin, customSel: movieSel, listSels: LIST_SELECTORS, moviePatterns: MOVIE_URL_PATTERNS, skipKw: SKIP_URL_KEYWORDS }
    );
    if (items.length === 0) {
      onLog(`  ⚠ No movies found on page ${pageNum} of "${category.name}"`);
    }
    collected.push(...items.slice(0, maxItems - collected.length));
    const nextUrl = await page.evaluate(
      ({ customSel, nextSels }) => {
        const sels = customSel ? [customSel] : nextSels;
        for (const s of sels) {
          const el = document.querySelector(s);
          if (el?.href) return el.href;
        }
        return null;
      },
      { customSel: nextSel, nextSels: NEXT_PAGE_SELECTORS }
    );
    currentUrl = nextUrl;
    pageNum++;
    if (delayMs > 0) await sleep(delayMs);
  }
  return collected;
}
const VIDEO_URL_RE = /\.(m3u8|mp4|mkv|webm|mpd)(\?.*)?$/i;
const VIDEO_PATH_RE = /\/(manifest|playlist|index)\.(m3u8|mpd)/i;
const VIDEO_HINT_RE = /\/(hls|dash|stream|video)\//i;
async function scrapeMovieDetail(page, movie, onLog) {
  try {
    const capturedVideos = [];
    const onRequest = (req) => {
      const u = req.url();
      if (u.startsWith("blob:")) return;
      if (VIDEO_URL_RE.test(u) || VIDEO_PATH_RE.test(u) || VIDEO_HINT_RE.test(u)) {
        capturedVideos.push(u);
      }
    };
    page.on("request", onRequest);
    await page.goto(movie.url, { waitUntil: "domcontentloaded", timeout: 3e4 });
    await sleep(2e3);
    page.off("request", onRequest);
    const videoUrl = capturedVideos.find((u) => u.includes("master") || u.includes("index.m3u8")) || capturedVideos.find((u) => VIDEO_URL_RE.test(u)) || capturedVideos[0];
    const data = await page.evaluate(() => {
      const text = (...sels) => {
        for (const sel of sels) {
          const el = document.querySelector(sel);
          const t = el?.innerText?.trim() || el?.getAttribute("content")?.trim();
          if (t) return t;
        }
        return void 0;
      };
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content?.trim();
      const ogDesc = document.querySelector('meta[property="og:description"]')?.content?.trim();
      const ogImg = document.querySelector('meta[property="og:image"]')?.content?.trim();
      const metaDesc = document.querySelector('meta[name="description"]')?.content?.trim();
      let jld = {};
      try {
        const script = document.querySelector('script[type="application/ld+json"]');
        if (script?.textContent) {
          const parsed = JSON.parse(script.textContent);
          jld = Array.isArray(parsed) ? parsed[0] : parsed;
        }
      } catch {
      }
      const title = text("h1.title", "h1.movie-title", "h1.film-title", "h1.entry-title", ".detail-title h1", ".info h1", "#title", "h1");
      const year = text(".year", ".release-year", ".meta-year", '[itemprop="dateCreated"]', "span.year", ".film-info .year", ".movie-info .year", ".movie-year", ".film-year", ".info-year");
      const rating = text(".rating", ".score", ".imdb", ".star", '[itemprop="ratingValue"]', ".rate", ".film-rate", ".kkrating");
      const duration = text(".duration", ".runtime", ".time", '[itemprop="duration"]', ".meta-runtime", ".film-duration", "span.runtime");
      const director = text(".director", '[itemprop="director"]', ".director a", ".movie-director", ".film-director", ".info-director", '[class*="director"]');
      const description = text('[itemprop="description"]', ".description", ".synopsis", ".plot", ".movie-description", ".film-description", ".content", "p.desc", ".detail-content p");
      const cast = Array.from(
        document.querySelectorAll('[itemprop="actor"], .cast a, .actors a, .actor a, .list-actor a, .movie-cast a, .film-cast a')
      ).slice(0, 10).map((el) => el.innerText?.trim()).filter(Boolean).join(", ");
      const poster = document.querySelector('[itemprop="image"] img, .poster img, .thumb img, .film-poster img, .movie-poster img')?.src || document.querySelector('img.poster, img.thumb, img[class*="poster"]')?.src;
      let jwVideoUrl;
      let jwDuration;
      let jwSubtitles = [];
      try {
        const jw = window.jwplayer;
        if (typeof jw === "function") {
          const player = jw();
          const config = player.getConfig();
          const sources = config.sources || config.playlist?.[0]?.sources || [];
          jwVideoUrl = sources.find((s) => s.file && !s.file.startsWith("blob:"))?.file || sources.find((s) => s.src && !s.src.startsWith("blob:"))?.src;
          const dur = player.getDuration();
          if (dur > 0) {
            const h = Math.floor(dur / 3600);
            const m = Math.floor(dur % 3600 / 60);
            const s = Math.floor(dur % 60);
            jwDuration = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
          }
          jwSubtitles = player.getCaptionsList().map((t) => t.label).filter((l) => l && l.toLowerCase() !== "off");
        }
      } catch {
      }
      const playerDuration = jwDuration || document.querySelector(".jw-text-duration")?.innerText?.trim() || duration;
      if (!jwSubtitles.length) {
        jwSubtitles = Array.from(
          document.querySelectorAll('[id*="submenu-captions"] button[aria-label]')
        ).map((el) => el.getAttribute("aria-label") || "").filter((l) => l && l !== "Off" && l !== "Subtitle Settings");
      }
      return {
        title: String(jld["name"] ?? title ?? ogTitle ?? ""),
        year: String(jld["dateCreated"] ?? year ?? ""),
        rating: String(jld["aggregateRating"]?.["ratingValue"] ?? rating ?? ""),
        duration: playerDuration || "",
        director: String(jld["director"]?.["name"] ?? director ?? ""),
        description: String(jld["description"] ?? description ?? ogDesc ?? metaDesc ?? ""),
        cast,
        poster: String(jld["image"]?.["url"] ?? poster ?? ogImg ?? ""),
        jwVideoUrl,
        subtitles: jwSubtitles.join(", ") || ""
      };
    });
    return {
      title: data.title || movie.title,
      url: movie.url,
      category: movie.category,
      year: data.year || void 0,
      rating: data.rating || void 0,
      duration: data.duration || void 0,
      director: data.director || void 0,
      description: data.description || void 0,
      cast: data.cast || void 0,
      poster: data.poster || void 0,
      videoUrl: data.jwVideoUrl || videoUrl || void 0,
      subtitles: data.subtitles || void 0
    };
  } catch (err) {
    onLog(`  ⚠ Detail failed for "${movie.title}": ${err instanceof Error ? err.message : err}`);
    return movie;
  }
}
function toCsv(movies) {
  const headers = ["Title", "Category", "Year", "Rating", "Duration", "Director", "Cast", "Description", "URL", "Poster", "VideoURL", "Subtitles"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = movies.map(
    (m) => [m.title, m.category, m.year, m.rating, m.duration, m.director, m.cast, m.description, m.url, m.poster, m.videoUrl, m.subtitles].map(esc).join(",")
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
      { header: "URL", key: "url", width: 60 },
      { header: "Poster", key: "poster", width: 60 },
      { header: "Video URL", key: "videoUrl", width: 80 },
      { header: "Subtitles", key: "subtitles", width: 40 }
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
  const browser = await chromium.launch({ headless: config.headless });
  const ctx = await browser.newContext({
    userAgent: config.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
    }
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
      onLog(`  "${cat.name}": ${items.length} movies`);
      if (delayMs > 0) await sleep(delayMs);
    }
    onProgress({ step: 2, label: "Movie List", current: categories.length, total: categories.length, message: `${allItems.length} movies collected` });
    controller2.throwIfAborted();
    const unique = Array.from(new Map(allItems.map((m) => [m.url, m])).values());
    onLog(`Step 2 › ${unique.length} unique movie URLs collected.`);
    const details = [];
    for (let i = 0; i < unique.length; i++) {
      controller2.throwIfAborted();
      await controller2.checkPause(onLog);
      const movie = unique[i];
      onProgress({ step: 3, label: "Detail Pages", current: i, total: unique.length, message: `"${movie.title}"` });
      const detail = await scrapeMovieDetail(page, movie, onLog);
      details.push(detail);
      onMovieBatch([detail]);
      if (delayMs > 0) await sleep(delayMs);
    }
    onProgress({ step: 3, label: "Detail Pages", current: details.length, total: unique.length, message: "All details scraped" });
    onLog(`Saving ${details.length} movies…`);
    return await saveResults(details, config, onLog);
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
