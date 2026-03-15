import { useCounterStore } from "../lib/store";

function CounterPage() {
  const { count, increment, decrement, reset } = useCounterStore();

  return (
    <div className="max-w-md mx-auto text-center">
      <h2 className="text-2xl font-bold mb-4">Counter Example</h2>
      <p className="text-gray-500 mb-6">
        Demonstrates Zustand for frontend state management.
      </p>

      <div className="text-6xl font-mono font-bold mb-6">{count}</div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={decrement}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          - 1
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={increment}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          + 1
        </button>
      </div>
    </div>
  );
}

export default CounterPage;
