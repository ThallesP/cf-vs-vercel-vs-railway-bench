// Note: This whole file is vibe coded. I do not know how any of the formatting works. Blame Claude.

const tests = [
  {
    name: "next-js",
    cfUrl:
      "https://next-cf-bench.theo-s-cool-new-test-account-10-3.workers.dev/bench",
    vercelUrl: "https://vercel-ssr-bench-v2-h.vercel.app/bench",
  },
  {
    name: "react-ssr-bench",
    cfUrl:
      "https://react-ssr-cf.theo-s-cool-new-test-account-10-3.workers.dev/bench",
    vercelUrl: "https://react-ssr-bench-v2-h.vercel.app/api/bench",
  },
  {
    name: "sveltekit",
    cfUrl:
      "https://cf-sveltekit-bench.theo-s-cool-new-test-account-10-3.workers.dev/",
    vercelUrl: "https://vercel-svelte-bench-h.vercel.app",
  },
  // {
  //   name: "shitty-sine-bench",
  //   cfUrl:
  //     "https://vanilla-ssr-cf.theo-s-cool-new-test-account-10-3.workers.dev/shitty-sine-bench",
  //   vercelUrl: "https://vanilla-bench-v2-h.vercel.app/api/shitty-sine-bench",
  // },
  {
    name: "realistic-math-bench",
    cfUrl:
      "https://vanilla-ssr-cf.theo-s-cool-new-test-account-10-3.workers.dev/realistic-math-bench",
    vercelUrl: "https://vanilla-bench-v2-h.vercel.app/api/realistic-math-bench",
  },
  {
    name: "vanilla-slower",
    cfUrl:
      "https://vanilla-ssr-cf.theo-s-cool-new-test-account-10-3.workers.dev/slower-bench",
    vercelUrl: "https://vanilla-bench-v2-h.vercel.app/api/slower-bench",
  },
];

const fs = require("fs");
const path = require("path");

const ITERATIONS = 100;
const CONCURRENCY = 10;

async function measureResponseTime(url) {
  const start = performance.now();
  try {
    const response = await fetch(url);
    const end = performance.now();

    // Read the response body
    const content = await response.text();
    const responseTime = end - start;

    return {
      time: responseTime,
      status: response.status,
      success: response.ok,
      content,
    };
  } catch (error) {
    return {
      time: null,
      status: null,
      success: false,
      error: error.message,
    };
  }
}

async function runBenchmark(url, name) {
  console.log(`\n🏃 Running benchmark for ${name}...`);
  console.log(`URL: ${url}`);
  console.log(`Iterations: ${ITERATIONS} (concurrency: ${CONCURRENCY})\n`);

  const results = [];
  let completed = 0;
  let nextIndex = 0;

  // Spawn a fixed number of workers; each pulls the next index until done
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= ITERATIONS) break;
      const result = await measureResponseTime(url);
      results.push(result);
      completed++;
      process.stdout.write(`  Progress: ${completed}/${ITERATIONS}\r`);
    }
  }

  const workerCount = Math.min(CONCURRENCY, ITERATIONS);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  console.log(`\n`);

  // Analyze results
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const times = successful.map((r) => r.time);

  // Count status codes
  const statusCodes = {};
  results.forEach((r) => {
    if (r.status !== null) {
      statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
    }
  });

  // Count error types
  const errors = {};
  failed.forEach((r) => {
    if (r.error) {
      errors[r.error] = (errors[r.error] || 0) + 1;
    }
  });

  const failureRate = (failed.length / results.length) * 100;

  if (times.length === 0) {
    console.log(`❌ No successful requests for ${name}`);
    console.log(`   Failure rate: ${failureRate.toFixed(2)}%`);
    if (Object.keys(statusCodes).length > 0) {
      console.log(`   Status codes:`, statusCodes);
    }
    if (Object.keys(errors).length > 0) {
      console.log(`   Errors:`, errors);
    }
    return null;
  }

  const min = Math.min(...times);
  const max = Math.max(...times);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;

  return {
    min,
    max,
    mean,
    successful: successful.length,
    failed: failed.length,
    failureRate,
    statusCodes,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    times,
  };
}

function formatTime(ms) {
  return `${(ms / 1000).toFixed(3)}s`;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  SSR Performance Benchmark: Cloudflare vs Vercel");
  console.log("=".repeat(60));

  const allResults = [];

  for (const test of tests) {
    console.log("\n" + "-".repeat(60));
    console.log(`Test: ${test.name}`);
    console.log("-".repeat(60));

    const cfResults = await runBenchmark(
      test.cfUrl,
      `${test.name} - Cloudflare`
    );
    const vercelResults = await runBenchmark(
      test.vercelUrl,
      `${test.name} - Vercel`
    );

    console.log("=".repeat(60));
    console.log(`  RESULTS (${test.name})`);
    console.log("=".repeat(60));

    if (cfResults) {
      console.log("\n📊 Cloudflare Results:");
      console.log(
        `  Successful requests: ${cfResults.successful}/${ITERATIONS}`
      );
      if (cfResults.failed > 0) {
        console.log(`  Failed requests: ${cfResults.failed}/${ITERATIONS}`);
        console.log(`  Failure rate: ${cfResults.failureRate.toFixed(2)}%`);
        console.log(`  Status codes:`, cfResults.statusCodes);
        if (cfResults.errors) {
          console.log(`  Errors:`, cfResults.errors);
        }
      }
      console.log(`  Min:  ${formatTime(cfResults.min)}`);
      console.log(`  Max:  ${formatTime(cfResults.max)}`);
      console.log(`  Mean: ${formatTime(cfResults.mean)}`);
    }

    if (vercelResults) {
      console.log("\n📊 Vercel Results:");
      console.log(
        `  Successful requests: ${vercelResults.successful}/${ITERATIONS}`
      );
      if (vercelResults.failed > 0) {
        console.log(`  Failed requests: ${vercelResults.failed}/${ITERATIONS}`);
        console.log(`  Failure rate: ${vercelResults.failureRate.toFixed(2)}%`);
        console.log(`  Status codes:`, vercelResults.statusCodes);
        if (vercelResults.errors) {
          console.log(`  Errors:`, vercelResults.errors);
        }
      }
      console.log(`  Min:  ${formatTime(vercelResults.min)}`);
      console.log(`  Max:  ${formatTime(vercelResults.max)}`);
      console.log(`  Mean: ${formatTime(vercelResults.mean)}`);
    }

    if (cfResults && vercelResults) {
      console.log("\n📈 Comparison:");
      const ratio = cfResults.mean / vercelResults.mean;
      if (ratio > 1) {
        console.log(
          `  Vercel is ${ratio.toFixed(2)}x faster than Cloudflare (by mean)`
        );
      } else {
        console.log(
          `  Cloudflare is ${(1 / ratio).toFixed(
            2
          )}x faster than Vercel (by mean)`
        );
      }
    }

    allResults.push({
      name: test.name,
      urls: { cloudflare: test.cfUrl, vercel: test.vercelUrl },
      results: { cloudflare: cfResults, vercel: vercelResults },
    });
  }

  console.log("\n" + "=".repeat(60));

  // Output final results summary for README
  console.log("\n\n" + "=".repeat(60));
  console.log("  FINAL RESULTS SUMMARY");
  console.log("=".repeat(60) + "\n");

  for (const result of allResults) {
    const cf = result.results.cloudflare;
    const vercel = result.results.vercel;

    console.log(`## ${result.name}`);
    console.log();

    if (cf && vercel) {
      const ratio = vercel.mean / cf.mean;
      const winner = ratio > 1 ? "Cloudflare" : "Vercel";
      const speedup = ratio > 1 ? ratio : 1 / ratio;

      const cfVariability = cf.max - cf.min;
      const vercelVariability = vercel.max - vercel.min;

      console.log(`| Platform   | Mean | Min | Max | Variability |`);
      console.log(`|------------|------|-----|-----|-------------|`);
      console.log(
        `| Cloudflare | ${formatTime(cf.mean)} | ${formatTime(cf.min)} | ${formatTime(cf.max)} | ${formatTime(cfVariability)} |`
      );
      console.log(
        `| Vercel     | ${formatTime(vercel.mean)} | ${formatTime(vercel.min)} | ${formatTime(vercel.max)} | ${formatTime(vercelVariability)} |`
      );
      console.log();
      console.log(`**Winner:** ${winner} (${speedup.toFixed(2)}x faster)`);
      console.log();
    }
  }

  console.log("---");
  console.log(
    `\n*Benchmark run: ${new Date().toISOString().split("T")[0]} • ${ITERATIONS} iterations • Concurrency: ${CONCURRENCY}*`
  );
  console.log("\n" + "=".repeat(60) + "\n");

  // Write consolidated results to results-(datetime).json inside results/ directory
  try {
    const resultsDir = path.resolve(__dirname, "results");
    await fs.promises.mkdir(resultsDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const safeStamp = timestamp.replace(/[:.]/g, "-");
    const filePath = path.join(resultsDir, `results-${safeStamp}.json`);

    const summary = {
      timestamp,
      iterations: ITERATIONS,
      concurrency: CONCURRENCY,
      tests: allResults,
    };

    await fs.promises.writeFile(
      filePath,
      JSON.stringify(summary, null, 2),
      "utf8"
    );
    console.log(`📝 Results written to: ${filePath}`);
  } catch (err) {
    console.error("Failed to write results file:", err.message);
  }
}

main().catch(console.error);
