# POC de isolamento por sources — Caeru Brain

**Pesquisa, não mecanismo de autorização para produção.** O runner cria um container PostgreSQL 16 + pgvector novo, vazio e isolado, com porta de loopback escolhida pelo Docker. Aplica o schema e todas as migrations do checkout nesse container e o remove ao terminar. Não recebe nem abre o banco existente. As tabelas `poc_*` são somente fixtures de catálogo; não são vinculadas ao autorizador nem provam isolamento por organização.

Pré-requisitos: Docker em execução, imagem `pgvector/pgvector:pg16` disponível, Bun, dependências do repositório instaladas. Na raiz do repositório:

```sh
bash workspace/poc/run-isolation.sh
```

O roteiro executa em sequência: POC de quatro sources com quatro membros vinculados e credenciais MCP; teste upstream de RLS PostgreSQL; teste upstream de propriedade de jobs e teste de facts por source. A primeira inicialização pode demorar vários minutos. O script não deve ser direcionado a um banco existente. Não execute `isolation.test.ts` isoladamente com um `DATABASE_URL` do usuário: `setupDB()` contém `TRUNCATE`.

A POC usa tokens de teste sem OAuth PKCE, um source para cada Brain, uma representação de duas organizações em tabelas descartáveis e vetores sintéticos 1536-dimensionais. O catálogo registra um membro em duas organizações, mas não implementa nem valida troca segura de organização; fontes e grants nativos são as fronteiras efetivamente testadas. Nenhum motor RAG novo é implementado. A busca vetorial é testada no engine com `sourceId`, não através do MCP ou de um provedor de embeddings. O teste de jobs cobre propriedade por cliente em handlers, não a execução de workers e Dream Cycle isolados por tenant. O teste upstream de RLS protege `pages` e abre as demais tabelas para isolar o experimento; **não constitui um conjunto completo de políticas RLS**. Consultar `analise.md` para cobertura e lacunas.
