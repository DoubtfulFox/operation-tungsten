import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

/** Dev-only: POST a data-URL to /__shot to save it as shots/<name>.jpg (for headless visual checks). */
function shotSaver(): Plugin {
  return {
    name: "shot-saver",
    configureServer(server) {
      server.middlewares.use("/__shot", (req, res) => {
        let body = "";
        req.on("data", (c: Buffer) => (body += c.toString()));
        req.on("end", () => {
          const name = (new URL(req.url ?? "/", "http://x").searchParams.get("name") ?? "shot").replace(/[^\w-]/g, "");
          const b64 = body.replace(/^data:image\/\w+;base64,/, "");
          const dir = path.resolve(__dirname, "shots");
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, name + ".jpg"), Buffer.from(b64, "base64"));
          res.end("saved " + name);
        });
      });
    }
  };
}

export default defineConfig({
  base: "./",
  server: { port: 5174 },
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  plugins: [shotSaver()]
});
