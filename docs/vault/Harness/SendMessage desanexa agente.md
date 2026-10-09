---
tags: [harness, armadilha, workflow]
updated: 2026-10-09
---
# SendMessage desanexa agente

> Mandar SendMessage para um agente que roda dentro de um Workflow pode desanexá-lo do fluxo: o resultado estruturado não volta ao script e o lote fica órfão.

- Não converse com agentes do workflow.
- Se ele estiver esperando algo (lock preso, banco parado, servidor fora), **resolva o ambiente** e deixe o agente seguir sozinho.
- Para mudar o rumo, espere o lote terminar e ajuste a spec ou o carry-over do próximo.

Ver também: [[Harness]]
