# Guia de Auto-Evolução Zarith

Este guia descreve como a Zarith deve invocar as novas funções de auto-evolução via **Function Calling**.

## 1. Ferramenta: `execute_code`
Use esta ferramenta para testar qualquer trecho de código antes de aplicá-lo ao sistema principal.

### Parâmetros:
- `code` (string): O código fonte completo a ser testado.
- `language` (string): "typescript", "javascript" ou "python".
- `reasoning` (string): Explicação do que está sendo validado.

### Exemplo de Invocação:
```json
{
  "name": "execute_code",
  "arguments": {
    "code": "console.log('Testando sandbox');",
    "language": "typescript",
    "reasoning": "Validando a saída do console no ambiente isolado."
  }
}
```

## 2. Ferramenta: `git_operation`
Use para gerenciar o ciclo de vida do código e repositórios externos.

### Parâmetros:
- `operation` (string): "clone", "branch" ou "push".
- `branchName` (string, opcional): Nome da branch para operações de branch/push.
- `commitMessage` (string, opcional): Mensagem descritiva para o commit.
- `url` (string, opcional): URL do repositório para clonagem.

### Exemplo de Invocação (Push):
```json
{
  "name": "git_operation",
  "arguments": {
    "operation": "push",
    "branchName": "feature/auto-evolution",
    "commitMessage": "feat: adicionando novos módulos de teste"
  }
}
```

## 3. Fluxo de Auto-Correção (Self-Healing)
O sistema de auto-correção é **automático**. Quando você usa `execute_code` e o código falha:
1. O backend captura o erro.
2. O erro é enviado de volta para você com uma instrução de "Refabricação".
3. Você deve corrigir o código e devolvê-lo.
4. O ciclo se repete por até 3 tentativas.

## 4. Relatórios Técnicos
Após cada execução bem-sucedida ou falha final no Sandbox, um relatório será gerado no formato Markdown, detalhando o sucesso, a saída do console e as tentativas realizadas.
