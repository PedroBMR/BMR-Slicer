# Roadmap

## Fase 1 – MVP
- Fluxo de upload de modelos STL e parâmetros básicos de fatiamento.
- Pré-visualização simplificada em 3D com Three.js.
- Persistência local com Dexie e sincronização mínima usando Web Workers.
- Calibração guiada de MVF e overhead com base no fluxo de trabalho descrito no README.

## Fase 2 – Suporte completo a G-code
- Geração de G-code otimizada com comandos personalizados para impressoras BMR.
- Exportação de relatórios em PDF (jsPDF) e planilhas (SheetJS).
- Validação estruturada com Zod e testes automatizados em Vitest/Playwright.

## Fase 3 – Shader de pré-visualização por camada
- Renderização avançada de camadas usando shaders personalizados em Three.js.
- Ferramentas de inspeção de falhas com filtros de velocidade, temperatura e fluxo.

## Fase 4 – Integração WASM
- Portar cálculos pesados para módulos WASM (Rust) com bindings via comlink.
- Benchmark e ajustes de performance para reduzir o tempo de fatiamento.

## Fase 5 – Backend com autenticação e multiusuário
- API segura com controle de acesso baseado em papéis.
- Perfis compartilhados e sincronização de presets entre dispositivos.

## Fase 6 – Exportação para a nuvem
- Integração com provedores de armazenamento (S3, GCS) para backup automático.
- Webhooks e notificações sobre conclusão de fatiamento e jobs de impressão.
