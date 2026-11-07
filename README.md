# CineBrasil — O Cinema é Nosso

Catálogo de cinema brasileiro com busca por título, ano e gênero, detalhes dos filmes, favoritos e interface responsiva.

## GitHub Pages

O workflow `.github/workflows/pages.yml` compila e publica o site a cada push em `main`. Em **Settings → Pages**, selecione **GitHub Actions** como origem.

A versão Pages usa um perfil local, sem senha ou conta online. Nome, catálogo editável e favoritos são salvos no armazenamento deste navegador. As alterações não são compartilhadas com outros visitantes ou dispositivos; limpar os dados do site remove as informações locais. O catálogo começa com quatro filmes e permite adicionar, editar e excluir filmes localmente. Não há reprodução de filmes: links de trailer podem ser adicionados no editor.

```bash
npm ci
VITE_STATIC_MODE=true npm run build
npm run preview
```

No PowerShell, configure `$env:VITE_STATIC_MODE="true"` antes do build.

## Servidor original (Node.js e MySQL)

O código original de servidor e os scripts de banco foram preservados em `server/` e `database/`. Esse modo oferece autenticação e dados compartilhados e precisa de hospedagem com Node.js e MySQL; não é executado pelo GitHub Pages.

Copie `.env.example` para `.env`, configure as credenciais, importe `database/schema.sql` e opcionalmente `database/exemplos_opcionais.sql`. Execute `npm run dev` para desenvolver. Para produção, compile sem `VITE_STATIC_MODE` e execute `npm start`. Nunca publique `.env` ou senhas no GitHub.

## Verificações

`npm run check` verifica a sintaxe do servidor e da interface; `npm run build` gera os arquivos estáticos em `dist/`.
