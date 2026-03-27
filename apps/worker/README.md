# apiref-worker

TypeDoc generation worker — generates `typedoc.json` from npm packages.

## Usage

```bash
apiref-generate <package-spec> [options]
```

### Arguments

- `<package-spec>` — Package name and version (e.g., `elysia@1.4.28`, `react`)

### Options

- `--out <file>` — Output file path (default: `typedoc.json`)
- `-h, --help` — Show help message

### Examples

```bash
# Generate from a specific version
apiref-generate elysia@1.4.28

# Generate with custom output file
apiref-generate react --out react-docs.json

# Generate latest version
apiref-generate lodash
```

## How It Works

1. Creates a temporary directory
2. Installs the package using `pnpm add --ignore-scripts`
3. Runs `typedoc --json` to generate the documentation JSON
4. Writes output to the specified file
5. Cleans up the temporary directory

## Requirements

- Node.js 24+
- `pnpm` (global or in PATH)
- `typedoc` (available via pnpm)

## Development

```bash
# Build
vp pack

# Watch mode
vp pack --watch

# Test
vp test

# Check (lint, format, type-check)
vp check
```
