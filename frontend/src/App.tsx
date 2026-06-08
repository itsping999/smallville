import { useLocation, useParams } from "react-router-dom";
import HomePage from "./pages/HomePage";
import DemoPage from "./pages/DemoPage";
import "./App.css";

export default function App() {
  const location = useLocation();
  const params = useParams();

  if (location.pathname.startsWith("/demo/") && params.simCode && params.step) {
    return <DemoPage simCode={params.simCode} step={parseInt(params.step, 10)} />;
  }

  return <HomePage />;
}
