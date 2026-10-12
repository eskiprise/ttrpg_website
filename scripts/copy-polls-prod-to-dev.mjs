#!/usr/bin/env node
/*
 * Copy the Telegram rating polls and their votes from prod to dev, so the dev site and
 * Mini App show the real game history. Run by .github/workflows/copy-polls-prod-to-dev.yml
 * (Actions → "Copy polls prod → dev" → Run workflow), or locally with AWS credentials.
 *
 * Only these two tables: GM and voter names are stored on the poll and vote rows
 * themselves, so they're all the Game Log, statistics and system pages need. Deliberately
 * not telegram_feedback — every new row there fires the dev bot's notify_new_feedback
 * stream handler (a message per row), and it's private.
 *
 * Rows are copied exactly as stored (raw DynamoDB attribute values, no conversion).
 * Prod is only ever read; the table pairs below are fixed and checked to run prod → dev.
 * Telegram poll ids are unique across bots, so prod polls can't collide with the dev
 * bot's own test polls.
 *
 * Modes:
 *   merge   (default) adds/updates every prod row on dev; dev-only rows stay.
 *   replace           the same, then deletes dev rows prod doesn't have — dev ends up an
 *                     exact copy of prod's polls and votes.
 *
 * Dry-run by default, like scripts/copy_game_systems.py: prints what would change.
 *
 * Usage:
 *   node scripts/copy-polls-prod-to-dev.mjs [--mode merge|replace] [--apply]
 */
import {
  BatchWriteItemCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

const TABLES = [
  { label: "Опитування", from: "ttrpg_club_prod_telegram_rating_polls", to: "ttrpg_club_dev_telegram_rating_polls" },
  { label: "Голоси", from: "ttrpg_club_prod_telegram_rating_votes", to: "ttrpg_club_dev_telegram_rating_votes" },
];

const BATCH_SIZE = 25; // BatchWriteItem's limit
const MAX_ATTEMPTS = 8;

function parseArgs(argv) {
  const args = { mode: "merge", apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apply") args.apply = true;
    else if (argv[i] === "--mode") args.mode = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (args.mode !== "merge" && args.mode !== "replace") {
    throw new Error(`--mode must be "merge" or "replace", got "${args.mode}"`);
  }
  return args;
}

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? "eu-west-2" });

async function scanAll(tableName) {
  const items = [];
  let exclusiveStartKey;
  do {
    const page = await client.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey }));
    items.push(...(page.Items ?? []));
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

async function keyAttributes(tableName) {
  const { Table } = await client.send(new DescribeTableCommand({ TableName: tableName }));
  return Table.KeySchema.map((k) => k.AttributeName).sort();
}

function keyOf(item, keyNames) {
  return JSON.stringify(keyNames.map((name) => item[name]));
}

function pickKey(item, keyNames) {
  return Object.fromEntries(keyNames.map((name) => [name, item[name]]));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** BatchWriteItem in chunks of 25, retrying whatever DynamoDB hands back as unprocessed. */
async function batchWrite(tableName, requests) {
  for (let start = 0; start < requests.length; start += BATCH_SIZE) {
    let pending = requests.slice(start, start + BATCH_SIZE);
    for (let attempt = 1; pending.length > 0; attempt += 1) {
      if (attempt > MAX_ATTEMPTS) throw new Error(`${tableName}: ${pending.length} writes still unprocessed after ${MAX_ATTEMPTS} attempts`);
      if (attempt > 1) await sleep(100 * 2 ** attempt);
      const result = await client.send(new BatchWriteItemCommand({ RequestItems: { [tableName]: pending } }));
      pending = result.UnprocessedItems?.[tableName] ?? [];
    }
  }
}

async function copyTable({ label, from, to }, { mode, apply }) {
  // The one guard that matters: never write anywhere but dev, never read anything but prod.
  if (!from.includes("_prod_") || !to.includes("_dev_")) {
    throw new Error(`Refusing ${from} → ${to}: copies only run from a prod table to a dev table`);
  }
  const [sourceKey, targetKey] = await Promise.all([keyAttributes(from), keyAttributes(to)]);
  if (JSON.stringify(sourceKey) !== JSON.stringify(targetKey)) {
    throw new Error(`${from} and ${to} have different keys (${sourceKey} vs ${targetKey})`);
  }

  const [sourceItems, targetItems] = await Promise.all([scanAll(from), scanAll(to)]);
  const sourceKeys = new Set(sourceItems.map((item) => keyOf(item, sourceKey)));
  const targetKeys = new Set(targetItems.map((item) => keyOf(item, targetKey)));
  const added = sourceItems.filter((item) => !targetKeys.has(keyOf(item, sourceKey))).length;
  const stale = mode === "replace" ? targetItems.filter((item) => !sourceKeys.has(keyOf(item, targetKey))) : [];

  if (apply) {
    await batchWrite(to, sourceItems.map((item) => ({ PutRequest: { Item: item } })));
    await batchWrite(to, stale.map((item) => ({ DeleteRequest: { Key: pickKey(item, targetKey) } })));
  }

  return {
    label,
    prod: sourceItems.length,
    devBefore: targetItems.length,
    added,
    updated: sourceItems.length - added,
    deleted: stale.length,
    kept: mode === "merge" ? targetItems.filter((item) => !sourceKeys.has(keyOf(item, targetKey))).length : 0,
  };
}

function report(results, { mode, apply }) {
  const heading = apply ? `Скопійовано з prod на dev (режим ${mode})` : `Пробний запуск, нічого не записано (режим ${mode})`;
  const rows = results.map(
    (r) => `| ${r.label} | ${r.prod} | ${r.devBefore} | ${r.added} | ${r.updated} | ${r.deleted} | ${r.kept} |`
  );
  const markdown = [
    `### ${heading}`,
    "",
    "| Таблиця | На prod | На dev до | Нових | Оновлено | Видалено з dev | Лише на dev, залишено |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    return import("node:fs").then(({ appendFileSync }) => appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`));
  }
}

const args = parseArgs(process.argv.slice(2));
const results = [];
for (const table of TABLES) results.push(await copyTable(table, args));
await report(results, args);
if (!args.apply) console.log("Dry run — add --apply to write.");
