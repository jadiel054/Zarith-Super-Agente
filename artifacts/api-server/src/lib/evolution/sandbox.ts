import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const execAsync = promisify(exec);

export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number | null;
}

export class Sandbox {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), "temp_sandbox");
  }

  private async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Executa código em um ambiente isolado (atualmente via processo filho com restrições)
   * Nota: Em produção, isso deveria ser um container Docker.
   */
  async executeCode(code: string, language: "typescript" | "javascript" | "python" = "typescript"): Promise<SandboxResult> {
    await this.ensureTempDir();
    const id = uuidv4();
    const fileName = language === "python" ? `${id}.py` : `${id}.ts`;
    const filePath = path.join(this.tempDir, fileName);

    try {
      await fs.writeFile(filePath, code);

      let command = "";
      if (language === "python") {
        command = `python3 ${filePath}`;
      } else {
        // Para TS/JS, usamos ts-node ou node
        command = `npx ts-node ${filePath}`;
      }

      // Executa com timeout e sem acesso a variáveis de ambiente sensíveis
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 segundos
        env: { PATH: process.env.PATH }, // Apenas PATH básico
        maxBuffer: 1024 * 1024, // 1MB de log
      });

      return {
        success: true,
        output: stdout,
        error: stderr,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || "",
        error: error.stderr || error.message,
        exitCode: error.code || 1,
      };
    } finally {
      // Limpeza
      try {
        await fs.unlink(filePath);
      } catch {}
    }
  }
}
