// Production bundle for the frontend.
//
// This replaces the previous `bun build ./src/index.html ...` CLI invocation.
// The CLI cannot load bundler plugins yet (see the note in Bun's fullstack
// docs), and Tailwind v4 is compiled by `bun-plugin-tailwind`. Driving the
// build through the `Bun.build()` JS API lets us register that plugin while
// keeping the exact same output options the CLI produced.
import tailwind from "bun-plugin-tailwind";

const result = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "linked",
  // Mirror `--env='BUN_PUBLIC_*'`: only inline build-time public env vars.
  env: "BUN_PUBLIC_*",
  plugins: [tailwind],
});

if (!result.success) {
  console.error("build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(`📦 build: ${result.outputs.length} files written to dist/`);
