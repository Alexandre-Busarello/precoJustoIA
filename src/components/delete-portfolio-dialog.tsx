"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invalidateDashboardPortfoliosCache } from "./dashboard-portfolios";

interface DeletePortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  portfolioName: string;
}

export function DeletePortfolioDialog({
  open,
  onOpenChange,
  portfolioId,
  portfolioName,
}: DeletePortfolioDialogProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmText === portfolioName;

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/portfolio/${portfolioId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir carteira");
      }

      toast.success("Carteira excluída permanentemente");
      
      // Invalidate dashboard cache
      invalidateDashboardPortfoliosCache();
      
      // Redirect to portfolios list
      router.push("/carteira");
      router.refresh();
    } catch (error) {
      console.error("Error deleting portfolio:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir carteira"
      );
    } finally {
      setIsDeleting(false);
      onOpenChange(false);
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDialogTitle>Excluir Carteira Permanentemente</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm font-semibold text-destructive">
                ⚠️ Esta ação é IRREVERSÍVEL!
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                Todos os dados serão excluídos permanentemente:
              </p>
              <ul className="text-xs text-destructive/80 mt-2 space-y-1 list-disc list-inside">
                <li>Todas as transações</li>
                <li>Histórico de métricas</li>
                <li>Configurações de alocação</li>
                <li>Análises e relatórios</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-name" className="text-sm">
                Para confirmar, digite o nome da carteira:{" "}
                <span className="font-semibold">{portfolioName}</span>
              </Label>
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={portfolioName}
                className="font-mono"
                disabled={isDeleting}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir Permanentemente"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
