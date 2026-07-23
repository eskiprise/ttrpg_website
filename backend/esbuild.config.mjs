import { build } from "esbuild";

const entries = {
  api: "src/handlers/api.ts",
};

for (const [name, entry] of Object.entries(entries)) {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    outfile: `dist/${name}.js`,
    external: ["@aws-sdk/*"],
  });
}

console.log("Backend Lambda bundles built into dist/");
