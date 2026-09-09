import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local" });

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function updateEnvFile(filePath: string, key: string, value: string) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  }

  const lines = content.split("\n");
  let found = false;
  const newLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && match[1] === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    newLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, newLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", "utf-8");
}

async function main() {
  console.log("============================================================");
  console.log("            Cron Secret Key Generator                      ");
  console.log("============================================================\n");

  const existingSecret = process.env.CRON_SECRET;
  if (existingSecret && !process.argv.includes("--force")) {
    console.log("A CRON_SECRET is already configured in your environment:");
    console.log(`${existingSecret.slice(0, 8)}...${existingSecret.slice(-6)}\n`);
    const answer = await askQuestion("Do you want to generate and overwrite with a new secret? (y/N): ");
    if (answer.toLowerCase() !== "y") {
      console.log("\nKeeping existing secret. Exiting.");
      printInstructions(existingSecret);
      process.exit(0);
    }
  }

  const newSecret = crypto.randomBytes(32).toString("hex");
  const envLocalPath = path.resolve(process.cwd(), ".env.local");

  updateEnvFile(envLocalPath, "CRON_SECRET", newSecret);

  console.log("\n Generated new secure CRON_SECRET and saved to .env.local!\n");
  printInstructions(newSecret);
}

function printInstructions(secret: string) {
  console.log("------------------------------------------------------------");
  console.log("📋 1. Vercel Environment Variable (Add in Vercel Dashboard):");
  console.log(`   CRON_SECRET=${secret}`);
  console.log("------------------------------------------------------------");
  console.log("⏱️  2. cron-job.org Configuration (Free & High-Frequency):");
  console.log("   • URL:");
  console.log(`     https://<your-app>.vercel.app/api/sync?key=${secret}`);
  console.log("   • Schedule:");
  console.log("     Every 15 or 30 minutes");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
