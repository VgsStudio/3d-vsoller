import { Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { PrintDetail } from "./pages/PrintDetail";

function App() {
  return (
    <div className="container">
      <header className="site-header">
        <h1>3D · Vitor Soller</h1>
        <p>Log público das impressões 3D — Ender 3 V3, PLA &amp; PETG</p>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/impressoes/:id" element={<PrintDetail />} />
      </Routes>

      <footer className="site-footer">
        <a href="https://vsoller.com.br">vsoller.com.br</a>
      </footer>
    </div>
  );
}

export default App;
