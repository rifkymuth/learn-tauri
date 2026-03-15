import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Custom hook for calling Tauri commands with loading/error states.
 *
 * Usage:
 *   const { data, loading, error, execute } = useInvoke<string>("greet");
 *   execute({ name: "World" });
 */
export function useInvoke<T>(command: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (args?: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<T>(command, args);
        setData(result);
        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [command],
  );

  return { data, loading, error, execute };
}
