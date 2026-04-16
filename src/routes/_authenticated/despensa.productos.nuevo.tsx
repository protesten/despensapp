import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "@/components/products/ProductForm";
import { createProduct } from "@/lib/products";

export const Route = createFileRoute("/_authenticated/despensa/productos/nuevo")({
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();

  const handleSubmit = async (product: Parameters<typeof createProduct>[0], nutrition: Parameters<typeof createProduct>[1]) => {
    const id = await createProduct(product, nutrition);
    navigate({ to: "/despensa/productos/$productId", params: { productId: id } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background z-10">
        <button onClick={() => navigate({ to: "/despensa" })} className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver
        </button>
        <h1 className="text-lg font-bold mt-1">Nuevo producto</h1>
      </header>
      <main className="p-4 max-w-2xl mx-auto">
        <ProductForm onSubmit={handleSubmit} onCancel={() => navigate({ to: "/despensa" })} />
      </main>
    </div>
  );
}
