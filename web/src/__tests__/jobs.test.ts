import { describe, it, expect } from 'vitest';
import { DEPARTMENTS, DEPARTMENT_LABELS } from '../api/jobs';
import type { Department } from '../api/jobs';

describe('job board departments', () => {
  it('has 10 departments in correct order', () => {
    expect(DEPARTMENTS).toHaveLength(10);
    expect(DEPARTMENTS[0]).toBe('QUOTING');
    expect(DEPARTMENTS[DEPARTMENTS.length - 1]).toBe('SHIPPED');
  });

  it('every department has a label', () => {
    for (const dept of DEPARTMENTS) {
      expect(DEPARTMENT_LABELS[dept]).toBeTruthy();
    }
  });

  it('ON_MACHINE label is correct', () => {
    expect(DEPARTMENT_LABELS['ON_MACHINE']).toBe('On Machine');
  });

  it('QUALITY_CONTROL label is QC', () => {
    expect(DEPARTMENT_LABELS['QUALITY_CONTROL']).toBe('QC');
  });
});

describe('due date coloring logic', () => {
  function dueDateColor(dueDate: string): 'danger' | 'warning' | 'normal' {
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
    if (days < 0) return 'danger';
    if (days <= 3) return 'warning';
    return 'normal';
  }

  it('past due date is danger', () => {
    const past = new Date(Date.now() - 86_400_000 * 2).toISOString();
    expect(dueDateColor(past)).toBe('danger');
  });

  it('due in 2 days is warning', () => {
    const soon = new Date(Date.now() + 86_400_000 * 2).toISOString();
    expect(dueDateColor(soon)).toBe('warning');
  });

  it('due in 7 days is normal', () => {
    const later = new Date(Date.now() + 86_400_000 * 7).toISOString();
    expect(dueDateColor(later)).toBe('normal');
  });
});

describe('job board grouping', () => {
  interface SimpleJob {
    id: string;
    department: Department;
  }

  function groupByDept(jobs: SimpleJob[]): Record<Department, SimpleJob[]> {
    return DEPARTMENTS.reduce<Record<Department, SimpleJob[]>>(
      (acc, dept) => {
        acc[dept] = jobs.filter((j) => j.department === dept);
        return acc;
      },
      {} as Record<Department, SimpleJob[]>,
    );
  }

  it('groups jobs correctly by department', () => {
    const jobs: SimpleJob[] = [
      { id: '1', department: 'QUOTING' },
      { id: '2', department: 'ON_MACHINE' },
      { id: '3', department: 'QUOTING' },
    ];
    const grouped = groupByDept(jobs);
    expect(grouped['QUOTING']).toHaveLength(2);
    expect(grouped['ON_MACHINE']).toHaveLength(1);
    expect(grouped['SHIPPED']).toHaveLength(0);
  });
});
