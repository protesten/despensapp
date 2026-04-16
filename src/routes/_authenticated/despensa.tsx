import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/despensa")({
  component: DespensaPage,
});

function DespensaPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">🥫 DespensApp</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Tu Despensa</h2>
        <p className="text-muted-foreground">
          Base de datos lista. Las funciones de productos, stock y movimientos se implementarán en las siguientes fases.
        </p>
      </main>
    </div>
  );
}
