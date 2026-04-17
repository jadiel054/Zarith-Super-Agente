# Variáveis de Ambiente para Zarith Elite na Vercel

## ⚠️ IMPORTANTE: Copie EXATAMENTE estas variáveis para o painel da Vercel

### 1. AI Models (OBRIGATÓRIO: pelo menos GEMINI_API_KEY)

```
GEMINI_API_KEY=<sua-chave-gemini-2.5-flash>
ANTHROPIC_API_KEY=<sua-chave-claude-3.5>
OPENAI_API_KEY=<sua-chave-gpt-4o>
```

### 2. Voice & TTS (Opcional, mas recomendado)

```
ELEVENLABS_API_KEY=<sua-chave-elevenlabs>
ELEVENLABS_VOICE_ID=<seu-voice-id-elevenlabs>
```

### 3. GitHub Integration (OBRIGATÓRIO para auto-coding)

```
GITHUB_TOKEN=<seu-github-personal-access-token>
```

### 4. Database (OBRIGATÓRIO)

```
SUPABASE_URL=<sua-url-supabase>
SUPABASE_ANON_KEY=<sua-chave-anonima-supabase>
```

### 5. Configurações de Ambiente

```
NODE_ENV=production
LOG_LEVEL=info
```

---

## 📋 Checklist de Configuração na Vercel

1. **Painel da Vercel** → Seu projeto Zarith
2. **Settings** → **Environment Variables**
3. Copie e cole TODAS as variáveis acima (apenas as que você tem valores)
4. **Redeploy** o projeto
5. Aguarde o build completar

---

## 🔍 Verificação de Deploy

Após o deploy:
- Acesse `https://seu-dominio-vercel.vercel.app/login`
- Você deve ver a tela de login (não erro 404)
- Após o login, o dashboard deve carregar corretamente

Se ainda receber erro 404 na rota `/login`:
- Verifique se o `vercel.json` está na raiz do repositório
- Certifique-se de que o rewrite aponta para `/index.html`

---

## 🚀 Notas Importantes

- **API Backend**: Em produção, o api-server não está separado. O frontend chama `/api/*` no mesmo domínio.
- **CORS**: Já configurado no api-server para aceitar requisições do frontend.
- **Base URL**: O frontend detecta automaticamente o domínio em produção via `window.location.origin`.
