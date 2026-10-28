"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/auth/schemas";
import { formatNumber } from "@/lib/format";
import { formatKcal, formatQuantity, macroLine } from "@/lib/nutrition/format";
import type { Food, Meal, MealItem } from "@/lib/nutrition/queries";
import { addMealItem, deleteMeal, deleteMealItem, moveMeal, updateMeal, updateMealItem } from "../actions";

export type PickableFood = Pick<Food, "id" | "name" | "basis" | "unitLabel" | "unitAmount">;
type Result = { ok: true } | { ok: false; message: string };

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 [&_option]:bg-popover";

function unitOptions(food: PickableFood | undefined) {
  if (!food) return [];
  const options: { value: string; label: string }[] = [{ value: food.basis, label: food.basis === "g" ? "gramas (g)" : "mililitros (ml)" }];
  if (food.unitLabel && food.unitAmount) {
    options.push({ value: "unit", label: `${food.unitLabel} (${formatNumber(food.unitAmount, 1)} ${food.basis})` });
  }
  return options;
}

type MealCardProps = { meal: Meal; index: number; total: number; foods: PickableFood[] };

export function MealCard({ meal, index, total, foods }: MealCardProps) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.message);
    });
  const headingId = `meal-${meal.id}-title`;

  return (
    <section aria-labelledby={headingId} className="grid gap-4 surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 id={headingId} className="font-heading text-lg font-semibold">{meal.name}</h3>
          <p className="text-sm text-muted-foreground">
            {meal.timeOfDay ?? "Sem horário"} · ≈ {formatKcal(meal.totals.kcal)}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={`Mover ${meal.name} para cima`} disabled={index === 0 || pending} onClick={() => run(() => moveMeal(meal.id, "up"))}><ArrowUp aria-hidden /></Button>
          <Button variant="ghost" size="icon" aria-label={`Mover ${meal.name} para baixo`} disabled={index === total - 1 || pending} onClick={() => run(() => moveMeal(meal.id, "down"))}><ArrowDown aria-hidden /></Button>
          <Button variant="ghost" size="icon" aria-label={`Editar ${meal.name}`} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>{editing ? <X aria-hidden /> : <Pencil aria-hidden />}</Button>
          <ConfirmAction
            trigger={<Button variant="ghost" size="icon" aria-label={`Excluir ${meal.name}`}><Trash2 aria-hidden /></Button>}
            title={`Excluir ${meal.name}?`}
            description="Os alimentos desta refeição também serão removidos."
            confirmLabel="Excluir"
            successMessage="Refeição excluída."
            destructive
            onConfirm={() => deleteMeal(meal.id)}
          />
        </div>
      </div>

      {editing && <MealEditForm meal={meal} onDone={() => setEditing(false)} />}
      {meal.notes && !editing && <p className="text-sm">{meal.notes}</p>}

      {meal.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum alimento nesta refeição.</p>
      ) : (
        <ul className="grid gap-2">
          {meal.items.map((item) => <ItemRow key={item.id} item={item} />)}
        </ul>
      )}

      {adding ? (
        <AddItemForm mealId={meal.id} foods={foods} onClose={() => setAdding(false)} />
      ) : (
        <Button variant="outline" className="sm:justify-self-start" onClick={() => setAdding(true)} disabled={foods.length === 0}>
          <Plus aria-hidden />
          Adicionar alimento
        </Button>
      )}
    </section>
  );
}

function MealEditForm({ meal, onDone }: { meal: Meal; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await updateMeal(meal.id, prev, formData);
    if (result.status === "success") onDone();
    return result;
  }, initialFormState);
  return (
    <form action={action} className="grid gap-4 rounded-lg bg-muted/50 p-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <FormField name="name" id={`meal-${meal.id}-name`} label="Nome da refeição" defaultValue={state.values?.name ?? meal.name} errors={state.fieldErrors?.name} />
        <FormField name="timeOfDay" id={`meal-${meal.id}-time`} label="Horário" type="time" defaultValue={state.values?.timeOfDay ?? meal.timeOfDay ?? ""} errors={state.fieldErrors?.timeOfDay} />
      </div>
      <FormField name="notes" id={`meal-${meal.id}-notes`} label="Observações" defaultValue={state.values?.notes ?? meal.notes ?? ""} errors={state.fieldErrors?.notes} />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">Salvar refeição</SubmitButton>
    </form>
  );
}

function ItemRow({ item }: { item: MealItem }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="grid gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="font-medium">{item.food.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatQuantity(item.quantity, item.unit, item.food)} · ≈ {formatKcal(item.nutrients.kcal)}
          </p>
          <p className="text-xs text-muted-foreground">{macroLine(item.nutrients)}</p>
          {item.notes && <p className="text-sm">{item.notes}</p>}
        </div>
        <div className="flex shrink-0 justify-end gap-0.5 border-t pt-1 sm:border-0 sm:pt-0">
          <Button variant="ghost" size="icon" aria-label={`Editar ${item.food.name}`} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>{editing ? <X aria-hidden /> : <Pencil aria-hidden />}</Button>
          <ConfirmAction
            trigger={<Button variant="ghost" size="icon" aria-label={`Remover ${item.food.name}`}><Trash2 aria-hidden /></Button>}
            title={`Remover ${item.food.name}?`}
            description="O alimento sai desta refeição."
            confirmLabel="Remover"
            successMessage="Alimento removido."
            destructive
            onConfirm={() => deleteMealItem(item.id)}
          />
        </div>
      </div>
      {editing && <ItemEditForm item={item} onDone={() => setEditing(false)} />}
    </li>
  );
}

function QuantityFields({ idPrefix, food, values, errors, current }: {
  idPrefix: string;
  food: PickableFood | undefined;
  values?: Record<string, string>;
  errors?: Record<string, string[] | undefined>;
  current?: MealItem;
}) {
  const options = unitOptions(food);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          name="quantity"
          id={`${idPrefix}-quantity`}
          label="Quantidade"
          inputMode="decimal"
          defaultValue={values?.quantity ?? (current ? formatNumber(current.quantity, 2) : "")}
          errors={errors?.quantity}
        />
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-unit`}>Unidade</Label>
          <select id={`${idPrefix}-unit`} name="unit" key={food?.id ?? "none"} defaultValue={values?.unit ?? current?.unit ?? options[0]?.value} disabled={!food} className={selectClass}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {errors?.unit?.[0] && <p className="text-sm text-destructive">{errors.unit[0]}</p>}
        </div>
      </div>
      <FormField name="notes" id={`${idPrefix}-notes`} label="Observações" placeholder="Ex.: pode trocar por batata-doce" defaultValue={values?.notes ?? current?.notes ?? ""} errors={errors?.notes} />
    </div>
  );
}

function ItemEditForm({ item, onDone }: { item: MealItem; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await updateMealItem(item.id, prev, formData);
    if (result.status === "success") onDone();
    return result;
  }, initialFormState);
  return (
    <form action={action} className="grid gap-4 rounded-lg bg-muted/50 p-3" noValidate>
      <FormMessage state={state} />
      <QuantityFields idPrefix={`item-${item.id}`} food={item.food} values={state.values} errors={state.fieldErrors} current={item} />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">Salvar alimento</SubmitButton>
    </form>
  );
}

function AddItemForm({ mealId, foods, onClose }: { mealId: string; foods: PickableFood[]; onClose: () => void }) {
  const [foodId, setFoodId] = useState("");
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await addMealItem(mealId, prev, formData);
    if (result.status === "success") {
      toast.success("Alimento adicionado.");
      setFoodId("");
      setRound((r) => r + 1);
      return initialFormState;
    }
    return result;
  }, initialFormState);
  const food = foods.find((f) => f.id === foodId);
  const selectId = `add-${mealId}-food`;
  const foodError = state.fieldErrors?.foodId?.[0];

  return (
    <form key={round} action={action} className="grid gap-4 rounded-lg border border-dashed p-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-2">
        <Label htmlFor={selectId}>Alimento</Label>
        <select
          id={selectId}
          name="foodId"
          value={foodId}
          onChange={(e) => setFoodId(e.target.value)}
          aria-invalid={foodError ? true : undefined}
          aria-describedby={foodError ? `${selectId}-error` : undefined}
          className={selectClass}
        >
          <option value="">Selecione um alimento</option>
          {foods.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {foodError && <p id={`${selectId}-error`} className="text-sm text-destructive">{foodError}</p>}
      </div>
      <QuantityFields idPrefix={`add-${mealId}`} food={food} values={state.values} errors={state.fieldErrors} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pending={pending} pendingLabel="Adicionando…">Adicionar à refeição</SubmitButton>
        <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
      </div>
    </form>
  );
}
