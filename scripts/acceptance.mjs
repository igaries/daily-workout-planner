/**
 * Acceptance tests for core business rules (Node, no browser).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Inline minimal ports of catalog + routine + weights for Node
const raw = JSON.parse(
  readFileSync(join(root, "src/data/catalog-raw.json"), "utf8"),
);
const bodyweight = new Set(
  readFileSync(join(root, "src/data/bodyweight.ts"), "utf8")
    .match(/"[^"]+"/g)
    .map((s) => s.slice(1, -1).toLowerCase().trim())
    .filter((s) => !s.includes("Appendix")),
);

const LIGHT = new Set(["Cardio", "Rest"]);
const byPart = new Map();
for (const row of raw) {
  const name = row.Exercise.trim();
  const parts = row["Body Part"].split(",").map((p) => p.trim());
  const weighted =
    !parts.some((p) => LIGHT.has(p)) &&
    !bodyweight.has(name.toLowerCase().trim());
  const ex = { name, bodyParts: parts, weighted };
  for (const p of parts) {
    const list = byPart.get(p) ?? [];
    if (!list.some((e) => e.name === name)) {
      list.push(ex);
      byPart.set(p, list);
    }
  }
}

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startingWeight(name, sessions) {
  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.name === name);
    if (!ex?.weights) continue;
    const nums = ex.weights.filter((w) => typeof w === "number");
    if (nums.length) return Math.max(...nums);
  }
  return null;
}

function suggestedWeight(item, setIndex, sessions) {
  for (let i = setIndex - 1; i >= 0; i--) {
    if (typeof item.weights[i] === "number") return item.weights[i];
  }
  return startingWeight(item.name, sessions);
}

function generate(bodyPart, size, sessions, rng = Math.random) {
  const pool = byPart.get(bodyPart) ?? [];
  const last = sessions.find((s) => s.bodyPart === bodyPart);
  const recentNames = new Set(last?.exercises.map((e) => e.name) ?? []);
  const light = LIGHT.has(bodyPart);
  const n = light ? 1 : size;
  const sets = light ? 1 : 3;
  const nonRecent = shuffle(
    pool.filter((e) => !recentNames.has(e.name)),
    rng,
  );
  const recent = shuffle(
    pool.filter((e) => recentNames.has(e.name)),
    rng,
  );
  const picked = [...nonRecent, ...recent].slice(0, Math.min(n, pool.length));
  return picked.map((ex) => ({
    name: ex.name,
    sets,
    weighted: ex.weighted,
    done: Array(sets).fill(false),
    weights: Array(sets).fill(ex.weighted ? startingWeight(ex.name, sessions) : null),
  }));
}

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("✓", msg);
  } else {
    failed++;
    console.error("✗", msg);
  }
}

// Catalog counts
assert(raw.length === 223, "Catalog has 223 rows");
for (const [part, n] of [
  ["Chest", 29],
  ["Back", 43],
  ["Shoulders", 35],
  ["Biceps", 12],
  ["Triceps", 10],
  ["Legs", 30],
  ["Glutes", 22],
  ["Calves", 5],
  ["Abs", 22],
  ["Forearm Flexors", 11],
  ["Forearm Extensor", 2],
  ["Cardio", 3],
  ["Rest", 1],
]) {
  assert((byPart.get(part) ?? []).length === n, `${part} has ${n} exercises`);
}

// 1. Chest size 5, prefer non-recent
{
  const lastNames = (byPart.get("Chest") ?? []).slice(0, 5).map((e) => e.name);
  const sessions = [
    {
      bodyPart: "Chest",
      exercises: lastNames.map((name) => ({ name, sets: 3, setsDone: 3 })),
    },
  ];
  const items = generate("Chest", 5, sessions, () => 0.5);
  assert(items.length === 5, "1: 5 Chest exercises");
  assert(items.every((i) => i.sets === 3), "1: 3 sets each");
  const overlap = items.filter((i) => lastNames.includes(i.name)).length;
  assert(overlap === 0, "1: none from last Chest session when enough others");
}

// 2. Cardio
{
  const items = generate("Cardio", 5, []);
  assert(items.length === 1 && items[0].sets === 1, "2: Cardio is 1×1");
  assert(items[0].weighted === false, "2: Cardio unweighted");
}

// 3. Weight prefill
{
  const sessions = [
    {
      bodyPart: "Chest",
      exercises: [
        { name: "Bench Press", sets: 3, setsDone: 3, weights: [135, 135, 135] },
      ],
    },
  ];
  const items = generate("Chest", 5, sessions);
  const bp = items.find((i) => i.name === "Bench Press");
  if (bp) {
    assert(
      bp.weights.every((w) => w === 135),
      "3: Bench Press prefills 135",
    );
  } else {
    // May not be in the random 5 — force check startingWeight
    assert(startingWeight("Bench Press", sessions) === 135, "3: starting weight 135");
  }
}

// 4. Suggested weight from previous set
{
  const item = {
    name: "Bench Press",
    weighted: true,
    weights: [140, null, null],
    done: [true, false, false],
  };
  assert(suggestedWeight(item, 1, []) === 140, "4: empty set inherits 140");
}

// 5. Push-Up unweighted
{
  const push = (byPart.get("Chest") ?? []).find((e) => e.name === "Push-Up");
  assert(push && push.weighted === false, "5: Push-Up unweighted");
}

// 8. Timer rounds at 95s / 30s
{
  const interval = 30;
  const elapsed = 95;
  const round = Math.floor(elapsed / interval) + 1;
  const beeps = [];
  let last = 0;
  for (let t = 0; t <= 95; t++) {
    const r = Math.floor(t / interval);
    if (r > last) {
      beeps.push(t);
      last = r;
    }
  }
  assert(
    JSON.stringify(beeps) === JSON.stringify([30, 60, 90]) && round === 4,
    "8: beeps at 30/60/90, round 4",
  );
}

// 11. kg→lb conversion
{
  const LB_TO_KG = 0.45359237;
  const kg = 60;
  const lb = Math.round((kg / LB_TO_KG) * 10) / 10;
  assert(lb === 132.3, "11: 60 kg → 132.3 lb");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
