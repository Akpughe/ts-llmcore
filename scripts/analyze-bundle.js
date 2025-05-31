#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the generated bundles for size optimization and potential issues
 */

const fs = require("fs");
const path = require("path");

function analyzeBundle() {
  console.log("🔍 Analyzing bundle...\n");

  const distPath = path.join(process.cwd(), "dist");

  if (!fs.existsSync(distPath)) {
    console.error("❌ Dist directory not found. Run build first.");
    process.exit(1);
  }

  const files = fs.readdirSync(distPath);
  const bundleFiles = files.filter(
    (file) =>
      file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".d.ts")
  );

  console.log("📦 Bundle Analysis Results:");
  console.log("=".repeat(50));

  let totalSize = 0;
  const fileSizes = [];

  bundleFiles.forEach((file) => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    fileSizes.push({ file, size: stats.size, sizeKB });
    totalSize += stats.size;

    console.log(`📄 ${file}: ${sizeKB} KB`);
  });

  console.log("=".repeat(50));
  console.log(`📊 Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);

  // Check for potential issues
  console.log("\n🔍 Optimization Analysis:");

  const jsFiles = fileSizes.filter(
    (f) => f.file.endsWith(".js") || f.file.endsWith(".mjs")
  );
  const largestJS = jsFiles.reduce(
    (max, file) => (file.size > max.size ? file : max),
    { size: 0 }
  );

  if (largestJS.size > 100 * 1024) {
    // 100KB
    console.log(
      `⚠️  Large bundle detected: ${largestJS.file} (${largestJS.sizeKB} KB)`
    );
    console.log("   Consider code splitting or removing unused dependencies");
  }

  // Check for redundant files
  const jsCount = jsFiles.length;
  if (jsCount > 2) {
    console.log(
      `⚠️  Multiple JS bundles found (${jsCount}). Expected: 2 (CJS + ESM)`
    );
  }

  // Check TypeScript declarations
  const dtsFiles = fileSizes.filter((f) => f.file.endsWith(".d.ts"));
  if (dtsFiles.length === 0) {
    console.log("❌ No TypeScript declarations found");
  } else if (dtsFiles.length > 2) {
    console.log(`⚠️  Multiple declaration files found (${dtsFiles.length})`);
  } else {
    console.log("✅ TypeScript declarations present");
  }

  // Bundle health check
  console.log("\n📋 Bundle Health Check:");

  // Check if files exist and are not empty
  const requiredFiles = ["index.js", "index.mjs", "index.d.ts"];
  const missingFiles = requiredFiles.filter(
    (file) =>
      !bundleFiles.includes(file) ||
      fs.statSync(path.join(distPath, file)).size === 0
  );

  if (missingFiles.length === 0) {
    console.log("✅ All required bundle files present");
  } else {
    console.log(`❌ Missing or empty files: ${missingFiles.join(", ")}`);
  }

  // Size recommendations
  const maxRecommendedSize = 50 * 1024; // 50KB
  if (totalSize > maxRecommendedSize) {
    console.log(
      `📏 Bundle size (${(totalSize / 1024).toFixed(
        2
      )} KB) exceeds recommended 50 KB`
    );
    console.log("   Consider optimizing dependencies or enabling tree shaking");
  } else {
    console.log("✅ Bundle size within recommended limits");
  }

  console.log("\n✨ Bundle analysis complete!");
}

if (require.main === module) {
  analyzeBundle();
}

module.exports = { analyzeBundle };
