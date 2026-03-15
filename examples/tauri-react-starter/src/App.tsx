import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import GreetPage from "./pages/GreetPage";
import CounterPage from "./pages/CounterPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="greet" element={<GreetPage />} />
        <Route path="counter" element={<CounterPage />} />
      </Route>
    </Routes>
  );
}

export default App;
