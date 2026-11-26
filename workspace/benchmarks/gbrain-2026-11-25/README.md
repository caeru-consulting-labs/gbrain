# Benchmark local GBrain — 25/11/2026

## Ambiente e método

- GBrain 0.60.773.0, checkout `3988f8746f`, Bun 1.4.5; PostgreSQL 16.16 com pgvector 0.8.7 no contêiner existente.
- Host x86-64, Intel i7-7700, 8 CPUs lógicas, aproximadamente 15,5 GiB RAM e 4 GiB swap. Cerca de 3,4 GiB de swap estavam em uso. Outros processos estavam ativos; não é um ambiente dedicado nem uma Lightsail.
- Três bancos novos, três usuários novos e três diretórios `GBRAIN_HOME` distintos; sem alterar os bancos existentes. Os dados usados eram 60 arquivos Markdown sintéticos, 100.110 bytes no total; 60 páginas e 60 chunks importados por banco, sem embeddings.
- Servidores HTTP independentes via MCP; pesquisa `search`, `match=keyword`, limite 10. No teste individual foram 30 requisições sequenciais; no teste triplo, 20 sequenciais por servidor, com os três clientes em paralelo. Os resultados são de um ensaio curto, não representam carga sustentada.
- RSS e PSS de cada PID amostrados aproximadamente a cada 100 ms. Picos são máximos das amostras, não limites garantidos. CPU é porcentagem de um núcleo lógico; valores acima de 100% indicam mais de um núcleo. A medição é por processo, sem incluir PostgreSQL, filhos ou sistema operacional. Picos individuais não necessariamente coincidem. As latências incluem HTTP local e processamento do GBrain, não incluem rede externa.

## Resultados

| Cenário | Duração/latência | Processos: pico RSS / pico PSS | CPU média / pico em uma amostra |
| --- | --- | --- | --- |
| Uma instância ociosa | 12 s | servidor 163,4 / 138,5 MiB | 1,2% / 38,6% |
| Importação de 60 documentos | 2,79 s; 60 importados | servidor 161,3 / 135,8 MiB; CLI 149,4 / 118,3 MiB | servidor 1,1% / 9,6%; CLI 75,2% / 277,3% |
| Busca textual, uma instância | 30 buscas; mediana 41,6 ms; p95 50,0 ms; máx. 59,1 ms | servidor 201,4 / 176,1 MiB | 42,2% / 57,5% |
| Dream Cycle, somente banco | 4,62 s; resultado parcial | servidor 195,1 / 169,9 MiB; CLI 166,3 / 134,4 MiB | servidor 0,9% / 9,3%; CLI 57,3% / 383,4% |
| Dream Cycle, com repositório sintético | 5,0 s; resultado parcial; sync concluído | servidor 162,7 / 137,7 MiB; CLI 186,0 / 153,8 MiB | servidor 0,6%; CLI 56,4% (médias; pico de CPU não coletado) |
| Três instâncias ociosas | 12 s | servidor 1: 181,2 / 145,4 MiB; servidor 2: 163,1 / 127,5 MiB; servidor 3: 168,9 / 133,9 MiB | médias 0,7%, 0,6%, 1,8% |
| Três instâncias com buscas concorrentes | 20 buscas por servidor; medianas 96,1 / 141,9 / 115,1 ms; p95 216,7 / 230,3 / 249,4 ms | servidor 1: 207,5 / 171,4 MiB; servidor 2: 186,9 / 150,8 MiB; servidor 3: 194,0 / 157,8 MiB | médias 11,9%, 21,7%, 20,7% |

Busca textual adicional via CLI retornou 20 resultados; uma chamada `query` retornou resultados de fallback sem embeddings. **Não houve medição válida de busca semântica:** não havia modelo ou serviço de embeddings configurado. Nenhuma chave ou provedor pago foi usado.

O Dream com repositório concluiu `sync`, mas seu resultado foi `partial`: síntese foi pulada porque não havia corpus de sessões, patterns por não haver reflexões suficientes e embeddings estavam desabilitados. O relatório também apresentou avisos de lint e páginas órfãs. Não representa Dream completo com LLM ou embeddings.

Após o teste, amostras pontuais: processo API Caeru em modo `bun --watch` 120,0 MiB RSS / 109,8 MiB PSS; contêiner PostgreSQL GBrain compartilhado 101,5 MiB; PostgreSQL do Caeru 32,38 MiB. São medições de momentos distintos, não picos de cada contêiner nem valores exclusivos dos bancos de teste. O mesmo PostgreSQL GBrain já atendia dados/serviços existentes.

Os servidores GBrain criados para o benchmark foram encerrados. Os bancos sintéticos foram mantidos; dados preexistentes não foram excluídos. Os números brutos estão nos arquivos JSON ao lado deste relatório.

## Interpretação para Lightsail

É possível que uma configuração pequena caiba em 2 GiB, mas este teste não demonstra estabilidade sob carga, crescimento dos dados, jobs concorrentes, embeddings, picos do PostgreSQL, SO, cache, observabilidade ou swap. Não aprova 2 GiB para produção. A opção de 4 GiB oferece mais folga para um piloto, ainda condicionada a um teste representativo com limites reais de CPU e memória, latências p95/p99, carga sustentada e banco volumoso. Não é uma aprovação de capacidade nem uma garantia para produção.

Consulte a documentação AWS sobre [CPU de referência e capacidade de burst no Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/baseline-cpu-performance.html): ultrapassar a linha de base por longos períodos consome capacidade de burst. As métricas locais acima não são diretamente transferíveis para as CPUs da AWS.
