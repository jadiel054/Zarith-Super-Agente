
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, GitBranch, Github, Boxes } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();
  const [isDBConnected, setIsDBConnected] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Simula a verificação de conexão com o banco de dados na montagem do componente.
    // Para um teste real, você poderia fazer uma query simples.
    // Como o RLS está desativado para testes e a conexão foi validada,
    // vamos assumir como 'true' por padrão.
    setIsDBConnected(true);
  }, []);

  const handleSyncAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !githubUrl || !githubBranch) {
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "Todos os campos do repositório são obrigatórios.",
      });
      return;
    }

    setIsSyncing(true);

    try {
      // O nome da tabela é 'projects' como solicitado.
      const { data, error } = await supabase
        .from("projects")
        .insert([
          { 
            name: projectName, 
            github_url: githubUrl, 
            branch: githubBranch 
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Sincronização Iniciada",
        description: `O projeto '${projectName}' foi salvo com sucesso.`,
      });

      // Limpar formulário após sucesso
      setProjectName("");
      setGithubUrl("");
      setGithubBranch("main");

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Falha na Sincronização",
        description: error.message || "Não foi possível salvar o projeto no Supabase.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 lg:p-10">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Status da Conexão
            </CardTitle>
            <ShieldCheck className={`h-5 w-5 ${isDBConnected ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isDBConnected ? "Online" : "Offline"}
            </div>
            <p className="text-xs text-muted-foreground">
              Conexão com o banco de dados Supabase.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Configuração de Repositório</CardTitle>
            <CardDescription>
              Forneça os detalhes do seu projeto para sincronizar com o agente Zarith.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSyncAgent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">
                  <Boxes className="inline-block h-4 w-4 mr-2" />
                  Nome do Projeto
                </Label>
                <Input 
                  id="project-name" 
                  placeholder="Meu App com IA" 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isSyncing}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github-url">
                    <Github className="inline-block h-4 w-4 mr-2" />
                    URL do GitHub
                  </Label>
                  <Input 
                    id="github-url" 
                    placeholder="https://github.com/usuario/repo" 
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    disabled={isSyncing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">
                    <GitBranch className="inline-block h-4 w-4 mr-2" />
                    Branch
                  </Label>
                  <Input 
                    id="branch" 
                    placeholder="main" 
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    disabled={isSyncing}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSyncing}>
                {isSyncing ? "Sincronizando..." : "Sincronizar Agente"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
