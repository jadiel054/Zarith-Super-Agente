# Aegis integration (Zarith)

Mission control: https://aegis-control-sand.vercel.app

## Heartbeat

- GitHub Action `.github/workflows/aegis-heartbeat.yml` pings Aegis every 2 minutes as **Zarith**.
- SDK: `lib/aegis-agent-sdk.ts` — use `createAegisAgentFromEnv().start()` in long-lived processes.

## Env

```
AEGIS_BASE_URL=https://aegis-control-sand.vercel.app
AEGIS_AGENT_NAME=Zarith
```

## Queue (later)

Write-gate, GGUF, MCP write — coordinated via Aegis commands + Plutão worker.
