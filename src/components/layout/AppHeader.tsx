import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface AppHeaderProps {
  title?: string;
  backTo?: string;
  backParams?: Record<string, string>;
  backLabel?: string;
  showUser?: boolean;
}

export function AppHeader({ title = "🥫 DespensApp", backTo, backParams, backLabel = "← Volver", showUser = false }: AppHeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-10 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {backTo && (
          <Button variant="ghost" size="sm" className="shrink-0 px-2" asChild>
            <Link to={backTo as any} params={backParams as any}>{backLabel}</Link>
          </Button>
        )}
        <h1 className="text-lg font-bold truncate">{title}</h1>
      </div>
      {showUser && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[140px]">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Salir</Button>
        </div>
      )}
    </header>
  );
}
