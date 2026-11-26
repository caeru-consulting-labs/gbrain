# GBrain para Caeru — diagnóstico preliminar

Este documento registra o levantamento inicial; não representa uma auditoria integral dos 17.641 arquivos rastreados nem uma validação de segurança ou de produção.

## Arquitetura encontrada

- `admin/` contém uma SPA React 19, TypeScript e Vite, com CSS próprio. Ela usa navegação por hash e é servida em `/admin/` pelo servidor HTTP do GBrain. O servidor usa `admin/dist` quando presente e, caso contrário, assets incorporados ao binário (`src/commands/serve-http-spa.ts`). O build e a geração dos assets incorporados precisam ser considerados na entrega.
- O painel atual oferece dashboard, agentes e clientes OAuth, permissões de clientes, chaves de API, logs de requisições, calibração e acompanhamento de jobs. Os dados vêm de endpoints reais e o dashboard recebe eventos por SSE.
- O núcleo expõe operações compartilhadas por CLI e MCP em `src/core/operations.ts`; os motores PostgreSQL e PGLite devem manter paridade. Brain identifica o banco; source identifica uma origem dentro dele. A identidade de uma página é `(source_id, slug)`.
- A sessão administrativa é separada da autorização MCP. O navegador recebe cookie HttpOnly, SameSite Strict, e o frontend não persiste o token de bootstrap; um escopo administrativo MCP não equivale à autoridade do proprietário. A experiência para membros precisa de identidade e escopo próprios, sem reutilizar a sessão do proprietário.

## Recursos e lacunas a verificar

| Área | Disponível | Lacuna para a interface |
| --- | --- | --- |
| Dashboard e operação | Estatísticas, saúde, SSE, requisições e jobs já são usados pelo painel. | Modernização visual e estados de carregamento/erro sem apresentar zeros antes da resposta. |
| Agentes e MCP | Cadastro, concessões, configuração e ciclo de vida de clientes já existem no painel e em endpoints administrativos. | Preservar fluxos, OAuth/PKCE e testes ao reorganizar a navegação. |
| Membros | `GET/POST /admin/api/access/members`: listar, adicionar, alterar email, desabilitar e habilitar; vínculos e handover têm endpoints próprios. | Não há tela correspondente; conferir contratos, efeitos sobre arquivos de conversas e resultado desconhecido antes de oferecer mutações. |
| Grupos e permissões de páginas | O CLI e o núcleo possuem membros, grupos, regras e verificações. | Não presumir que todas as operações tenham endpoint HTTP administrativo; mapear contratos e preservar prévias e verificações de acesso antes de expor mudanças. |
| Conhecimento e pesquisa | Operações nativas MCP/CLI de pesquisa, leitura e escrita, com filtragem por source e identidade. | Não foi identificada no levantamento inicial uma API web de navegação e pesquisa para usuários; definir uma integração autenticada que aplique os mesmos limites. Propostas de memória já possuem endpoints administrativos. |
| Fontes | `GET /admin/api/sources` é usado nos fluxos de clientes. | Inventariar operações de administração expostas antes de oferecer edição ou associar fontes a projetos. |
| Embeddings | Configuração e operações existem no GBrain; a consulta local informou embeddings desativados e pesquisa por palavras-chave. | Confirmar APIs e implicações de custo antes de oferecer configuração; não ativar provedores automaticamente. |
| Auditoria | O painel mostra requisições; alterações administrativas de membros registram eventos de acesso quando possível. | Mapear cobertura e falhas do registro antes de apresentá-lo como auditoria corporativa completa. |

## Identidade visual e abordagem

Há dois arquivos de imagem locais não rastreados, `images.png` e `caeru-favicon-32.png`; o primeiro apresenta a marca Caeru Revenue Partners em azul, preto e branco. O [site público da Caeru](https://caerupartners.com.br/) identifica a marca como Caeru Revenue Partners. Estes recursos são referências existentes, não um manual de marca completo: é necessário verificar resolução, transparência, licenças e adequação antes de incorporá-los. A tipografia oficial ainda não foi confirmada.

A base React/Vite existente é leve e já compatível com a aplicação. Tailwind, shadcn/ui e Lucide não constam das dependências atuais; avaliar seu custo de integração e manutenção antes de adicioná-los. O redesign deve preservar os caminhos de autenticação e consentimento, e disponibilizar navegação acessível em telas pequenas. O CSS existente oculta a sidebar abaixo de 768 px, deixando a navegação indisponível.

## Validação necessária

1. Completar o mapa dos contratos de conhecimento, grupos, regras, fontes e configuração, incluindo limites de confiança e testes de isolamento por membro/source.
2. Verificar o estado real do servidor local sem registrar credenciais ou alterar dados; validar a interface com uma instância de teste isolada.
3. Executar build, verificação TypeScript e os testes existentes relevantes. `admin/e2e/fixtures.ts` inicia um servidor isolado com PGLite temporário; os testes de navegador existentes cobrem fluxos sensíveis de OAuth e clientes.
4. Validar responsividade, temas, navegação por teclado, estados de carregamento/erro e fluxos reais. Medir recursos antes de assumir que a solução cabe na EC2 de 2 GB.

Nenhuma alteração de infraestrutura, publicação ou deploy está incluída neste levantamento.
