import { useState } from "react";
import { useInvoke } from "../hooks/useInvoke";

function GreetPage() {
  const [name, setName] = useState("");
  const { data, loading, error, execute } = useInvoke<string>("greet");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    execute({ name });
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Greet Example</h2>
      <p className="text-gray-500 mb-4">
        Type your name and click &quot;Greet&quot; to call a Rust command.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name..."
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "Greet"}
        </button>
      </form>

      {error && (
        <p className="text-red-500 text-sm">Error: {error.message}</p>
      )}

      {data && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-green-700 dark:text-green-300">{data}</p>
        </div>
      )}
    </div>
  );
}

export default GreetPage;
