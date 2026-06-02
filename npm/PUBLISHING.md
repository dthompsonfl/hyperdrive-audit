# Publishing Hyperdrive Auditor

This repository archive contains the complete npm package source for `@vantus/hyperdrive-auditor` and a pre-packed tarball under `npm/`.

## Validate before publish

```bash
npm run syntax
npm test
npm run check
npm pack --dry-run
```

## Publish to private/restricted npm scope

```bash
npm publish --access restricted
```

## Publish publicly

Change `package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

Then run:

```bash
npm publish --access public
```

## Install in a repo after publishing

```bash
npm install -D @vantus/hyperdrive-auditor
npx hyperdrive-auditor init --preset next-turbo-prisma --ci github --sarif --budgets
npm run audit:performance:ci
npx hyperdrive-auditor doctor --root .
```

## Install from the packed tarball for testing

```bash
npm install -D ./npm/vantus-hyperdrive-auditor-8.0.4.tgz
npx hyperdrive-auditor init --ci github --sarif --budgets
npx hyperdrive-auditor doctor --root .
```

## Install from a cloned repo tarball

If you are installing from a tarball path, the path must start with `./` or be absolute.

Correct from the host repo root:

```bash
npm install -D ./hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz
```

Correct if using the tarball under this repo's `npm/` directory:

```bash
npm install -D ./hyperdrive-audit/npm/vantus-hyperdrive-auditor-8.0.4.tgz
```

Incorrect:

```bash
npm install hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz
```

Without `./`, npm can treat `hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz` as a GitHub shorthand dependency and attempt to fetch `git@github.com:hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz.git`.
