import { SchedulingService } from './scheduling.service';

describe('SchedulingService — greedy fallback (S29)', () => {
  const svc = new SchedulingService();
  it('packs jobs onto resources by due-date order', () => {
    const r = svc.schedule(
      [
        {
          id: 'j1',
          productId: 'p1',
          quantity: 1,
          dueDate: '2026-05-15',
          estimatedMinutes: 60,
        },
        {
          id: 'j2',
          productId: 'p2',
          quantity: 1,
          dueDate: '2026-05-12',
          estimatedMinutes: 90,
        },
      ],
      [
        { id: 'cnc-01', dailyCapacityMinutes: 480, capabilities: ['steel'] },
      ],
    );
    expect(r.assignments).toHaveLength(2);
    expect(r.assignments[0].jobId).toBe('j2');
    expect(r.assignments[0].startMinutes).toBe(0);
    expect(r.assignments[1].jobId).toBe('j1');
    expect(r.assignments[1].startMinutes).toBe(90);
    expect(r.unassigned).toEqual([]);
    expect(r.method).toBe('greedy_v1');
  });

  it('marks overflow jobs as unassigned', () => {
    const r = svc.schedule(
      [
        {
          id: 'j1',
          productId: 'p1',
          quantity: 1,
          dueDate: '2026-05-15',
          estimatedMinutes: 600,
        },
      ],
      [
        { id: 'cnc-01', dailyCapacityMinutes: 480, capabilities: [] },
      ],
    );
    expect(r.unassigned).toContain('j1');
  });
});
