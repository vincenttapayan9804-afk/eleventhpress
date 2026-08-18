"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap, Users, ChevronRight } from "lucide-react";

interface DepartmentListItem {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
}

/**
 * EP University OS Phase 2 — public directory of the current tenant's
 * departments. Empty for every non-university tenant and for a university
 * tenant that hasn't created any departments yet — same additive,
 * invisible-until-adopted posture as the rest of University OS.
 */
export function DepartmentsView() {
  const openDepartment = useApp((s) => s.openDepartment);
  const [departments, setDepartments] = useState<DepartmentListItem[] | null>(null);

  useEffect(() => {
    apiFetch<{ departments: DepartmentListItem[] }>("/api/departments/public")
      .then(({ departments }) => setDepartments(departments))
      .catch(() => setDepartments([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Departments</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Departmental directory</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Browse faculty, students, and staff by department.
        </p>
      </div>

      {departments === null && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {departments !== null && departments.length === 0 && (
        <div className="mt-16 text-center">
          <p className="font-display text-lg font-semibold">No departments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">This institution hasn't set up any departments.</p>
        </div>
      )}

      {departments !== null && departments.length > 0 && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <button key={d.id} onClick={() => openDepartment(d.slug)} className="text-left">
              <Card className="paper-card h-full transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[oklch(0.93_0.04_290)]">
                    <GraduationCap className="h-5 w-5 text-[oklch(0.42_0.18_295)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-semibold">{d.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {d.memberCount} {d.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
