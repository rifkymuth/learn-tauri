function HomePage() {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-3xl font-bold mb-4">Welcome to Tauri + React</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        This is a starter template demonstrating Tauri with React, TypeScript,
        Tailwind CSS, Zustand, and React Router.
      </p>
      <div className="grid grid-cols-2 gap-4 text-left">
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Greet Example</h3>
          <p className="text-sm text-gray-500">
            Demonstrates calling a Rust command from React using invoke().
          </p>
        </div>
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Counter Example</h3>
          <p className="text-sm text-gray-500">
            Demonstrates Zustand state management with Tauri managed state.
          </p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
