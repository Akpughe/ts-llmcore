#!/usr/bin/env node

/**
 * Package Validation Script
 * Validates the package configuration and build outputs for publishing
 */

const fs = require("fs");
const path = require("path");

function validatePackage() {
  console.log("🔍 Validating package...\n");

  const errors = [];
  const warnings = [];
  const packageJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    errors.push("package.json not found");
    return reportResults(errors, warnings);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  // Validate package.json structure
  console.log("📋 Validating package.json...");

  const requiredFields = [
    "name",
    "version",
    "description",
    "main",
    "types",
    "license",
  ];
  requiredFields.forEach((field) => {
    if (!packageJson[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate exports configuration
  if (!packageJson.exports || !packageJson.exports["."]) {
    errors.push("Missing exports configuration");
  } else {
    const exports = packageJson.exports["."];
    if (!exports.types || !exports.import || !exports.require) {
      errors.push("Incomplete exports configuration");
    }
  }

  // Validate build outputs
  console.log("📦 Validating build outputs...");

  const distPath = path.join(process.cwd(), "dist");
  if (!fs.existsSync(distPath)) {
    errors.push("dist directory not found - run build first");
  } else {
    const requiredFiles = [
      { file: "index.js", desc: "CommonJS bundle" },
      { file: "index.mjs", desc: "ES Module bundle" },
      { file: "index.d.ts", desc: "TypeScript declarations" },
    ];

    requiredFiles.forEach(({ file, desc }) => {
      const filePath = path.join(distPath, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing ${desc}: ${file}`);
      } else {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          errors.push(`Empty ${desc}: ${file}`);
        }
      }
    });
  }

  // Validate file paths in package.json
  console.log("🔗 Validating file paths...");

  const pathFields = [
    { field: "main", desc: "main entry point" },
    { field: "module", desc: "ES module entry point" },
    { field: "types", desc: "TypeScript declarations" },
  ];

  pathFields.forEach(({ field, desc }) => {
    if (packageJson[field]) {
      const filePath = path.join(process.cwd(), packageJson[field]);
      if (!fs.existsSync(filePath)) {
        errors.push(`${desc} file not found: ${packageJson[field]}`);
      }
    }
  });

  // Validate files array
  if (packageJson.files) {
    packageJson.files.forEach((filePattern) => {
      if (
        filePattern !== "dist" &&
        filePattern !== "README.md" &&
        filePattern !== "LICENSE"
      ) {
        const filePath = path.join(process.cwd(), filePattern);
        if (!fs.existsSync(filePath)) {
          warnings.push(`File listed in files array not found: ${filePattern}`);
        }
      }
    });
  } else {
    warnings.push("No files array specified - all files will be published");
  }

  // Validate dependencies
  console.log("📚 Validating dependencies...");

  if (packageJson.dependencies) {
    const deps = Object.keys(packageJson.dependencies);
    if (deps.length > 5) {
      warnings.push(
        `Large number of dependencies (${deps.length}) - consider reducing`
      );
    }
  }

  // Check for common issues
  console.log("⚠️  Checking for common issues...");

  if (packageJson.scripts && packageJson.scripts.prepublishOnly) {
    console.log("✅ prepublishOnly script found");
  } else {
    warnings.push(
      "No prepublishOnly script - consider adding build validation"
    );
  }

  if (packageJson.engines && packageJson.engines.node) {
    console.log("✅ Node.js version specified");
  } else {
    warnings.push("No Node.js version specified in engines");
  }

  if (packageJson.repository) {
    console.log("✅ Repository information present");
  } else {
    warnings.push("No repository information - recommended for npm");
  }

  // Validate README
  const readmePath = path.join(process.cwd(), "README.md");
  if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, "utf8");
    if (readmeContent.length < 500) {
      warnings.push(
        "README.md is quite short - consider expanding documentation"
      );
    }
    console.log("✅ README.md found");
  } else {
    warnings.push("README.md not found - highly recommended");
  }

  // Validate LICENSE
  const licensePath = path.join(process.cwd(), "LICENSE");
  if (fs.existsSync(licensePath)) {
    console.log("✅ LICENSE file found");
  } else {
    warnings.push(
      "LICENSE file not found - recommended for open source packages"
    );
  }

  reportResults(errors, warnings);
}

function reportResults(errors, warnings) {
  console.log("\n📊 Validation Results:");
  console.log("=".repeat(50));

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ Package validation passed! Ready for publishing.");
    return;
  }

  if (errors.length > 0) {
    console.log("\n❌ Errors (must fix before publishing):");
    errors.forEach((error) => console.log(`   • ${error}`));
  }

  if (warnings.length > 0) {
    console.log("\n⚠️  Warnings (recommended to fix):");
    warnings.forEach((warning) => console.log(`   • ${warning}`));
  }

  if (errors.length > 0) {
    console.log(
      "\n❌ Package validation failed. Please fix errors before publishing."
    );
    process.exit(1);
  } else {
    console.log(
      "\n⚠️  Package validation passed with warnings. Consider addressing them."
    );
  }
}

if (require.main === module) {
  validatePackage();
}

module.exports = { validatePackage };
