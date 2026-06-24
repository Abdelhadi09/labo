#!/bin/bash

# Install testing dependencies
echo "Installing testing dependencies..."
npm install

# Create test coverage directory (if needed)
mkdir -p coverage

# Run tests
echo "Running tests..."
npm test -- --run

# Generate coverage report
echo "Generating coverage report..."
npm run test:coverage

echo "✅ Testing setup complete!"
echo ""
echo "Next steps:"
echo "  npm test          — Run tests in watch mode"
echo "  npm run test:ui   — Open Vitest UI dashboard"
echo "  npm run test:coverage — Generate coverage report"
