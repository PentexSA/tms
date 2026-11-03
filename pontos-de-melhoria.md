setupHMR.ts:23 Received `false` for a non-boolean attribute `accessible`.

If you want to write it to the DOM, pass a string instead: accessible="false" or accessible={value.toString()}.

If you used to conditionally omit it with accessible={condition && value}, pass accessible={condition ? value : undefined} instead.

Ações do narrador precisa ter uma indicacao melhor na web

bug na web se eu reinicio a pagina sou deslogado.

outro bug e que quando o narrador atualiza a ficha, o cliente (jogadores nao e atualizado automaticamente)

limite de ficha funciona pra narrador mas nao funciona para quando entra um jogador.

a criacao de ficha com regra nao ficou muito bom, essa etapa de escolher la em cima ficou ruim eu devia selecionar dentro da caixa que vou utilizar por exemplo a divisao esta dentro de atruibutos para 7 5 3, outra coisa nao esta travando quando eu passo do limite.




Console Error
Received `false` for a non-boolean attribute `accessible`.

If you want to write it to the DOM, pass a string instead: accessible="false" or accessible={value.toString()}.

If you used to conditionally omit it with accessible={condition && value}, pass accessible={condition ? value : undefined} instead.
packages/ui/dist/Emblem.js (38:17)

Open


 36 |
/** Decorativo: o nome do personagem está ao lado. */

 37 |
export

function

Emblem
({ name
,
 size
,
 color
,
 testID }) {
>
 38 |

return
 (_jsx(
Svg
,
 { width
:
 size
,
 height
:
 size
,
 viewBox
:

"0 0 24 24"
,
 testID
:
 testID
,
 accessible
:

false
,

"aria-hidden"
:

true
,
 children
:

PATHS
[name]
.
map(d
=>
 (_jsx(
Path
,
 { d
:
 d
,
 fill
:

"none"
,
 stroke
:
 color
,
 strokeWidth
:

1.8
,
 strokeLinecap
:

"round"
,
 strokeLinejoin
:

"round"
 }
,
 d))) }))
;

    |

^

 39 |
}

 40 |
//# sourceMappingURL=Emblem.js.map



o texto de criacao de fichas (estas regras valem para novas dichas. ajuste de uma ficha especifica continuam disponiveis nela) ficou muito ruim. poderia deixar duas colunas.
