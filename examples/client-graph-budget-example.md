# Client graph budget output

Run:

```bash
hyperdrive-auditor --root . --profile ci --budget-output hyperdrive-budget.json
```

The report lists each `'use client'` entrypoint with:

- reachable runtime module count
- estimated reachable source line count
- external packages reached by the client graph
- known heavy packages reached by the client graph
- server-tainted modules that accidentally became client-reachable

Use this as a triage input before running a full bundle analyzer. It is static and fast; it does not replace production bundle measurement.
