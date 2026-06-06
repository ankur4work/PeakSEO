import { PrismaClient } from "@prisma/client";

// Removes legacy non-expiring offline tokens that Shopify now rejects.
// New token-exchange sessions always have an `expires` value, so this only
// deletes the poisoned legacy rows and is safe to run on every startup.
const prisma = new PrismaClient();

try {
  const result = await prisma.session.deleteMany({ where: { expires: null } });
  console.log(`[startup] Cleared ${result.count} stale non-expiring session(s)`);
} catch (err) {
  console.error("[startup] Failed to clear stale sessions:", err.message);
} finally {
  await prisma.$disconnect();
}
