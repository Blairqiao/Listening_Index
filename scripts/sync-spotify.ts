import dotenv from "dotenv";
// dotenv keeps the first value it sees, so .env.local goes first to win, as in Next.js.
dotenv.config({ path: ".env.local" });
dotenv.config();

import { syncSpotify } from "../src/lib/spotify-sync";

// Run script if executed directly
if (require.main === module) {
  syncSpotify()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { syncSpotify };
