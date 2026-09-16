"use client";

import { useActionState } from "react";
import { createShowtimeAction } from "@/app/actions/admin-showtimes";
import type { AdminFormState } from "@/app/actions/admin-movies";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initialState: AdminFormState = {};

export function CreateShowtimeForm({
  movies,
  screens,
}: {
  movies: { id: string; title: string }[];
  screens: { id: string; name: string; cinemaName: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createShowtimeAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.success && <Alert variant="success">Showtime created.</Alert>}
      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <div>
        <Label htmlFor="movieId">Movie</Label>
        <select id="movieId" name="movieId" required className="flex h-10 w-full rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {movies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <FieldError messages={state.fieldErrors?.movieId} />
      </div>

      <div>
        <Label htmlFor="screenId">Screen</Label>
        <select id="screenId" name="screenId" required className="flex h-10 w-full rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {screens.map((s) => (
            <option key={s.id} value={s.id}>
              {s.cinemaName} — {s.name}
            </option>
          ))}
        </select>
        <FieldError messages={state.fieldErrors?.screenId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startsAt">Starts at</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
          <FieldError messages={state.fieldErrors?.startsAt} />
        </div>
        <div>
          <Label htmlFor="basePriceCents">Base price (cents)</Label>
          <Input id="basePriceCents" name="basePriceCents" type="number" min={0} defaultValue={1200} required />
          <FieldError messages={state.fieldErrors?.basePriceCents} />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create showtime"}
      </Button>
    </form>
  );
}
