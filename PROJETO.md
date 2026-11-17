# Simulador de Escalas ContaD

MVP para planejar a transição da escala 6x1 (44h) para 5x2 (42h e 40h) prevista na EC 141/2026.
Especificação completa e análise de viabilidade ficam na pasta do projeto (`simulador-escalas/`).

## Problema
O empresário não sabe se, com a equipe que tem, vai conseguir manter a empresa aberta quando a jornada cair, em quais horários vai faltar gente e quanto custa cada saída.

## User stories (MVP)
1. Como empresário, quero informar o horário de funcionamento por dia, para que a escala respeite quando a loja está aberta. **Aceite:** nenhum turno cai em dia fechado ou fora do horário.
2. Como empresário, quero dizer quantas pessoas preciso em cada faixa de horário, por função, para ver onde falta gente. **Aceite:** o mapa mostra déficit no horário certo; excesso num horário não compensa falta em outro.
3. Como empresário, quero ver a escala de 44h, 42h e 40h lado a lado, para comparar. **Aceite:** 42h = 5×8h24, 40h = 5×8h, folgas 1 ou 2 por semana, sem passar dos limites.
4. Como empresário, quero que os intervalos sejam distribuídos e descontados, para saber a cobertura real. **Aceite:** quem está em intervalo não conta como disponível.
5. Como cliente da ContaD, quero ver o custo pelo meu regime tributário, para não superestimar a folha. **Aceite:** Simples (I, II, III, V) sem INSS patronal, RAT e terceiros.
6. Como empresário, quero comparar reorganizar, meio período, contratar e hora extra, para decidir. **Aceite:** cada alternativa recalcula a escala e mostra o déficit que sobra e o custo.
7. Como empresário, quero imprimir e salvar a simulação, para levar à ContaD. **Aceite:** impressão/PDF pelo navegador e arquivo .json que abre de novo.

## Decisões
- **Sem backend, sem login, sem banco no MVP.** Tudo roda no navegador; os dados ficam na aba (sessionStorage) e o usuário salva um arquivo se quiser. Custo de infraestrutura: zero.
- **Motor separado da interface** (`src/motor/`), em TypeScript puro, com testes (Vitest). Tempo sempre em minutos inteiros.
- **Gerador heurístico** (guloso): escolhe dias de trabalho pela maior necessidade, entrada pelo maior déficit e intervalo onde menos falta gente. Mostra "sugestão viável", sem prometer ótimo.
- **Regras versionadas** em `src/motor/regras.ts`, todas com status **pendente** até a ContaD validar (8h24 sem acordo, divisores 220/210/200, alíquotas de RAT e terceiros).
- Visual: azul-marinho ContaD, fonte Archivo, cor só nos dados (cobertura), tabelas simples.

## Como rodar
```bash
npm install
npm run dev        # http://localhost:5173
npx vitest run     # testes do motor
npm run build      # gera dist/ (site estático)
```

## Limitações conhecidas (próximas fases)
- Escala ainda não é editável à mão (fixar turnos e folgas).
- Sem mês, ciclos de 4–5 semanas, feriados, domingos alternados com regra validada.
- Sem convenções coletivas por categoria, 12x36, noturno, turnos que passam da meia-noite.
- Sem login, área do cliente, painel ContaD e solicitação de análise.
- Hora extra é estimativa (supõe que as extras caem nos horários descobertos).
