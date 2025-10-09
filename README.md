# BMR Slicer

## Objetivo
O BMR Slicer é um projeto open source focado em fornecer um pipeline de fatiamento rápido e acessível para impressoras FDM. O MVP prioriza a preparação de G-code básico com calibração amigável para o usuário e integrações simples com ferramentas de produtividade.

## Quickstart
### Requisitos
- Node.js 20.x
- pnpm 9.x
- Dependências nativas para Node-API (caso futuramente sejam adicionadas features em Rust/WASM)

### Instalação e execução
```bash
pnpm install --filter slicer-web...
pnpm --filter slicer-web dev
```

### Testes e qualidade
```bash
pnpm --filter slicer-web test
pnpm --filter slicer-web lint
```

## Fórmulas principais
- **Fluxo volumétrico de material (MVF)**: `MVF = (largura_da_extrusão × altura_da_camada × velocidade_de_impressão)`.
- **Overhead de movimentos rápidos**: utilize o fator `overhead = (tempo_de_retração + tempo_de_viagem) / tempo_total_de_camada`. Esse coeficiente permite calibrar perfis levando em conta movimentos não extrusivos.
- **Tempo estimado de impressão**: `tempo_total ≈ Σ (comprimento_do_caminho / velocidade) × (1 + overhead)`.

## Calibração com a sua impressora
1. **Coleta de dados base**: imprima um cubo de calibração (20×20×20 mm) com o perfil padrão. Anote tempo real, comprimento de filamento e peso da peça.
2. **Ajuste de MVF**:
   - Calcule o MVF real medindo o consumo de filamento (`massa / densidade / comprimento_da_trilha`).
   - Compare com o MVF teórico fornecido pelo slicer (`largura × altura × velocidade`).
   - Ajuste o multiplicador de fluxo até que o MVF real e o teórico estejam dentro de ±5%.
3. **Calibração de overhead**:
   - Meça o tempo total e subtraia o tempo estimado apenas de extrusão (comprimento / velocidade).
   - O restante corresponde ao overhead. Atualize o fator `overhead` no perfil para compensar movimentações rápidas, retrações e acelerações.
4. **Validação**: repita a impressão e confirme se o tempo previsto pelo slicer se aproxima (≤5%) do tempo real. Ajuste novamente se necessário.

## Estrutura do repositório
- `slicer-web/`: aplicação Next.js responsável pelo front-end, parsing de G-code e calibração interativa.
- `docs/`: materiais auxiliares (screenshots, relatórios e especificações futuras).

## Screenshots (placeholders)
- ![Dashboard do MVP](docs/screenshots/mvp-dashboard-placeholder.png)
- ![Assistente de calibração](docs/screenshots/calibration-placeholder.png)

## Contribuição
Contribuições são bem-vindas. Utilize Conventional Commits, siga as validações do lint-staged e abra PRs com contexto completo.

## Licença
Este projeto está licenciado sob os termos da [MIT License](./LICENSE).
