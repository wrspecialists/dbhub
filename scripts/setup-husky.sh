#!/bin/bash

# This script is used to set up Husky for development
# It should be run manually, not as part of production builds

echo "Setting up Husky for the project..."
npx husky init

# Create the pre-commit hook
cat > .husky/pre-commit << 'EOL'
#!/usr/bin/env sh

# Run lint-staged to check only the files that are being committed
pnpm lint-staged

# Run the test suite to ensure everything passes
pnpm test
EOL

chmod +x .husky/pre-commit

echo "Husky setup complete!"