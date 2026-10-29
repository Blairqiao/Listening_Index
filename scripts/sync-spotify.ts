import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });

import { syncSpotify } from "../src/lib/spotify-sync";

// Run script if executed directly
if (require.main === module) {
  syncSpotify()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { syncSpotify };
