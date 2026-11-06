import {
  Atom,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  Calculator,
  Cog,
  Cpu,
  GraduationCap,
  Leaf,
  Microscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DISCIPLINES } from "@/lib/article";

/** One icon per discipline in DISCIPLINES — shared by the home and About pages. */
export const DISCIPLINE_ICONS: Record<(typeof DISCIPLINES)[number], LucideIcon> = {
  Physics: Atom,
  Biology: Microscope,
  "Computer Science": Cpu,
  Sociology: Users,
  Economics: BarChart3,
  Psychology: Brain,
  "Environmental Science": Leaf,
  Mathematics: Calculator,
  Education: GraduationCap,
  Business: Building2,
  Technology: Cog,
  "Language and Literature": BookOpen,
};
