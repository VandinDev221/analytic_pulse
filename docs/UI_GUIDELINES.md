# Analytic Pulse — UI Guidelines

Referências visuais: **Stripe**, **Linear**, **Cloudflare**, **Vercel**, **Grafana**, **Datadog**.

Nunca copiar aparência de Material UI.

## Princípios

1. **Clareza acima de densidade** — evitar excesso de informação por viewport.
2. **Espaço em branco generoso** — interface limpa, respirável.
3. **Hierarquia tipográfica forte** — um foco visual por seção.
4. **Motion suave** — microinterações com propósito; nada exagerado.
5. **Feedback imediato** — toda ação do usuário tem resposta visual.
6. **Consistência** — tudo vem do Design System (`packages/ui`).

## Design System (obrigatório)

Componentes reutilizáveis:

Buttons · Inputs · Cards · Tables · Dialogs · Badges · Charts · Empty States · Icons · Tooltips · Dropdowns · Calendar

Regras:

- Nenhum estilo “one-off” sem passar pelo DS (exceto protótipos descartáveis).
- Tokens de cor, tipografia, espaçamento e radius centralizados.
- Charts com linguagem visual única (mesma paleta, mesmos eixos, mesmos empty states).

## Estados de UI (sempre)

Toda tela e componente assíncrono deve cobrir:

| Estado | Expectativa |
|--------|-------------|
| Loading | Skeleton — nunca spinners genéricos em massa |
| Empty | Mensagem + CTA claro |
| Error | Erro compreensível + retry quando fizer sentido |
| Offline | Indicação explícita de conectividade |
| Success | Confirmação discreta (toast / inline) |

## Layout e composição

- Uma composição clara por viewport — não “dashboard bagunçado”.
- Uma job por seção: um título, uma frase de suporte, um bloco principal.
- Cards: só quando encapsulam interação ou unidade semântica; evitar cardite.
- Evitar: clusters de pills, strips de stats sem contexto, badges flutuantes, glow excessivo.

## Dashboard (Fase 5+)

Elementos desejados:

- Cards inteligentes (contexto + tendência, não só número)
- Heatmaps
- Timeline de eventos
- Mapas (quando houver nós multi-região)
- Top latências / top incidentes
- Disponibilidade, SLA, performance
- Uso diário / semanal / mensal

## Motion

- Entrada suave de painéis e listas
- Transições de estado (up → down, open → resolved)
- Hover/focus acessíveis
- Respeitar `prefers-reduced-motion`

## Performance de UI

Lazy loading de rotas e charts pesados · virtualização de listas longas · code splitting · cache de queries · compressão de assets.

## Acessibilidade

Contraste AA · foco visível · labels em formulários · teclado completo · ARIA onde o semântico HTML não basta.

## Anti-padrões

- Visual “Material UI genérico”
- Dark mode forçado sem opção (status pages devem permitir tema)
- Skeletons incompletos (só no header e vazio no resto)
- Gráficos sem empty/error state
- Cores de status inconsistentes entre monitores, incidentes e status page
