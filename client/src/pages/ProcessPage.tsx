import { useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";
import { UploadSection } from "../components/process-page/UploadSection";
import { ResultDashboard } from "../components/process-page/ResultDashboard";
import type { PipelineData } from "../types/process-page";

export default function ProcessPage() {
  const [result, setResult] = useState<PipelineData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [processing, setProcessing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const handleResult = (data: PipelineData, t: number) => {
    setResult(data);
    setElapsed(t);
    setProcessing(false);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleReset = () => { setResult(null); setProcessing(false); };

  return (
    <div ref={topRef} className="min-h-screen">
      <Navbar />
      {!result
        ? <UploadSection onResult={handleResult} onProcessStart={() => setProcessing(true)} />
        : <ResultDashboard data={result} elapsed={elapsed} onReset={handleReset} />
      }
      {processing && <></>}
      <Footer />
    </div>
  );
}