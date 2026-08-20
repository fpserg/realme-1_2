import { notFound } from "next/navigation";

import { ObservationCapture } from "../observation-capture";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export default function Step99CaptureFixturePage() {
  if (process.env.REALME_E2E_FIXTURE !== "1") notFound();

  return (
    <main className={styles.appMain}>
      <ObservationCapture
        captureEndpoint="/api/e2e-observations"
        historyEndpoint="/api/e2e-observations"
        initialObservations={[]}
      />
    </main>
  );
}
