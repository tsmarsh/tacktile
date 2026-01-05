import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const watch = process.argv.includes("--watch");
const outDir = "dist";

async function bundle() {
  const result = await esbuild.build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    minify: !watch,
    write: false,
    format: "iife",
    target: "es2022",
  });

  const js = result.outputFiles[0].text;
  const html = fs.readFileSync("src/index.html", "utf-8");
  const output = html.replace("<!-- SCRIPT -->", `<script>${js}</script>`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), output);

  console.log(`Built ${outDir}/index.html`);
}

await bundle();

if (watch) {
  console.log("Watching for changes...");

  fs.watch("src", { recursive: true }, async (event, filename) => {
    if (filename?.match(/\.(ts|html|css)$/)) {
      try {
        await bundle();
      } catch (e) {
        console.error(e);
      }
    }
  });
}
