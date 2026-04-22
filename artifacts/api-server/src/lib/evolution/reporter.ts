export interface ReportData {
  operation: string;
  reasoning: string;
  changes: string;
  testResult: {
    success: boolean;
    output: string;
    error?: string;
  };
  attempts: number;
}

export class EvolutionReporter {
  generateTechnicalReport(data: ReportData): string {
    const status = data.testResult.success ? "✅ SUCESSO" : "❌ FALHA";
    const timestamp = new Date().toISOString();

    return `
# RELATÓRIO TÉCNICO DE AUTO-EVOLUÇÃO
**Data:** ${timestamp}
**Status Final:** ${status}
**Tentativas:** ${data.attempts}

## 1. Objetivo (Por que foi mudado)
${data.reasoning}

## 2. Alterações Realizadas (O que foi mudado)
${data.changes}

## 3. Resultado do Teste de Execução
\`\`\`
${data.testResult.output || "Sem saída de console."}
${data.testResult.error ? `\nERRO:\n${data.testResult.error}` : ""}
\`\`\`

---
*Relatório gerado automaticamente pelo Módulo de Auto-Evolução Zarith.*
    `.trim();
  }
}
