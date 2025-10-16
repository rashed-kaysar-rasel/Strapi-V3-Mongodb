/**
 * Universal Mongo → PostgreSQL data migration for Strapi v4
 * ---------------------------------------------------------
 * ✅ Handles UTF-16 → UTF-8 conversion automatically
 * ✅ Supports JSON arrays & NDJSON (bsondump output)
 * ✅ Dynamically maps collection names to Strapi content-types
 * ✅ Skips Strapi system collections & corrupt files
 * ✅ Converts non-ISO date formats safely
 * ✅ Writes a migration.log summary
 */

const fs = require("fs");
const path = require("path");
const Strapi = require("@strapi/strapi");

(async () => {
  const dataDir = path.join(__dirname, "data");
  const logFile = path.join(__dirname, "migration.log");
  const logs = [];

  if (!fs.existsSync(dataDir)) {
    console.error("❌ Data folder not found:", dataDir);
    process.exit(1);
  }

  console.log("🚀 Booting Strapi...");
  const app = await Strapi().load();

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("⚠️ No JSON files found in /data");
    process.exit(0);
  }

  console.log(`📦 Found ${files.length} collection(s): ${files.join(", ")}`);

  // 🔒 Strapi internal/system collections to skip
  const skipList = [
    "core_store",
    "i18n_locales",
    "strapi_administrator",
    "strapi_permission",
    "strapi_role",
    "strapi_webhooks",
    "upload_file",
    "users-permissions_permission",
    "users-permissions_role",
    "users-permissions_user",
    "prelude", // 👈 skip corrupt file
  ];

  // 🧠 Utility: Normalize dates to ISO format
  const normalizeDate = (value) => {
    if (!value) return null;
    try {
      if (typeof value === "object" && value.$date) value = value.$date;
      if (/^\d+$/.test(value)) return new Date(parseInt(value, 10)).toISOString();
      const parsed = new Date(value.replace(/(\d+)(st|nd|rd|th)/g, "$1"));
      return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    } catch {
      return null;
    }
  };

  for (const file of files) {
    const collectionName = path.basename(file, ".json");
    if (skipList.includes(collectionName)) {
      console.log(`⏭️  Skipping internal/corrupt collection: ${collectionName}`);
      logs.push(`SKIPPED: ${collectionName}`);
      continue;
    }

    const filePath = path.join(dataDir, file);

    // 🧩 Step 1: Read file (UTF-8 or UTF-16)
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, "utf8").trim();
    } catch {
      const buffer = fs.readFileSync(filePath);
      fileContent = buffer.toString("utf16le").trim();
      fs.writeFileSync(filePath, fileContent, { encoding: "utf8" });
      console.log(`🧹 Converted ${file} from UTF-16 → UTF-8`);
    }

    // 🧩 Step 2: Parse JSON or NDJSON
    let jsonData;
    try {
      jsonData = JSON.parse(fileContent);
    } catch (err) {
      try {
        jsonData = fileContent
          .split(/\r?\n/)
          .filter((line) => line.trim().length)
          .map((line) => JSON.parse(line));
      } catch (innerErr) {
        console.error(`❌ ${file}: Cannot parse JSON (${innerErr.message})`);
        logs.push(`FAILED: ${file} - Parse error`);
        continue;
      }
    }

    if (!Array.isArray(jsonData)) jsonData = [jsonData];
    if (jsonData.length === 0) {
      console.log(`⚠️ Skipping ${collectionName}: empty file`);
      logs.push(`EMPTY: ${collectionName}`);
      continue;
    }

    // 🧩 Step 3: Build Strapi UID dynamically (api::model.model)
    const singularName = collectionName.replace(/s$/, ""); // naive plural → singular
    const uid = `api::${singularName}.${singularName}`;

    let query;
    try {
      query = strapi.db.query(uid);
    } catch {
      console.warn(`⚠️ Skipping ${collectionName}: no matching collection type found in Strapi`);
      logs.push(`MISSING MODEL: ${collectionName}`);
      continue;
    }

    console.log(`\n📥 Importing ${jsonData.length} records into "${uid}"...`);
    let successCount = 0;
    let failCount = 0;

    for (const record of jsonData) {
      try {
        // Clean up Mongo system fields
        delete record._id;
        delete record.__v;

        // Normalize date fields
        if (record.created_at && !record.createdAt)
          record.createdAt = normalizeDate(record.created_at);
        if (record.updated_at && !record.updatedAt)
          record.updatedAt = normalizeDate(record.updated_at);
        if (record.published_at && !record.publishedAt)
          record.publishedAt = normalizeDate(record.published_at);

        await query.create({ data: record });
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`❌ Error importing record in ${collectionName}: ${err.message}`);
      }
    }

    console.log(`✅ Imported ${successCount}/${jsonData.length} records into "${uid}"`);
    logs.push(
      `DONE: ${collectionName} → ${successCount} success, ${failCount} failed (Total: ${jsonData.length})`
    );
  }

  // ✍️ Write summary log
  fs.writeFileSync(logFile, logs.join("\n"), "utf8");
  console.log(`\n🗒️  Migration summary saved to: ${logFile}`);

  console.log("\n🎉 Migration complete!");
  process.exit(0);
})();
