import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "@/components/products/ProductForm";
import { createProduct } from "@/lib/products";
import { AppHeader } from "@/components/layout/AppHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/productos/nuevo")({
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();

  const handleSubmit = async (product: Parameters<typeof createProduct>[0], nutrition: Parameters<typeof createProduct>[1]) => {
    const id = await createProduct(product, nutrition);
    toast.success(`"${product.name}" creado correctamente`);
    navigate({ to: "/despensa/productos/$productId", params: { productId: id } });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Nuevo producto" backTo="/despensa" backLabel="← Productos" />
      <main className="p-4 max-w-2xl mx-auto">
        <ProductForm onSubmit={handleSubmit} onCancel={() => navigate({ to: "/despensa" })} />
      </main>
    </div>
  );
}
