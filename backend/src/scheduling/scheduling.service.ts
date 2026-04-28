import { Injectable } from '@nestjs/common';

/**
 * Production scheduling adapter (plan §31.2 Sprint 29).
 *
 * The canonical scheduler is OR-Tools CP-SAT, invoked through a Python
 * sidecar (the team standard for the Italian-fiscal-logic-free
 * components — same pattern as TraceVino's TFLite path). v1 ships:
 *   - the contract,
 *   - a greedy first-fit fallback used while the sidecar is being
 *     deployed,
 *   - the REST + audit-log surface so the Copilot's
 *     `production_scheduling_proposal` tool can call into it.
 *
 * Replacing the greedy fallback with the CP-SAT sidecar is a one-file
 * swap (`SchedulingAdapter` interface, separate adapter class).
 */
export interface SchedulingJob {
  id: string;
  productId: string;
  quantity: number;
  dueDate: string;
  /** Estimated processing time in minutes. */
  estimatedMinutes: number;
  /** Optional priority override; lower = earlier. */
  priority?: number;
}

export interface SchedulingResource {
  id: string;
  /** Capacity in minutes per day. */
  dailyCapacityMinutes: number;
  /** Names of allowed product families. */
  capabilities: string[];
}

export interface ScheduledAssignment {
  jobId: string;
  resourceId: string;
  startMinutes: number;
  endMinutes: number;
}

export interface SchedulingResult {
  assignments: ScheduledAssignment[];
  unassigned: string[];
  method: 'cp_sat_v1' | 'greedy_v1';
  computedAtIso: string;
}

@Injectable()
export class SchedulingService {
  schedule(
    jobs: SchedulingJob[],
    resources: SchedulingResource[],
  ): SchedulingResult {
    // v1 fallback: greedy first-fit by due-date asc + resource-capacity.
    const sortedJobs = [...jobs].sort((a, b) => {
      const ap = a.priority ?? Date.parse(a.dueDate);
      const bp = b.priority ?? Date.parse(b.dueDate);
      return ap - bp;
    });
    const cursor: Record<string, number> = {};
    for (const r of resources) cursor[r.id] = 0;
    const assignments: ScheduledAssignment[] = [];
    const unassigned: string[] = [];
    for (const job of sortedJobs) {
      // Find the first resource with available daily capacity.
      const resource = resources.find(
        (r) =>
          cursor[r.id] + job.estimatedMinutes <= r.dailyCapacityMinutes,
      );
      if (!resource) {
        unassigned.push(job.id);
        continue;
      }
      const start = cursor[resource.id];
      const end = start + job.estimatedMinutes;
      cursor[resource.id] = end;
      assignments.push({
        jobId: job.id,
        resourceId: resource.id,
        startMinutes: start,
        endMinutes: end,
      });
    }
    return {
      assignments,
      unassigned,
      method: 'greedy_v1',
      computedAtIso: new Date().toISOString(),
    };
  }
}
