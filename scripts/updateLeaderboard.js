import fs from "fs";
import { chromium } from "playwright";

const URL = "https://www.cbssports.com/golf/leaderboard/pga-tour/";

const PLAYERS = [
  "Scottie Scheffler",
  "Jon Rahm",
  "Rory McIlroy",
  "Xander Schauffele",
  "Bryson DeChambeau",
  "Ludvig Aberg",
  "Tommy Fleetwood",
  "Cameron Young",
  "Hideki Matsuyama",
  "Nicolas Echavarria",
  "Brooks Koepka",
  "Viktor Hovland",
  "Collin Morikawa",
  "Robert Macintyre",
  "Matt Fitzpatrick"
];

const normalize = s =>
  s.toLowerCase()
   .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z ]/g,"");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("tbody tr", { timeout: 30000 });

  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("tbody tr")).map(tr => {
      const tds = tr.querySelectorAll("td");
      return {
        name: tds[1]?.innerText?.trim(),
        toPar: tds[2]?.innerText?.trim()
      };
    });
  });

  const leaderboard = {};
  let found = 0;

  for (const p of PLAYERS) {
    const r = rows.find(x => normalize(x.name) === normalize(p));
    if (!r || !r.toPar) {
      leaderboard[p] = null;
    } else if (r.toPar === "E") {
      leaderboard[p] = 0;
      found++;
    } else {
      leaderboard[p] = parseInt(r.toPar.replace("+",""),10);
      found++;
    }
  }

  if (found < 3) {
    console.error("❌ Pocos jugadores detectados, abortando update");
    process.exit(0);
  }

  const html = fs.readFileSync("index.html","utf8");
  const updated = html.replace(
    /leaderboard:\s*{[\s\S]*?}/,
    `leaderboard: ${JSON.stringify(leaderboard, null, 2)}`
  );
  fs.writeFileSync("index.html", updated);
  console.log("✅ Leaderboard actualizado vía CBS Sports");

  await browser.close();
})();
