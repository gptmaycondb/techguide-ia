# Manuais HP - App React Native (Expo)

App mobile para consulta tecnica de manuais HP LaserJet com IA.

## Funcionalidades
- Busca nos manuais (offline) - 1493 chunks indexados
- IA responde com base nos trechos encontrados
- Se nao encontrar no manual, informa e busca online
- 6 abas: E52645 Guia, M501/506/507, M527/528, E50045/145, E52545/645, Codigos de Erro

## Como gerar o APK

### 1. Instalar dependencias
npm install

### 2. Login no Expo
npx expo login

### 3. Configurar EAS
npx eas init  (substitui o projectId no app.json automaticamente)

### 4. Gerar APK
npx eas build --platform android --profile preview

O APK sera gerado na nuvem. Link para download aparece no terminal e em expo.dev.

## Estrutura
- App.js - navegacao, tabs, drawer
- src/ChatScreen.js - chat com logica RAG
- src/DrawerContent.js - topicos rapidos
- src/search.js - busca local nos manuais
- src/data.js - configuracao dos manuais
- assets/search_index.json - indice completo (2.6MB, 1493 chunks)

## Backend
O servidor em https://manuais-hp.onrender.com recebe as perguntas,
adiciona os trechos do manual ao contexto e chama a API Anthropic.
