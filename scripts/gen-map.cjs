const fs = require("fs");
const html = fs.readFileSync("/Users/alexanderbustrup/Documents/Game ideas /twillight struggle/Twilight Struggle Map Design/Market Struggle.dc.html", "utf8");

// Extract DATA and CN
let i = html.indexOf("const DATA = "), j = html.indexOf("];", i) + 2;
const dataSrc = html.slice(i, j);
let k = html.indexOf("const CN = "), l = html.indexOf("];", k) + 2;
const cnSrc = html.slice(k, l);

let DATA, CN;
eval(dataSrc.replace("const DATA", "DATA"));
eval(cnSrc.replace("const CN", "CN"));

const BW = 84, BH = 46;
const REG = { eu: "Europe", me: "MiddleEast", af: "Africa", as: "Asia", na: "Europe", ca: "CentralAmerica", sa: "SouthAmerica" };
const SEA = new Set(["burma", "laos", "thailand", "vietnam", "malaysia", "indonesia", "philippines"]);
const adjUS = new Set(), adjUSSR = new Set();
const rawAdj = {};
for (const [a, b, type] of CN) {
  if (type === "sN") { adjUS.add(a === "nexus" ? b : a); adjUS.add(b === "nexus" ? a : b); }
  if (type === "sH") { adjUSSR.add(a === "helios" ? b : a); adjUSSR.add(b === "helios" ? a : b); }
  if (a === "nexus" || b === "nexus" || a === "helios" || b === "helios") continue;
  (rawAdj[a] = rawAdj[a] || []).push(b); (rawAdj[b] = rawAdj[b] || []).push(a);
}
// Official TS superpower adjacencies (map design omits a couple HQ lines).
adjUSSR.add("egermany"); adjUSSR.add("czech");
for (const id in rawAdj) rawAdj[id] = [...new Set(rawAdj[id])];

const WEU = new Set(["uk", "norway", "sweden", "denmark", "finland", "benelux", "france", "wgermany", "italy", "spain", "greece", "turkey", "canada"]);

// ---- map.ts ----
let out = "// AUTO-GENERATED from Market Struggle map design. Authoritative data — regenerate via scripts/gen-map.mjs.\n\n";
out += "export type Region = \"Europe\" | \"MiddleEast\" | \"Asia\" | \"Africa\" | \"CentralAmerica\" | \"SouthAmerica\";\n";
out += "export type SubRegion = \"WesternEurope\" | \"EasternEurope\" | \"SoutheastAsia\" | \"None\";\n\n";
out += "export interface CountryDef { id: string; name: string; region: Region; subregion: SubRegion; stability: number; battleground: boolean; adj: string[]; adjUS?: boolean; adjUSSR?: boolean; }\n\n";
out += "export const COUNTRIES: Record<string, CountryDef> = {\n";
for (const [id, name, x, y, rg, st, bg] of DATA) {
  const region = REG[rg];
  const sub = region === "Europe" ? (WEU.has(id) ? "WesternEurope" : "EasternEurope") : (SEA.has(id) ? "SoutheastAsia" : "None");
  const adj = rawAdj[id] || [];
  const au = adjUS.has(id), aus = adjUSSR.has(id);
  out += `  ${id}: { id: "${id}", name: ${JSON.stringify(name)}, region: "${region}", subregion: "${sub}", stability: ${st}, battleground: ${!!bg}, adj: ${JSON.stringify(adj)}${au ? ", adjUS: true" : ""}${aus ? ", adjUSSR: true" : ""} },\n`;
}
out += "};\n\n";
out += "export const COUNTRY_IDS = Object.keys(COUNTRIES);\n";
out += "export const SUPERPOWERS = [\"usa\", \"ussr\"] as const;\n\n";
out += "export function getCountry(id: string) { const c = COUNTRIES[id]; if (!c) throw new Error(\"Unknown country: \" + id); return c; }\n";
out += "export function countriesInRegion(r: Region) { return COUNTRY_IDS.filter(id => COUNTRIES[id].region === r); }\n";
out += "export function adjacent(a: string, b: string) { if (a === b) return false; const d = COUNTRIES[a]; return !!d && d.adj.includes(b); }\n";
out += "export function forbiddenRegionsForCoup(defcon: number): Region[] { switch (defcon) { case 5: return []; case 4: return [\"Europe\"]; case 3: return [\"Europe\", \"Asia\"]; case 2: return [\"Europe\", \"Asia\", \"MiddleEast\"]; default: return [\"Europe\", \"Asia\", \"MiddleEast\", \"Africa\", \"CentralAmerica\", \"SouthAmerica\"]; } }\n";
out += "export function canCoupInRegion(defcon: number, region: Region) { return !forbiddenRegionsForCoup(defcon).includes(region); }\n";
fs.writeFileSync("src/engine/data/map.ts", out);

// ---- boardLayout.ts ----
let bl = "// AUTO-GENERATED from Market Struggle map design. Exact pixel positions on the 2435x1536 canvas.\n\n";
bl += `export const BOARD_W = 2435, BOARD_H = 1536, NODE_W = ${BW}, NODE_H = ${BH};\n`;
bl += "export interface Pos { x: number; y: number }\n";
bl += "export const HQ = { usa: { x: 250, y: 470, w: 330, h: 230 }, ussr: { x: 1720, y: 300, w: 440, h: 230 } } as const;\n";
bl += "export const REGION_COLOR: Record<string, string> = { eu: \"#c3b1e1\", me: \"#bcd6ee\", af: \"#f0e3a8\", as: \"#f4b95e\", na: \"#cde0d2\", ca: \"#dceaa8\", sa: \"#aacb84\" };\n";
bl += "export const REGION_KEY: Record<string, string> = { eu: \"Europe\", me: \"Middle East\", af: \"Africa\", as: \"Asia\", na: \"N. America\", ca: \"C. America\", sa: \"S. America\" };\n\n";
bl += "export const LAYOUT: Record<string, Pos> = {\n";
for (const [id] of DATA) bl += `  ${id}: { x: ${DATA.find(d => d[0] === id)[2]}, y: ${DATA.find(d => d[0] === id)[3]} },\n`;
bl += "};\n\n";
bl += "export const FLAGS: Record<string, string[]> = {\n";
for (const [id, name, x, y, rg, st, bg, fl] of DATA) bl += `  ${id}: ${JSON.stringify(fl)},\n`;
bl += "};\n\n";
bl += "export interface Edge { x1: number; y1: number; x2: number; y2: number; type: string }\n";
bl += "export const EDGES: Edge[] = [\n";
const coord = {};
for (const [id, name, x, y] of DATA) coord[id] = [x + BW / 2, y + BH / 2];
for (const [a, b, type] of CN) {
  if (a === "nexus" || b === "nexus" || a === "helios" || b === "helios") continue;
  const ca = coord[a], cb = coord[b]; if (!ca || !cb) continue;
  bl += `  { x1: ${ca[0]}, y1: ${ca[1]}, x2: ${cb[0]}, y2: ${cb[1]}, type: "${type}" },\n`;
}
bl += "];\n";
fs.writeFileSync("src/engine/data/boardLayout.ts", bl);

console.log("Generated map.ts (" + out.length + " chars) and boardLayout.ts (" + bl.length + " chars)");
console.log("Countries:", DATA.length, "| Edges:", CN.filter(c => !c[0].match(/nexus|helios/) && !c[1].match(/nexus|helios/)).length);
console.log("adjUS:", [...adjUS].join(","));
console.log("adjUSSR:", [...adjUSSR].join(","));
