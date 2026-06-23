// Timeout wrapper for external service calls
const withTimeout = (promise, ms, label) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

module.exports = { withTimeout };
