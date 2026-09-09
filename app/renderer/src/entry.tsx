import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("renderer/index.html is missing #root");
}
createRoot(container).render(<App />);
