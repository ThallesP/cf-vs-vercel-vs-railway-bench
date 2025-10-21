// Note: This whole file is vibe coded. I do not know how any of the formatting works. Blame Claude.

const tests = [
	{
		name: "next-js",
		cfUrl:
			"https://next-cf-bench.theo-s-cool-new-test-account-10-3.workers.dev/bench",
		vercelUrl: "https://next-bench-beryl.vercel.app/bench",
		railwayUrl: "https://next-bench-railway-edition.up.railway.app/bench",
		// railwayUrl: "https://next-bench-railway-edition-bun.up.railway.app/bench", // bun
	},
	{
		name: "react-ssr-bench",
		cfUrl:
			"https://react-ssr-cf.theo-s-cool-new-test-account-10-3.workers.dev/bench",
		vercelUrl: "https://react-ssr-bench.vercel.app/api/bench",
		railwayUrl: "https://react-ssr-bench-railway-edition.up.railway.app/bench",
		// railwayUrl: "https://react-ssr-bench-railway-edition-bun.up.railway.app/bench", //bun
	},
	{
		name: "sveltekit",
		cfUrl:
			"https://cf-sveltekit-bench.theo-s-cool-new-test-account-10-3.workers.dev/",
		vercelUrl: "https://sveltekit-bench.vercel.app/",
		railwayUrl: "https://sveltekit-bench-railway-edition.up.railway.app/",
		// railwayUrl: "https://sveltekit-bench-railway-edition-bun.up.railway.app/", //bun
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
		vercelUrl: "https://vanilla-bench-six.vercel.app/api/realistic-math-bench",
		railwayUrl:
			"https://vanilla-bench-railway-edition.up.railway.app/realistic-math-bench",
		// railwayUrl:
		// "https://vanilla-bench-railway-edition-bun.up.railway.app/realistic-math-bench", // bun
	},
	{
		name: "vanilla-slower",
		cfUrl:
			"https://vanilla-ssr-cf.theo-s-cool-new-test-account-10-3.workers.dev/slower-bench",
		vercelUrl: "https://vanilla-bench-six.vercel.app/api/slower-bench",
		railwayUrl:
			"https://vanilla-bench-railway-edition.up.railway.app/slower-bench",
		// railwayUrl:
		// "https://vanilla-bench-railway-edition-bun.up.railway.app/slower-bench", // bun
	},
];

const fs = require("fs");
const path = require("path");

const ITERATIONS = 400;
const CONCURRENCY = 20;

async function measureResponseTime(url) {
	const start = performance.now();
	try {
		const response = await fetch(url);

		// Read the response body
		const content = await response.text();
		const end = performance.now();
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

async function runBenchmark(url, name, outputDir, timestamp) {
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

			// Save content to output directory
			if (result.success && result.content) {
				const safeName = name.replace(/[^a-zA-Z0-9-]/g, "_");
				const contentPath = path.join(
					outputDir,
					`${timestamp}-${safeName}-${i}.html`,
				);
				await fs.promises
					.writeFile(contentPath, result.content, "utf8")
					.catch((err) => {
						console.error(`Failed to write content file: ${err.message}`);
					});
			}

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
	// Setup output directory and timestamp
	const timestamp = new Date().toISOString();
	const safeStamp = timestamp.replace(/[:.]/g, "-");
	const outputDir = path.resolve(__dirname, "out");
	await fs.promises.mkdir(outputDir, { recursive: true });

	// Array to capture formatted output (only for summary)
	const formattedOutput = [];

	console.log("=".repeat(60));
	console.log("  SSR Performance Benchmark: Cloudflare vs Vercel vs Railway");
	console.log("=".repeat(60));

	const allResults = [];

	for (const test of tests) {
		const sectionHeader = `\n${"-".repeat(60)}\nTest: ${test.name}\n${"-".repeat(60)}`;
		console.log(sectionHeader);

		const cfResults = await runBenchmark(
			test.cfUrl,
			`${test.name} - Cloudflare`,
			outputDir,
			`${safeStamp}-cf`,
		);
		const vercelResults = await runBenchmark(
			test.vercelUrl,
			`${test.name} - Vercel`,
			outputDir,
			`${safeStamp}-vercel`,
		);
		const railwayResults = await runBenchmark(
			test.railwayUrl,
			`${test.name} - Railway`,
			outputDir,
			`${safeStamp}-railway`,
		);

		const resultsHeader = `${"=".repeat(60)}\n  RESULTS (${test.name})\n${"=".repeat(60)}`;
		console.log(resultsHeader);

		if (cfResults) {
			const cfOutput = [
				"\n📊 Cloudflare Results:",
				`  Successful requests: ${cfResults.successful}/${ITERATIONS}`,
			];
			if (cfResults.failed > 0) {
				cfOutput.push(`  Failed requests: ${cfResults.failed}/${ITERATIONS}`);
				cfOutput.push(`  Failure rate: ${cfResults.failureRate.toFixed(2)}%`);
				cfOutput.push(
					`  Status codes: ${JSON.stringify(cfResults.statusCodes)}`,
				);
				if (cfResults.errors) {
					cfOutput.push(`  Errors: ${JSON.stringify(cfResults.errors)}`);
				}
			}
			cfOutput.push(`  Min:  ${formatTime(cfResults.min)}`);
			cfOutput.push(`  Max:  ${formatTime(cfResults.max)}`);
			cfOutput.push(`  Mean: ${formatTime(cfResults.mean)}`);

			cfOutput.forEach((line) => {
				console.log(line);
			});
		}

		if (vercelResults) {
			const vercelOutput = [
				"\n📊 Vercel Results:",
				`  Successful requests: ${vercelResults.successful}/${ITERATIONS}`,
			];
			if (vercelResults.failed > 0) {
				vercelOutput.push(
					`  Failed requests: ${vercelResults.failed}/${ITERATIONS}`,
				);
				vercelOutput.push(
					`  Failure rate: ${vercelResults.failureRate.toFixed(2)}%`,
				);
				vercelOutput.push(
					`  Status codes: ${JSON.stringify(vercelResults.statusCodes)}`,
				);
				if (vercelResults.errors) {
					vercelOutput.push(
						`  Errors: ${JSON.stringify(vercelResults.errors)}`,
					);
				}
			}
			vercelOutput.push(`  Min:  ${formatTime(vercelResults.min)}`);
			vercelOutput.push(`  Max:  ${formatTime(vercelResults.max)}`);
			vercelOutput.push(`  Mean: ${formatTime(vercelResults.mean)}`);

			vercelOutput.forEach((line) => {
				console.log(line);
			});
		}

		if (railwayResults) {
			const railwayOutput = [
				"\n📊 Railway Results:",
				`  Successful requests: ${railwayResults.successful}/${ITERATIONS}`,
			];
			if (railwayResults.failed > 0) {
				railwayOutput.push(
					`  Failed requests: ${railwayResults.failed}/${ITERATIONS}`,
				);
				railwayOutput.push(
					`  Failure rate: ${railwayResults.failureRate.toFixed(2)}%`,
				);
				railwayOutput.push(
					`  Status codes: ${JSON.stringify(railwayResults.statusCodes)}`,
				);
				if (railwayResults.errors) {
					railwayOutput.push(
						`  Errors: ${JSON.stringify(railwayResults.errors)}`,
					);
				}
			}
			railwayOutput.push(`  Min:  ${formatTime(railwayResults.min)}`);
			railwayOutput.push(`  Max:  ${formatTime(railwayResults.max)}`);
			railwayOutput.push(`  Mean: ${formatTime(railwayResults.mean)}`);

			railwayOutput.forEach((line) => {
				console.log(line);
			});
		}

		if (cfResults && vercelResults && railwayResults) {
			const comparisonOutput = ["\n📈 Comparison & Rankings:"];

			// Create array of platforms with their mean times
			const platforms = [
				{ name: "Cloudflare", mean: cfResults.mean },
				{ name: "Vercel", mean: vercelResults.mean },
				{ name: "Railway", mean: railwayResults.mean },
			].sort((a, b) => a.mean - b.mean);

			// Display rankings
			comparisonOutput.push(
				`  🥇 First Place:  ${platforms[0].name} (${formatTime(platforms[0].mean)})`,
			);
			comparisonOutput.push(
				`  🥈 Second Place: ${platforms[1].name} (${formatTime(platforms[1].mean)})`,
			);
			comparisonOutput.push(
				`  🥉 Third Place:  ${platforms[2].name} (${formatTime(platforms[2].mean)})`,
			);
			comparisonOutput.push(``);
			comparisonOutput.push(
				`  🏆 Winner: ${platforms[0].name} - ${(platforms[1].mean / platforms[0].mean).toFixed(2)}x faster than second place`,
			);

			comparisonOutput.forEach((line) => {
				console.log(line);
			});
		}

		allResults.push({
			name: test.name,
			urls: {
				cloudflare: test.cfUrl,
				vercel: test.vercelUrl,
				railway: test.railwayUrl,
			},
			results: {
				cloudflare: cfResults,
				vercel: vercelResults,
				railway: railwayResults,
			},
		});
	}

	const separator = "\n" + "=".repeat(60);
	console.log(separator);

	// Output final results summary for README
	const summaryHeader = [
		"=".repeat(60),
		"  FINAL RESULTS SUMMARY",
		"=".repeat(60) + "\n",
	];
	summaryHeader.forEach((line) => {
		console.log(line);
		formattedOutput.push(line);
	});

	for (const result of allResults) {
		const cf = result.results.cloudflare;
		const vercel = result.results.vercel;
		const railway = result.results.railway;

		const testHeader = `## ${result.name}`;
		console.log(testHeader);
		console.log();
		formattedOutput.push(testHeader);
		formattedOutput.push("");

		if (cf && vercel && railway) {
			// Create array of platforms with their stats
			const platforms = [
				{
					name: "Cloudflare",
					mean: cf.mean,
					min: cf.min,
					max: cf.max,
					variability: cf.max - cf.min,
				},
				{
					name: "Vercel",
					mean: vercel.mean,
					min: vercel.min,
					max: vercel.max,
					variability: vercel.max - vercel.min,
				},
				{
					name: "Railway",
					mean: railway.mean,
					min: railway.min,
					max: railway.max,
					variability: railway.max - railway.min,
				},
			].sort((a, b) => a.mean - b.mean);

			const tableOutput = [
				`| Platform   | Mean | Min | Max | Variability |`,
				`|------------|------|-----|-----|-------------|`,
				`| Cloudflare | ${formatTime(cf.mean)} | ${formatTime(cf.min)} | ${formatTime(cf.max)} | ${formatTime(cf.max - cf.min)} |`,
				`| Vercel     | ${formatTime(vercel.mean)} | ${formatTime(vercel.min)} | ${formatTime(vercel.max)} | ${formatTime(vercel.max - vercel.min)} |`,
				`| Railway    | ${formatTime(railway.mean)} | ${formatTime(railway.min)} | ${formatTime(railway.max)} | ${formatTime(railway.max - railway.min)} |`,
				"",
				`**🥇 First Place:** ${platforms[0].name} (${formatTime(platforms[0].mean)})`,
				`**🥈 Second Place:** ${platforms[1].name} (${formatTime(platforms[1].mean)})`,
				`**🥉 Third Place:** ${platforms[2].name} (${formatTime(platforms[2].mean)})`,
				"",
				`**🏆 Winner:** ${platforms[0].name} - ${(platforms[1].mean / platforms[0].mean).toFixed(2)}x faster than second place`,
				"",
			];

			tableOutput.forEach((line) => {
				console.log(line);
				formattedOutput.push(line);
			});
		}
	}

	const footer = [
		"---",
		`\n*Benchmark run: ${new Date().toISOString().split("T")[0]} • ${ITERATIONS} iterations • Concurrency: ${CONCURRENCY}*`,
		"\n" + "=".repeat(60) + "\n",
	];
	footer.forEach((line) => {
		console.log(line);
		formattedOutput.push(line);
	});

	// Write formatted results to text file
	try {
		const resultsDir = path.resolve(__dirname, "results");
		await fs.promises.mkdir(resultsDir, { recursive: true });

		const textFilePath = path.join(resultsDir, `results-${safeStamp}.txt`);
		await fs.promises.writeFile(
			textFilePath,
			formattedOutput.join("\n"),
			"utf8",
		);
		console.log(`📝 Formatted results written to: ${textFilePath}`);
	} catch (err) {
		console.error("Failed to write formatted results file:", err.message);
	}

	// Write consolidated results to results-(datetime).json inside results/ directory
	try {
		const resultsDir = path.resolve(__dirname, "results");
		const jsonFilePath = path.join(resultsDir, `results-${safeStamp}.json`);

		const summary = {
			timestamp,
			iterations: ITERATIONS,
			concurrency: CONCURRENCY,
			tests: allResults,
		};

		await fs.promises.writeFile(
			jsonFilePath,
			JSON.stringify(summary, null, 2),
			"utf8",
		);
		console.log(`📝 JSON results written to: ${jsonFilePath}`);
	} catch (err) {
		console.error("Failed to write JSON results file:", err.message);
	}

	console.log(`📁 Response content written to: ${outputDir}/`);
}

main().catch(console.error);
