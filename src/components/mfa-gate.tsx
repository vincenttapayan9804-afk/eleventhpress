"use client";

import { PasswordChangeGate } from "@/components/password-change-gate";
import { useApp } from "@/lib/store";
import { MFA_REQUIRED_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { ShieldCheck, LogOut } from "lucide-react";

/**
 * Blocks dashboard access for a privileged role (MFA_REQUIRED_ROLES, src/
 * lib/roles.ts) until two-factor authentication is actually turned on —
 * an enterprise-security baseline most SOC 2 reviews and procurement
 * questionnaires check specifically: not "is MFA offered" but "is MFA
 * mandatory for admin accounts." Uses the same enrollment component as
 * Profile → Security (src/components/two-factor-setup.tsx): emailed codes
 * for people without an authenticator app, or an authenticator app.
 *
 * Never locks an account out with no way forward: the account can still
 * sign out, and setup here is the same one-time flow Profile → Security
 * already offers — nothing about this screen is a dead end.
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const { user, setAuth, logout } = useApp();

  // A temporary password issued by an administrator is replaced first.
  if (user?.mustChangePassword) return <PasswordChangeGate />;

  const mustSetUp = !!user && MFA_REQUIRED_ROLES.includes(user.role) && user.twoFactorEnabled === false;
  if (!mustSetUp) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="paper-card w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="eyebrow">Two-factor authentication required</p>
          </div>
          <h2 className="font-display text-xl font-semibold">Secure your account to continue</h2>
          <p className="text-sm text-muted-foreground">
            Accounts with your level of access ({user?.role.replace(/_/g, " ").toLowerCase()}) need a second sign-in
            step before reaching the dashboard. It takes about a minute.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TwoFactorSetup reports success only after the backup codes are acknowledged,
              so flipping twoFactorEnabled here can't skip them. */}
          <TwoFactorSetup onEnabled={(method) => user && setAuth({ ...user, twoFactorEnabled: true, twoFactorMethod: method })} />
          <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out instead
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
