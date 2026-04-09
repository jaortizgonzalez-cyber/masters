import fs from "fs";
import { chromium } from "playwright";

const URL = "https://www.pgatour.com/es/leaderboard";

// ✅ Jugadores de la polla
const PLAYERS = [
  "Scottie Scheffler",
  "Jon Rahm",
  "Rory McIlroy",
  "Xander Schauffele",
  "Bryson DeChambeau",
  "Ludvig Åberg",
  "Tommy Fleetwood",
  "Cameron Young",
  "Hideki Matsuyama",
  "Nicolás Echavarría",
  "Brooks Koepka",
  "Viktor Hovland",
  "Collin Morikawa",
  "Robert MacIntyre",
  "Matt Fitzpatrick"
];

// ✅ Normalización robusta (acentos, mayúsculas, símbolos)
const normalize = s =>
  s
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 }
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // ✅ CORRECCIÓN CLAVE:
  // Esperar a que EXISTAN filas en la tabla (no visibilidad)
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll("table tbody tr");
    return rows.length > 10; // el leaderboard real tiene ~93
  }, { timeout: 30000 });

  const tableData = await page.evaluate(() => {
    const table = document.querySelector("table");
    if (!table) return null;

    // ✅ Detectar columnas dinámicamente por encabezado
    const headers = Array.from(table.querySelectorAll("thead th"))
      .map(th => th.innerText.toLowerCase().trim());

    const nameIndex = headers.findIndex(h =>
      h.includes("jugador") || h.includes("player")
    );

    const toParIndex = headers.findIndex(h =>
      h.includes("par")
    );

    if (nameIndex === -1 || toParIndex === -1) {
      return null;
    }

    const rows = Array.from(table.querySelectorAll("tbody tr"));

    return rows.map(tr => {
      const cells = tr.querySelectorAll("td");
      return {
        name: cells[nameIndex]?.innerText.trim(),
        toPar: cells[toParIndex]?.innerText.trim()
      };
    });
  });

  await browser.close();

  // 🛑 PROTECCIÓN 1: si no pudimos leer la tabla, abortar
  if (!tableData || tableData.length === 0) {
    console.error("❌ No se pudo leer el leaderboard. No se actualiza el HTML.");
    process.exit(0);
  }

  const leaderboard = {};
  let foundCount = 0;

  for (const player of PLAYERS) {
    const row = tableData.find(r =>
      normalize(r.name) === normalize(player)
    );

    if (!row || !row.toPar || row.toPar === "—") {
      leaderboard[player] = null;
    } else if (row.toPar === "E") {
      leaderboard[player] = 0;
      foundCount++;
    } else {
      const value = parseInt(row.toPar.replace("+", ""), 10);
      leaderboard[player] = isNaN(value) ? null : value;
      if (!isNaN(value)) foundCount++;
    }
  }

  // 🛑 PROTECCIÓN 2 (CRÍTICA):
  // Si no encontramos al menos 3 jugadores con score → NO COMMIT
  if (foundCount < 3) {
    console.error(
      `❌ Solo se detectaron ${foundCount} jugadores con score. Abortando update.`
    );
    process.exit(0);
  }

  const html = fs.readFileSync("index.html", "utf8");

  const updatedHtml = html.replace(
    /leaderboard:\s*{[\s\S]*?}/,
    `leaderboard: ${JSON.stringify(leaderboard, null, 2)}`
  );

  if (updatedHtml !== html) {
    fs.writeFileSync("index.html", updatedHtml);
    console.log("✅ Leaderboard actualizado correctamente");
  } else {
    console.log("ℹ️ Sin cambios detectados");
  }
})();
