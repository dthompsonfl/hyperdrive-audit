# Installing Hyperdrive Auditor from a local tarball

When installing a tarball from a relative path, prefix the path with `./` or use an absolute path.

## Correct

```bash
npm install -D ./hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz
```

```bash
npm install -D /home/dylan/.webapp/hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz
```

## Incorrect

```bash
npm install hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz
```

Without `./`, npm may interpret `hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz` as a GitHub shorthand package spec and run a command like:

```bash
git ls-remote ssh://git@github.com/hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz.git
```

That produces a misleading Git permission error. The fix is to use `./` or an absolute path.

## Local workflow from your app repo

Assuming this repository is cloned at `/home/dylan/.webapp/hyperdrive-audit` and your app repo root is `/home/dylan/.webapp`:

```bash
cd /home/dylan/.webapp
npm install -D ./hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz
npx hyperdrive-auditor init --root . --ci github --sarif --budgets --yes
npx hyperdrive-auditor doctor --root .
npm run audit:performance:ci
```

If the tarball is inside the `npm/` folder instead:

```bash
npm install -D ./hyperdrive-audit/npm/vantus-hyperdrive-auditor-8.0.4.tgz
```
