import { Sandbox, SandboxResult } from "./sandbox";
import { EvolutionReporter } from "./reporter";
import { GitTools } from "./gitTools";

export interface EvolutionTask {
  code: string;
  language: "typescript" | "javascript" | "python";
  reasoning: string;
  path: string;
}

export class EvolutionEngine {
  private sandbox: Sandbox;
  private reporter: EvolutionReporter;
  private git: GitTools;
  private maxAttempts = 3;

  constructor() {
    this.sandbox = new Sandbox();
    this.reporter = new EvolutionReporter();
    this.git = new GitTools();
  }

  /**
   * Executa o loop de auto-correção (Self-Healing)
   */
  async runEvolution(
    task: EvolutionTask,
    aiCallback: (error: string, code: string, attempt: number) => Promise<string>
  ) {
    let currentCode = task.code;
    let attempts = 0;
    let lastResult: SandboxResult | null = null;

    while (attempts < this.maxAttempts) {
      attempts++;
      console.log(`[Evolution] Tentativa ${attempts}/${this.maxAttempts}`);
      
      lastResult = await this.sandbox.executeCode(currentCode, task.language);

      if (lastResult.success) {
        console.log("[Evolution] Sucesso na execução!");
        break;
      }

      console.log("[Evolution] Falha detectada. Iniciando auto-correção...");
      
      if (attempts < this.maxAttempts) {
        const errorContext = `Erro na execução:\n${lastResult.error}\nSaída:\n${lastResult.output}`;
        currentCode = await aiCallback(errorContext, currentCode, attempts);
      }
    }

    const report = this.reporter.generateTechnicalReport({
      operation: "Auto-Evolução de Código",
      reasoning: task.reasoning,
      changes: `Arquivo: ${task.path}\nLinguagem: ${task.language}`,
      testResult: {
        success: lastResult?.success || false,
        output: lastResult?.output || "",
        error: lastResult?.error,
      },
      attempts,
    });

    return {
      success: lastResult?.success || false,
      code: currentCode,
      report,
      attempts,
    };
  }

  async commitEvolution(path: string, code: string, message: string) {
    // Aqui integraríamos com GitTools para salvar as mudanças validadas
    return { success: true, message: "Simulação de commit concluída." };
  }
}
