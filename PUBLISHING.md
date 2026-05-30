# Publishing Hyperdrive Auditor

This bundle contains:

- `package/` — the npm package source for `@vantus/hyperdrive-auditor`.
- `vantus-hyperdrive-auditor-8.0.1.tgz` — the generated npm tarball from `npm pack`.

## Validate before publish

```bash
cd package
npm run syntax
node test/run-fixtures.mjs
node test/wrapper-smoke.mjs
node test/run-init-doctor.mjs
npm pack --dry-run
```

## Publish to private/restricted npm scope

```bash
cd package
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
npm install -D ./vantus-hyperdrive-auditor-8.0.1.tgz
npx hyperdrive-auditor init --ci github --sarif --budgets
npx hyperdrive-auditor doctor --root .
```
