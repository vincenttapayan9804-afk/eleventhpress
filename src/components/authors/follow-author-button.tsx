"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";

/** Follow an author who has an account; followers hear about their new publications. */
export function FollowAuthorButton({ accountId, initialCount }: { accountId: string; initialCount: number }) {
  const user = useApp((s) => s.user);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === accountId) return;
    apiFetch<{ following: boolean }>(`/api/experts/${accountId}/follow`)
      .then((r) => setFollowing(r.following))
      .catch(() => setFollowing(false));
  }, [user, accountId]);

  if (user?.id === accountId) return null;

  const toggle = async () => {
    if (!user) {
      useApp.getState().setView("login");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ following: boolean; followerCount: number }>(`/api/experts/${accountId}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      setFollowing(r.following);
      setCount(r.followerCount);
      toast.success(r.following ? "Following — you'll hear about new publications" : "Unfollowed");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={toggle} disabled={busy} variant={following ? "outline" : "default"}>
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : following ? <UserCheck className="mr-1.5 h-4 w-4" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
        {following ? "Following" : "Follow"}
      </Button>
      <span className="text-sm text-muted-foreground">{count} follower{count === 1 ? "" : "s"}</span>
    </div>
  );
}
