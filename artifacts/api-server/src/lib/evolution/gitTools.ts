import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export class GitTools {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  private async runGit(command: string) {
    return execAsync(`git ${command}`, { cwd: this.repoPath });
  }

  async createBranch(branchName: string) {
    try {
      await this.runGit(`checkout -b ${branchName}`);
      return { success: true, message: `Branch ${branchName} criada.` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async commitAndPush(message: string, branch: string = "main") {
    try {
      await this.runGit("add .");
      await this.runGit(`commit -m "${message}"`);
      await this.runGit(`push origin ${branch}`);
      return { success: true, message: "Alterações enviadas para o GitHub." };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async clone(url: string, targetDir: string) {
    try {
      await execAsync(`git clone ${url} ${targetDir}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
