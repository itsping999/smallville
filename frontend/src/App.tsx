import { lazy, Suspense } from "react";
import { useLocation, useParams } from "react-router-dom";
import "./App.css";

const SavesPage = lazy(() => import("./pages/SavesPage"));
const DemoPage = lazy(() => import("./pages/DemoPage"));
const HomePage = lazy(() => import("./pages/HomePage"));

export default function App() {
  const location = useLocation();
  const params = useParams();

  let pageContent;
  if (location.pathname.startsWith("/demo/") && params.simCode && params.step) {
    pageContent = <DemoPage simCode={params.simCode} step={parseInt(params.step, 10)} />;
  } else if (location.pathname.startsWith("/live")) {
    pageContent = <HomePage />;
  } else {
    pageContent = <SavesPage />;
  }

  return (
    <Suspense
      fallback={
        <div className="page saves-page">
          <div className="loading">加载中...</div>
        </div>
      }
    >
      {pageContent}
    </Suspense>
  );
}

