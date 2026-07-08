/**
 * Provisions a real, production Super Admin account.
 *
 * Run with:  npm run create:super-admin
 *
 * Unlike the demo seed (which creates predictable, publicly-documented
 * passwords for local development), this script interactively prompts
 * for a real email + a strong password, hashes it, and inserts a single
 * SUPER_ADMIN user — the platform owner who can then create Hotel Admins,
 * Managers, Receptionists, and Housekeeping staff through the app itself
 * (Team page) with each one scoped to a specific hotel.
 *
 * Safe to run multiple times: if the email already exists you'll be asked
 * whether to promote that account to SUPER_ADMIN and reset its password,
 * rather than silently creating a duplicate.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as readline from "readline";

const prisma = new PrismaClient();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

// Node has no built-in masked stdin without extra deps; this keeps the
// script dependency-free while still nudging people toward a strong password.
function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(pw)) return "Password must include at least one uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must include at least one lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must include at least one number";
  return null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  console.log("\n=== NovaStay HMS — Create a real Super Admin ===\n");

  let email = "";
  while (!validateEmail(email)) {
    email = await ask("Super Admin email: ");
    if (!validateEmail(email)) console.log("  ✗ That doesn't look like a valid email address.\n");
  }

  const firstName = (await ask("First name: ")) || "Super";
  const lastName = (await ask("Last name: ")) || "Admin";

  let password = "";
  while (true) {
    password = await ask("Password (min 10 chars, upper+lower+number): ");
    const err = validatePassword(password);
    if (!err) break;
    console.log(`  ✗ ${err}\n`);
  }
  const confirm = await ask("Confirm password: ");
  if (confirm !== password) {
    console.log("\n✗ Passwords did not match. Aborting — run the script again.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const proceed = await ask(
      `\nAn account with ${email} already exists (role: ${existing.role}). Promote it to SUPER_ADMIN and reset its password? (y/N): `
    );
    if (proceed.toLowerCase() !== "y") {
      console.log("Aborted. No changes made.");
      process.exit(0);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "SUPER_ADMIN",
        hotelId: null, // Super Admin is platform-level, not pinned to one hotel
        isActive: true,
        isEmailVerified: true,
        passwordHash,
      },
    });
    console.log(`\n✅ ${email} is now a Super Admin.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: "SUPER_ADMIN",
        hotelId: null,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`\n✅ Super Admin account created for ${email}.`);
  }

  console.log("\nYou can now log in and, from the Team page, create Hotel Admins and assign");
  console.log("them (and their staff) to specific hotels — each one will only ever see and");
  console.log("manage the property they're assigned to.\n");
}

main()
  .catch((e) => {
    console.error("\n✗ Failed to create Super Admin:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
