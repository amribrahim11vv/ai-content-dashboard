import { useRef, useState } from "react";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_MIME_PREFIX = "image/";

type ReferenceImageUploaderProps = {
  value?: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function ReferenceImageUploader(props: ReferenceImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string>("");

  const hasImage = Boolean(props.value);

  const handleOpenPicker = () => {
    if (props.disabled) return;
    fileRef.current?.click();
  };

  const handleRemove = () => {
    setError("");
    props.onChange("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith(ACCEPTED_MIME_PREFIX)) {
      setError("Please upload an image file only.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Image is too large. Maximum allowed size is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) {
        setError("Failed to process image. Please try another file.");
        return;
      }
      setError("");
      props.onChange(result);
    };
    reader.onerror = () => {
      setError("Could not read this file. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3 rounded-xl border border-outline/30 bg-surface-container-lowest p-3 dark:border-brand-muted/40 dark:bg-earth-darkBg/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-on-surface">
          Reference image <span className="text-on-surface-variant">(Optional)</span>
        </p>
        <button
          type="button"
          className="rounded-lg border border-outline/40 bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-muted/40 dark:bg-earth-darkCard"
          onClick={handleOpenPicker}
          disabled={props.disabled}
        >
          {hasImage ? "Replace image" : "Upload image"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        disabled={props.disabled}
      />

      {hasImage && (
        <div className="space-y-2">
          <img src={props.value} alt="Reference preview" className="max-h-52 w-full rounded-lg object-cover" />
          <button
            type="button"
            className="rounded-lg border border-outline/40 bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-muted/40 dark:bg-earth-darkCard"
            onClick={handleRemove}
            disabled={props.disabled}
          >
            Remove image
          </button>
        </div>
      )}

      <p className="text-[11px] text-on-surface-variant">
        Use this only if you want AI to follow a visual style (colors/look). Max size: {formatFileSize(MAX_FILE_SIZE_BYTES)}.
      </p>

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
