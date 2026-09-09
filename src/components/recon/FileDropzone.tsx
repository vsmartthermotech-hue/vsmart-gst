import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseFile, type ParsedFile } from "@/lib/parse-file";

type Props = {
  label: string;
  hint: string;
  file: ParsedFile | null;
  onParsed: (f: ParsedFile) => void;
  onClear: () => void;
};

export function FileDropzone({ label, hint, file, onParsed, onClear }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (f: File) => {
      setError(null);
      setLoading(true);
      try {
        const parsed = await parseFile(f);
        if (!parsed.columns.length) throw new Error("No columns detected");
        onParsed(parsed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to parse file");
      } finally {
        setLoading(false);
      }
    },
    [onParsed],
  );

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {file && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>

      {!file ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-12 text-center transition-colors cursor-pointer",
            dragging ? "border-primary bg-accent" : "border-border hover:border-foreground/30",
          )}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="rounded-full bg-secondary p-3 mb-3">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium text-foreground">
            {loading ? "Parsing..." : "Drop file or click to browse"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{hint}</div>
          <div className="text-xs text-muted-foreground mt-3">Accepts .xlsx, .xls, .csv</div>
        </label>
      ) : (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-success-bg p-2">
              <FileSpreadsheet className="h-4 w-4 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{file.fileName}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {file.rows.length} rows · {file.columns.length} columns
              </div>
            </div>
          </div>

          <div className="mt-4 -mx-4 -mb-4 border-t overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  {file.columns.map((c) => (
                    <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {file.rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t">
                    {file.columns.map((c) => (
                      <td key={c} className="px-3 py-2 whitespace-nowrap text-foreground">
                        {String(r[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-xs text-danger">{error}</div>}
    </div>
  );
}
