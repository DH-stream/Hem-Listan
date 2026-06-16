import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

// Run without committing Playwright as an app dependency, for example:
//   npx -y -p playwright@1.56.1 node scripts/smoke-knatteplock-import.mjs

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const playwrightBinDir = process.env.PATH
      ?.split(":")
      .find((entry) => entry.includes("_npx") && entry.endsWith("node_modules/.bin"));
    if (!playwrightBinDir) throw error;

    const playwrightRoot = join(dirname(playwrightBinDir), "playwright");
    return import(pathToFileURL(join(playwrightRoot, "index.js")).href);
  }
}

const playwright = await loadPlaywright();
const { chromium } = playwright.default ?? playwright;

const RECIPE_CASES = [
  {
    name: "Snickersglass",
    url: "https://www.knatteplock.se/blogs/enkla-recept-for-barn-familj/snickersglass",
    expectedImageSrc:
      "https://www.knatteplock.se/cdn/shop/articles/Skarmavbild_2026-04-24_kl._11.19.31.png?v=1777022444&width=1600",
  },
  {
    name: "Tropisk mellisglass",
    url: "https://www.knatteplock.se/blogs/enkla-recept-for-barn-familj/tropisk-mellisglass",
    expectedImageSrc:
      "https://www.knatteplock.se/cdn/shop/files/20260430094538-namnlo-cc-88s-20-1080-20-c3-97-201080-20px-20-800-20-c3-97-20800-20px-20-1500-20x-201800-20px-20-1080-20x-201350-20px-20-21.jpg?v=1780662899&width=1600",
  },
  {
    name: "Morotskakeglass",
    url: "https://www.knatteplock.se/blogs/enkla-recept-for-barn-familj/morotskakeglass",
    expectNoRecipeImage: true,
  },
];
const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const EXPECTED_HOST = "www.knatteplock.se";
const LOGO_OR_PLACEHOLDER_PATTERN =
  /logo|logotyp|favicon|icon|placeholder|brand|cdn\/shop\/(?:files\/(?:logo|knatteplock))/i;

const fetchShimPath = join(tmpdir(), "hem-listan-knatteplock-fetch-shim.mjs");
writeFileSync(
  fetchShimPath,
  `import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url;
  const parsedUrl = typeof url === "string" ? new URL(url) : null;
  if (parsedUrl?.hostname === "www.knatteplock.se" && parsedUrl.pathname.startsWith("/blogs/")) {
    const { stdout } = await execFileAsync("curl", [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "30",
      url,
    ], { maxBuffer: 5 * 1024 * 1024, signal: init?.signal });
    return new Response(stdout, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return originalFetch(input, init);
};
`,
);

const initialLists = [
  {
    id: "grocery-1",
    name: "ICA Vecka 23",
    icon: "shopping_cart",
    themeColor: "#346a2f",
    category: "grocery",
    tasks: [{ id: "g-t-1", text: "Mjölk (2L)", checked: false, notes: "Mejeri" }],
    meals: [],
  },
];

function waitForServer(url, timeoutMs = 45_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {}

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    void tick();
  });
}

async function openImportPreview(browser, recipeCase) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.addInitScript((lists) => {
    localStorage.setItem("hem-listan-lists", JSON.stringify(lists));
    localStorage.removeItem("hem_listan_supabase_url");
    localStorage.removeItem("hem_listan_supabase_anon_key");
  }, initialLists);

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.getByText("ICA Vecka 23").click();
  await page.getByRole("textbox").fill(recipeCase.url);
  await page.getByRole("button", { name: "Hämta" }).click();

  const modal = page.getByRole("dialog", { name: new RegExp(recipeCase.name, "i") });
  await modal.waitFor({ timeout: 60_000 });
  return { page, modal };
}

function assertAllowedKnatteplockImage(imageSrc) {
  if (!imageSrc) throw new Error("Import preview rendered an image without src");
  const parsedImageUrl = new URL(imageSrc, APP_URL);

  if (parsedImageUrl.hostname !== EXPECTED_HOST) {
    throw new Error(`Expected Knatteplock image host, got ${parsedImageUrl.href}`);
  }
  if (!/\/cdn\/shop\//i.test(parsedImageUrl.pathname)) {
    throw new Error(`Expected a Knatteplock Shopify CDN image, got ${parsedImageUrl.href}`);
  }
  if (/\/(?:products|collections)\//i.test(parsedImageUrl.pathname)) {
    throw new Error(`Preview selected a product/collection image: ${parsedImageUrl.href}`);
  }
  if (LOGO_OR_PLACEHOLDER_PATTERN.test(parsedImageUrl.href)) {
    throw new Error(`Preview selected a logo/placeholder-like image: ${parsedImageUrl.href}`);
  }
  if (/author|profile|avatar|elin|oresten/i.test(parsedImageUrl.href)) {
    throw new Error(`Preview selected an author/profile image: ${parsedImageUrl.href}`);
  }

  return parsedImageUrl.href;
}

async function readPreviewImageSrc(page, modal) {
  const images = modal.locator("img");
  const imageCount = await images.count();
  if (imageCount === 0) return null;

  const image = images.first();
  await page.waitForFunction(
    (element) =>
      element instanceof HTMLImageElement &&
      element.complete &&
      element.naturalWidth > 0,
    await image.elementHandle(),
    { timeout: 15_000 },
  );
  return image.getAttribute("src");
}

const server = spawn("npm", ["run", "dev"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "development",
    NODE_OPTIONS: [
      process.env.NODE_OPTIONS,
      "--dns-result-order=ipv4first",
      `--import=${fetchShimPath}`,
    ]
      .filter(Boolean)
      .join(" "),
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});

server.stdout.on("data", (chunk) => process.stdout.write(`[app] ${chunk}`));
server.stderr.on("data", (chunk) => process.stderr.write(`[app] ${chunk}`));

let browser;
try {
  await waitForServer(APP_URL);

  browser = await chromium.launch({ headless: true });
  const results = [];

  for (const recipeCase of RECIPE_CASES) {
    const { page, modal } = await openImportPreview(browser, recipeCase);
    try {
      const imageSrc = await readPreviewImageSrc(page, modal);

      if (recipeCase.expectNoRecipeImage) {
        if (imageSrc) {
          const parsedImageSrc = assertAllowedKnatteplockImage(imageSrc);
          throw new Error(
            `Expected no recipe image for ${recipeCase.name}, got ${parsedImageSrc}`,
          );
        }
        results.push({
          recipeUrl: recipeCase.url,
          previewImageSrc: null,
          checks: [
            "preview dialog rendered",
            "no recipe image rendered because Knatteplock exposes no WRH recipe media",
            "no logo/favicon/icon/placeholder/brand/author/product/collection fallback was selected",
          ],
        });
        continue;
      }

      if (!imageSrc) {
        throw new Error(`Import preview did not render an image for ${recipeCase.name}`);
      }

      const previewImageSrc = assertAllowedKnatteplockImage(imageSrc);
      if (previewImageSrc !== recipeCase.expectedImageSrc) {
        throw new Error(
          `Expected ${recipeCase.name} WRH image ${recipeCase.expectedImageSrc}, got ${previewImageSrc}`,
        );
      }

      results.push({
        recipeUrl: recipeCase.url,
        previewImageSrc,
        checks: [
          "preview dialog rendered",
          "preview image rendered and loaded in import preview",
          "image has src",
          "image host is www.knatteplock.se",
          "image path is /cdn/shop/...",
          "image is not logo/favicon/icon/placeholder/brand/author/product/collection",
          "image source matches the live WRH recipe hero/media image",
        ],
      });
    } finally {
      await page.close();
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  if (browser) await browser.close();
  process.kill(-server.pid, "SIGTERM");
}
