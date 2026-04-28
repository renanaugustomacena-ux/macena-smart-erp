import { Injectable } from '@nestjs/common';
import { CopilotService } from './copilot.service';

/**
 * Eval harness skeleton (plan §31.2 Sprint 25 / S25.7; Sprint 26 Q1-Q5;
 * Sprint 27 Q6-Q15).
 *
 * Runs a fixed set of golden questions against the Copilot and grades
 * each turn against a rubric. v1 ships the runner + the first batch
 * of placeholder questions (Q1-Q5 land in Sprint 26 once RAG is wired).
 *
 * The harness deliberately depends only on `CopilotService.ask`, so the
 * same harness exercises both the synthetic-response path (no API key)
 * and the production path once the live wiring lands in Sprint 27.
 */

export interface GoldenQuestion {
  id: string;
  persona: 'sara' | 'marco' | 'luca' | 'giulia' | 'andrea';
  prompt: string;
  /** A predicate over the Copilot output. Must return true for "pass". */
  expect: (output: string, toolCalls: Array<{ name: string }>) => boolean;
}

const SARA_GOLDEN_QUESTIONS: GoldenQuestion[] = [
  {
    id: 'sara/q01-ack',
    persona: 'sara',
    prompt: 'Mostrami le ultime 5 fatture emesse',
    expect: (_, toolCalls) =>
      toolCalls.some((c) => c.name === 'list_invoices'),
  },
  {
    id: 'sara/q02-iva',
    persona: 'sara',
    prompt: 'Qual e il bilancio IVA del periodo 2026-04?',
    expect: (_, toolCalls) =>
      toolCalls.some((c) => c.name === 'summarise_iva'),
  },
  {
    id: 'sara/q03-top-customers',
    persona: 'sara',
    prompt: 'Top 10 clienti per fatturato YTD',
    expect: (_, toolCalls) =>
      toolCalls.some((c) => c.name === 'top_customers'),
  },
  {
    id: 'sara/q04-monthly-sales',
    persona: 'sara',
    prompt: 'Andamento del fatturato negli ultimi 6 mesi',
    expect: (_, toolCalls) =>
      toolCalls.some((c) => c.name === 'monthly_sales'),
  },
  {
    id: 'sara/q05-italian',
    persona: 'sara',
    prompt: 'Riassumi le fatture passive del mese',
    expect: (output) => /\b(passive|fattur)/i.test(output),
  },
  // Sprint 27 — production persona Q6-Q10
  {
    id: 'luca/q06-scrap',
    persona: 'luca',
    prompt: 'Spiegami lo spike di scarti delle ultime 2 settimane',
    expect: (_, calls) => calls.some((c) => c.name === 'explain_scrap_spike'),
  },
  {
    id: 'luca/q07-rootcause',
    persona: 'luca',
    prompt: 'Trova la causa principale dei difetti su SKU FUSO-12',
    expect: (_, calls) => calls.some((c) => c.name === 'find_root_cause'),
  },
  {
    id: 'luca/q08-throughput',
    persona: 'luca',
    prompt: 'Andamento del throughput WO degli ultimi 6 mesi',
    expect: (_, calls) => calls.some((c) => c.name === 'work_order_throughput'),
  },
  {
    id: 'luca/q09-pipeline',
    persona: 'luca',
    prompt: 'Quali DDT sono ancora aperti?',
    expect: (_, calls) => calls.some((c) => c.name === 'ddt_pipeline'),
  },
  {
    id: 'luca/q10-snapshot',
    persona: 'luca',
    prompt: 'Top articoli a magazzino oggi',
    expect: (_, calls) => calls.some((c) => c.name === 'top_articles_produced'),
  },
  // Sprint 27 — Sara extended Q11-Q15
  {
    id: 'sara/q11-purchase',
    persona: 'sara',
    prompt: 'Andamento degli acquisti negli ultimi 3 mesi',
    expect: (_, calls) => calls.some((c) => c.name === 'monthly_purchases'),
  },
  {
    id: 'sara/q12-suppliers',
    persona: 'sara',
    prompt: 'Top 5 fornitori per spesa',
    expect: (_, calls) => calls.some((c) => c.name === 'top_suppliers'),
  },
  {
    id: 'sara/q13-customers',
    persona: 'sara',
    prompt: 'Cerca clienti che contengono "spa"',
    expect: (_, calls) => calls.some((c) => c.name === 'list_customers'),
  },
  {
    id: 'sara/q14-cash',
    persona: 'sara',
    prompt: 'Stato di cassa attuale',
    expect: (_, calls) => calls.some((c) => c.name === 'cash_snapshot'),
  },
  {
    id: 'sara/q15-intrastat',
    persona: 'sara',
    prompt: 'Stato Intrastat del 2026',
    expect: (_, calls) => calls.some((c) => c.name === 'intrastat_status'),
  },
];

@Injectable()
export class CopilotEvalHarness {
  constructor(private readonly copilot: CopilotService) {}

  async run(tenantId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    items: Array<{
      id: string;
      pass: boolean;
      output: string;
      toolCalls: string[];
    }>;
  }> {
    const items: Array<{
      id: string;
      pass: boolean;
      output: string;
      toolCalls: string[];
    }> = [];
    let passed = 0;
    for (const q of SARA_GOLDEN_QUESTIONS) {
      const r = await this.copilot.ask(tenantId, q.prompt, q.persona);
      const pass = q.expect(
        r.output,
        r.toolCalls.map((c) => ({ name: c.name })),
      );
      if (pass) passed += 1;
      items.push({
        id: q.id,
        pass,
        output: r.output,
        toolCalls: r.toolCalls.map((c) => c.name),
      });
    }
    return {
      total: SARA_GOLDEN_QUESTIONS.length,
      passed,
      failed: SARA_GOLDEN_QUESTIONS.length - passed,
      items,
    };
  }
}
