# Projeto Sorteio

Aplicacao web para cadastro de participantes, escolha de carro, exibicao de lobby e sorteio em formato de corrida.

O projeto esta dividido em:

- Frontend em React + Vite
- Backend em FastAPI

## Funcionalidades

- Tela de entrada para o participante informar o nome
- Escolha visual do modelo do carro antes de entrar no lobby
- Lobby compartilhado com lista de participantes
- Painel administrativo para iniciar o sorteio
- Animacao de corrida com audio de largada
- Exibicao de vencedores no podio

## Estrutura do projeto

```text
Projeto Sorteio/
|-- server/
|   |-- main.py
|   `-- requirements.txt
|-- src/
|   |-- App.jsx
|   |-- App.css
|   `-- assets/
|-- package.json
`-- README.md
```

## Pre-requisitos

Antes de rodar o projeto, tenha instalado:

- Node.js e npm
- Python 3

## Como rodar o backend

Abra um terminal na raiz do projeto e execute:

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Se estiver usando Prompt de Comando em vez de PowerShell:

```bat
cd server
python -m venv .venv
.\.venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Quando o backend subir, a API local ficara disponivel em:

```text
http://localhost:8000
```

Endpoints uteis para teste rapido:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/participants`

## Como rodar o frontend

Abra outro terminal na raiz do projeto e execute:

```powershell
npm install
npm run dev
```

Por padrao, o frontend usa uma URL remota de backend quando nenhuma variavel de ambiente e definida. Para desenvolver localmente com o backend da sua maquina, crie um arquivo `.env.local` na raiz do projeto com o conteudo abaixo:

```env
VITE_API_URL=http://localhost:8000
```

Depois rode novamente:

```powershell
npm run dev
```

O Vite vai mostrar no terminal o endereco local da aplicacao. Normalmente sera algo como:

```text
http://localhost:5173
```

## Como rodar frontend e backend juntos

Use dois terminais.

Terminal 1, backend:

```powershell
cd server
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2, frontend:

```powershell
npm run dev
```

Com isso:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Exemplo completo de primeira execucao

Se for a primeira vez rodando o projeto, o fluxo mais seguro e:

1. Instalar as dependencias do frontend:

```powershell
npm install
```

2. Criar o arquivo `.env.local`:

```env
VITE_API_URL=http://localhost:8000
```

3. Instalar as dependencias do backend:

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

4. Iniciar o backend:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

5. Em outro terminal, iniciar o frontend:

```powershell
npm run dev
```

## Scripts do frontend

Na raiz do projeto:

- `npm run dev`: inicia o frontend em modo de desenvolvimento
- `npm run build`: gera a versao de producao em `dist/`
- `npm run preview`: publica localmente o build gerado
- `npm run lint`: executa a analise de codigo com ESLint

## Dependencias do backend

Arquivo [server/requirements.txt](C:/Users/19756/Documents/Projeto%20Sorteio/server/requirements.txt):

- `fastapi==0.115.5`
- `uvicorn[standard]==0.32.0`

## Dicas de uso

- Se o frontend abrir mas nao carregar participantes, confirme se o arquivo `.env.local` aponta para `http://localhost:8000`
- Se a porta `8000` ja estiver em uso, troque no comando do `uvicorn` e atualize a `VITE_API_URL`
- Se a porta do Vite mudar, use a URL exibida no terminal

## Build de producao

Para gerar os arquivos finais do frontend:

```powershell
npm run build
```

Para servir localmente esse build:

```powershell
npm run preview
```
