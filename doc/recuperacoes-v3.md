# Recuperações por período

Os períodos são comandos explícitos do narrador sobre até 20 fichas. Cada
ficha usa a própria versão do template; a prévia mostra as mudanças e os
motivos de indisponibilidade. A confirmação reconstrói os eventos no servidor,
confere as versões e grava tudo na mesma transação. Desfazer usa a mesma
reversão com detecção de conflitos das operações de dano e cura.

## Regras conferidas

As referências abaixo são os livros básicos da edição indicada. Os textos de
ajuda dos templates são resumos originais das condições de aplicação.

| Template | Período | Efeito e condição | Referência |
|---|---|---|---|
| `vtm-v20` 1.5.0 | Nova noite | Debita 1 Sangue. A recuperação noturna de FdV é opcional e fica à parte. | V20, pp. 267–268, “Regaining Willpower” e “Using Blood Pool” ([texto do livro](https://studylib.net/doc/27099267/v20---core-rulebook)) |
| `vtm-v20` 1.5.0 | Fim da história | Enche FdV até o permanente, se o narrador autorizar a recuperação completa pelos objetivos atingidos. | V20, p. 267, mesma referência |
| `mta-m20` 1.4.0 | Novo dia | +1 FdV após sono reparador. O narrador seleciona quem descansou. | M20, p. 331, “Regaining Willpower” ([texto do livro](https://anyflip.com/qkxdf/odlw/basic/51-100)) |
| `mta-m20` 1.4.0 | Fim da história | Enche FdV após história bem-sucedida. O livro permite recuperação parcial quando o resultado é ruim; nesse caso, o narrador ajusta a ficha manualmente. | M20, p. 331, mesma referência |
| `wta-w20` 1.4.0 | Novo dia | +1 FdV ao acordar. | W20, “Recovering Willpower”, capítulo 3 ([texto do livro](https://pdfcoffee.com/werewolf-the-apocalypse-20th-anniversary-edition-5-pdf-free.html)) |
| `wta-w20` 1.4.0 | Fim da história | Enche FdV se o narrador adotar a recuperação completa. Fúria e Gnose exigem outras condições. | W20, mesma referência |

As opções não avançam o tempo automaticamente e não se repetem ao abrir a
Mesa. O UUID identifica uma confirmação: reenviar a mesma confirmação aplica
uma vez; uma nova confirmação permite aplicar outro período. Sem rede, não
há fila offline para operações em grupo.

## Contrato e limites

`recoveries` contém `{ id, label, help, effects }`. Cada efeito usa
`{ effect, params? }` e a lista fechada `REGISTRY.effects`. As validações de
JSON Schema, referência e core recusam nomes e parâmetros desconhecidos.
`resource.restore` altera o atual até o permanente; não aumenta o permanente.
Os efeitos são planejados em sequência e consolidados em um evento por
caminho, preservando o valor original para reversão.

Um recurso já cheio é ignorado quando existem outros efeitos no período.
Sem nenhuma mudança, a prévia informa “Nada a recuperar neste período” e a
operação inteira fica indisponível. O narrador pode retirar essa ficha da
seleção e conferir outra prévia. As versões antigas sem `recoveries` continuam
abrindo e não oferecem os botões novos.

O fixture de D&D declara “Descanso longo” com `rest.long`. Como esse efeito
ainda não está em `IMPLEMENTED_EFFECTS`, a prévia informa a indisponibilidade
sem aplicar parte do descanso. Os testes cobrem esse caminho.
