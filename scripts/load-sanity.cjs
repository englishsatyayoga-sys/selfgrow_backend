const autocannon = require('autocannon');

const targetHost = process.env.LOAD_TARGET_URL || 'http://localhost:5000';

async function runBenchmark(name, options) {
  console.log(`\n========================================`);
  console.log(`Starting Load Benchmark: ${name}`);
  console.log(`URL: ${options.url}`);
  console.log(`Duration: ${options.duration || 10}s, Connections: ${options.connections || 10}`);
  console.log(`========================================`);

  try {
    const result = await autocannon({
      duration: 5,
      connections: 10,
      pipelining: 1,
      ...options,
    });

    console.log(`\n--- Results for ${name} ---`);
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Throughput: ${result.requests.average.toFixed(1)} req/sec`);
    console.log(`Latency Average: ${result.latency.average} ms`);
    console.log(`Latency p50: ${result.latency.p50} ms`);
    console.log(`Latency p95: ${result.latency.p95} ms`);
    console.log(`Latency p99: ${result.latency.p99} ms`);
    console.log(`2xx Responses: ${result['2xx']}`);
    console.log(`Non-2xx Responses: ${result.non2xx}`);
    return result;
  } catch (err) {
    console.error(`Error running benchmark for ${name}:`, err.message);
    return null;
  }
}

async function main() {
  console.log(`Antigravity Assessment Platform - Reliability Load Sanity Test`);
  console.log(`Target: ${targetHost}\n`);

  // 1. Health / Liveness Endpoint
  await runBenchmark('Health Endpoint', {
    url: `${targetHost}/api/v1/health`,
    method: 'GET',
  });

  // 2. Auth Login Endpoint
  await runBenchmark('Auth Login (Rate-limited & Argon2 verification)', {
    url: `${targetHost}/api/v1/auth/login`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'AdminPassword123!',
    }),
  });

  // 3. Attempt Answers Save Endpoint
  await runBenchmark('Attempt Autosave Endpoint', {
    url: `${targetHost}/api/v1/attempts/00000000-0000-0000-0000-000000000000/answers`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      responses: [
        {
          questionId: 'q_test_1',
          selectedOptionIds: ['opt_1'],
          timeTakenMs: 1200,
        },
      ],
    }),
  });

  console.log('\n✓ Load sanity execution completed.');
}

if (require.main === module) {
  main();
}

