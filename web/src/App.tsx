import { Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { PrintDetail } from "./pages/PrintDetail";

function App() {
  return (
    <div className="container">
      <header className="site-header">
        <span className="eyebrow">central de impressão · vsoller.com.br</span>
        <h1>3D · Vitor Soller</h1>
        <p className="lede">
          Timeline pública das minhas impressões 3D — o que está imprimindo agora, o histórico completo, problemas de
          hardware e manutenções. Só leitura, atualizado direto da impressora.
        </p>
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
