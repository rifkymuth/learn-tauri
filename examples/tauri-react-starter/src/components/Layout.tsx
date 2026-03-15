import { Link, Outlet } from "react-router-dom";

function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-gray-800 text-white px-6 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">Tauri Starter</h1>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-blue-300 transition-colors">
              Home
            </Link>
            <Link to="/greet" className="hover:text-blue-300 transition-colors">
              Greet
            </Link>
            <Link
              to="/counter"
              className="hover:text-blue-300 transition-colors"
            >
              Counter
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-500 py-3">
        Built with Tauri + React + TypeScript
      </footer>
    </div>
  );
}

export default Layout;
