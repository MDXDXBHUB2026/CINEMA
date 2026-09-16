"use client";

import { useActionState } from "react";
import { createMovieAction, type AdminFormState } from "@/app/actions/admin-movies";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initialState: AdminFormState = {};

export function CreateMovieForm({ genres }: { genres: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createMovieAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.success && <Alert variant="success">Movie created.</Alert>}
      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required />
          <FieldError messages={state.fieldErrors?.title} />
        </div>
        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" placeholder="my-movie-title" required />
          <FieldError messages={state.fieldErrors?.slug} />
        </div>
      </div>

      <div>
        <Label htmlFor="synopsis">Synopsis</Label>
        <textarea
          id="synopsis"
          name="synopsis"
          required
          rows={3}
          className="flex w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <FieldError messages={state.fieldErrors?.synopsis} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="durationMinutes">Duration (min)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={1} required />
          <FieldError messages={state.fieldErrors?.durationMinutes} />
        </div>
        <div>
          <Label htmlFor="language">Language</Label>
          <Input id="language" name="language" defaultValue="English" required />
          <FieldError messages={state.fieldErrors?.language} />
        </div>
        <div>
          <Label htmlFor="classification">Classification</Label>
          <Input id="classification" name="classification" placeholder="PG-13" required />
          <FieldError messages={state.fieldErrors?.classification} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="releaseDate">Release date</Label>
          <Input id="releaseDate" name="releaseDate" type="date" required />
          <FieldError messages={state.fieldErrors?.releaseDate} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue="NOW_SHOWING"
            className="flex h-10 w-full rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="NOW_SHOWING">Now Showing</option>
            <option value="COMING_SOON">Coming Soon</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">Genres</legend>
        <div className="flex flex-wrap gap-3">
          {genres.map((genre) => (
            <label key={genre.id} className="flex items-center gap-1.5 text-sm text-foreground">
              <input type="checkbox" name="genreIds" value={genre.id} className="h-4 w-4 rounded border-border" />
              {genre.name}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create movie"}
      </Button>
    </form>
  );
}
