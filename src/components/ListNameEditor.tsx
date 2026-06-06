import { FormEvent, useEffect, useRef, useState } from "react";
import LucideIcon from "./LucideIcon";

type ListNameEditorProps = {
  name: string;
  canRename: boolean;
  onRename: (name: string) => Promise<boolean>;
  headingClassName: string;
};

export default function ListNameEditor({
  name,
  canRename,
  onRename,
  headingClassName,
}: ListNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraftName(name);
  }, [isEditing, name]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const cancelEditing = () => {
    setDraftName(name);
    setError(null);
    setIsEditing(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setError("Listnamnet får inte vara tomt.");
      return;
    }

    if (trimmedName === name) {
      cancelEditing();
      return;
    }

    setError(null);
    setIsSaving(true);
    const saved = await onRename(trimmedName);
    setIsSaving(false);

    if (saved) {
      setIsEditing(false);
      return;
    }

    setDraftName(name);
    setError("Det gick inte att byta namn. Försök igen.");
  };

  if (!isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h1 className={headingClassName}>{name}</h1>
        {canRename && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsEditing(true);
            }}
            className="shrink-0 rounded-full p-1 text-outline transition-[color,background-color,transform] duration-150 hover:bg-surface-container hover:text-primary active:scale-95"
            title="Byt namn på listan"
            aria-label="Byt namn på listan"
          >
            <LucideIcon name="edit" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0" aria-label="Byt namn på listan">
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => {
            setDraftName(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEditing();
          }}
          disabled={isSaving}
          className="min-w-0 rounded-lg border border-outline-variant bg-surface px-2 py-1 font-display text-base font-bold text-text-main outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "list-name-error" : undefined}
        />
        <button
          type="submit"
          disabled={isSaving || !draftName.trim()}
          className="shrink-0 rounded-full bg-primary p-1.5 text-white transition-transform duration-150 active:scale-95 disabled:opacity-40"
          title="Spara namn"
          aria-label="Spara namn"
        >
          <LucideIcon name="check" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          disabled={isSaving}
          className="shrink-0 rounded-full p-1.5 text-outline transition-[color,background-color,transform] duration-150 hover:bg-surface-container hover:text-text-main active:scale-95 disabled:opacity-40"
          title="Avbryt"
          aria-label="Avbryt namnbyte"
        >
          <LucideIcon name="close" className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && (
        <p id="list-name-error" className="mt-1 text-left font-sans text-[11px] font-medium text-error" role="status">
          {error}
        </p>
      )}
    </form>
  );
}
