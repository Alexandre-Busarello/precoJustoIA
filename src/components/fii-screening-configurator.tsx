"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface FiiScreeningFormParams {
  tipoFii: "papel" | "tijolo" | "both";
  minDY?: number;
  maxPVP?: number;
  minLiquidity?: number;
  minQtdImoveis?: number;
  maxVacancia?: number;
  segmento?: string;
}

interface Props {
  params: FiiScreeningFormParams;
  onChange: (p: FiiScreeningFormParams) => void;
}

export function FiiScreeningConfigurator({ params, onChange }: Props) {
  const set = (partial: Partial<FiiScreeningFormParams>) =>
    onChange({ ...params, ...partial });

  return (
    <Card className="border-amber-200/60 dark:border-amber-900/40">
      <CardHeader>
        <CardTitle className="text-lg">Filtros — FIIs</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={params.tipoFii}
            onValueChange={(v) =>
              set({ tipoFii: v as FiiScreeningFormParams["tipoFii"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Tijolo e papel</SelectItem>
              <SelectItem value="tijolo">Tijolo</SelectItem>
              <SelectItem value="papel">Papel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>DY mín. (% a.a.)</Label>
          <Input
            type="number"
            step="0.1"
            placeholder="ex: 8"
            value={params.minDY != null ? params.minDY * 100 : ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              set({ minDY: e.target.value === "" ? undefined : v / 100 });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>P/VP máx.</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="ex: 1.1"
            value={params.maxPVP ?? ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              set({ maxPVP: e.target.value === "" ? undefined : v });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Liquidez mín. (R$/dia)</Label>
          <Input
            type="number"
            step="1000"
            placeholder="ex: 1000000"
            value={params.minLiquidity ?? ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              set({ minLiquidity: e.target.value === "" ? undefined : v });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Qtd. imóveis mín.</Label>
          <Input
            type="number"
            step="1"
            placeholder="ex: 5"
            value={params.minQtdImoveis ?? ""}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              set({
                minQtdImoveis: e.target.value === "" ? undefined : v,
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Vacância máx. (%)</Label>
          <Input
            type="number"
            step="0.5"
            placeholder="ex: 15"
            value={
              params.maxVacancia != null ? params.maxVacancia * 100 : ""
            }
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              set({
                maxVacancia: e.target.value === "" ? undefined : v / 100,
              });
            }}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Segmento (contém)</Label>
          <Input
            placeholder="ex: Logística, Shoppings…"
            value={params.segmento ?? ""}
            onChange={(e) => set({ segmento: e.target.value || undefined })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
