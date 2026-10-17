// OpenRecruitOS — Instance status (public, non-sensitive)
// Lets the UI detect a fresh deployment with zero accounts and offer
// first-run setup ("create your admin account") instead of a bare sign-in wall.

import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const users = await db.user.count();
    return json({
      users,
      firstRun: users === 0,
      signupOpen: users === 0 || process.env.ALLOW_SIGNUP === "true",
      demo: process.env.SEED_DEMO_DATA === "true" || (process.env.SEED_DEMO_DATA !== "false" && process.env.NODE_ENV !== "production"),
    });
  });
}
