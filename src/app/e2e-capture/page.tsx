import { notFound } from "next/navigation";

import { ObservationCapture } from "../observation-capture";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export default function Step99CaptureFixturePage() {
  if (process.env.REALME_E2E_FIXTURE !== "1") notFound();

  return (
    <main className={styles.appMain}>
      <ObservationCapture
        authenticatedAccountId="00000000-0000-4000-8000-000000000099"
        captureEndpoint="/api/e2e-observations"
        historyEndpoint="/api/e2e-observations"
        initialObservations={[]}
      />
    </main>
  );
}
