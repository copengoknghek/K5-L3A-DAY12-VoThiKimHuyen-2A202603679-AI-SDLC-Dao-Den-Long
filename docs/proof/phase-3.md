# Bằng chứng Phase 3 (contract v1.2)

## Kiểm chứng tự động

```bash
npm ci && npm run build
npm test
```

Test liên quan Phase 3: `dawn_survived`, `lantern_out`, không thắng sớm khi all lit, snapshot v1.2 (`fuel`, `capacity`, `ever_lit`).

## Headless mẫu

```bash
node dist/src/headless/cli.js --seed 42 --night 1 --ticks 120 --out docs/proof/phase-3/sample.jsonl
```

## Tài liệu thiết kế

- ADR: [docs/notes/adr-phase3-fuel.md](../notes/adr-phase3-fuel.md)
- Breaking changes: [docs/notes/CHANGELOG-phase3.md](../notes/CHANGELOG-phase3.md)