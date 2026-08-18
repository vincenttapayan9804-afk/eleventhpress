"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, GraduationCap, Globe2, Mail, BadgeCheck } from "lucide-react";

interface DepartmentMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  profession: string | null;
  bio: string | null;
  academicStatus: string | null;
  website: string | null;
  contactEmail: string | null;
  orcid: string | null;
}

interface DepartmentHead {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  profession: string | null;
}

interface DepartmentDetail {
  id: string;
  name: string;
  slug: string;
  head: DepartmentHead | null;
  members: DepartmentMember[];
}

function initialsOf(name: string) {
  return name
    .replace(/^Dr\.?\s+|^Prof\.?\s+/, "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const ACADEMIC_STATUS_LABEL: Record<string, string> = {
  FACULTY: "Faculty",
  STUDENT: "Student",
  STAFF: "Staff",
};

/**
 * EP University OS Phase 2 — a department's public landing page: its head
 * (display/attribution only, per docs/university-os-phase1.md — not a
 * permission grant) and its full member roster.
 */
export function DepartmentView() {
  const { departmentSlug, openDepartments } = useApp();
  const [department, setDepartment] = useState<DepartmentDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!departmentSlug) return;
    setLoading(true);
    setNotFound(false);
    apiFetch<{ department: DepartmentDetail }>(`/api/departments/public/${departmentSlug}`)
      .then((res) => setDepartment(res.department))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [departmentSlug]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !department) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center">
        <p className="font-display text-lg font-semibold">Department not found</p>
        <button onClick={openDepartments} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to departments
        </button>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <button onClick={openDepartments} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to departments
      </button>

      <div className="mt-6 flex items-center gap-4 border-b border-border pb-8">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[oklch(0.93_0.04_290)]">
          <GraduationCap className="h-7 w-7 text-[oklch(0.42_0.18_295)]" />
        </div>
        <div>
          <p className="eyebrow">Department</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{department.name}</h1>
          {department.head && (
            <p className="mt-1 text-sm text-muted-foreground">
              Head: {department.head.fullName}
              {department.head.profession ? ` · ${department.head.profession}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <p className="eyebrow">Members</p>
        <h3 className="mt-1 font-display text-xl font-semibold">
          {department.members.length} {department.members.length === 1 ? "member" : "members"}
        </h3>

        {department.members.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No members assigned yet.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {department.members.map((m) => (
              <div key={m.id} className="paper-card flex gap-3 rounded-xl border border-border p-4">
                <Avatar className="h-11 w-11 shrink-0 border border-[oklch(0.76_0.11_294/0.3)]">
                  {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.fullName} className="object-cover" />}
                  <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-sm font-medium text-[oklch(0.42_0.18_295)]">
                    {initialsOf(m.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-display text-sm font-semibold">{m.fullName}</p>
                    {m.academicStatus && ACADEMIC_STATUS_LABEL[m.academicStatus] && (
                      <Badge variant="outline" className="text-[0.55rem]">
                        {ACADEMIC_STATUS_LABEL[m.academicStatus]}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.profession || ""}</p>
                  {m.bio && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{m.bio}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.orcid && (
                      <a href={`https://orcid.org/${m.orcid}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-[oklch(0.42_0.18_295)] hover:underline">
                        <BadgeCheck className="h-3 w-3" /> ORCID
                      </a>
                    )}
                    {m.website && (
                      <a href={m.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-foreground">
                        <Globe2 className="h-3 w-3" /> Website
                      </a>
                    )}
                    {m.contactEmail && (
                      <a href={`mailto:${m.contactEmail}`} className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-foreground">
                        <Mail className="h-3 w-3" /> Contact
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
