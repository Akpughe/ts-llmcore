import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: process.env.NODE_ENV === "production",
  treeshake: true,
  target: "node16",
  outDir: "dist",
  bundle: true,
  external: [
    // Peer dependencies should be external
    "openai",
    "anthropic",
    "@groq/sdk",
  ],
  esbuildOptions(options) {
    // Better handling of exports
    options.platform = "node";
    options.format = undefined; // Let tsup handle format

    // Optimize for smaller bundles
    options.legalComments = "none";

    // Only drop console/debugger in production
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }
  },
  onSuccess: async () => {
    console.log("✅ Build completed successfully!");
  },
});
