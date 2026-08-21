import { notFound } from "next/navigation";

import { CompanionDialogue } from "../companion-dialogue";
import { ObservationCapture } from "../observation-capture";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export default function Step101DialogueFixturePage() {
  if (process.env.REALME_E2E_FIXTURE !== "1") notFound();

  return (
    <main className={styles.appMain}>
      <div className={styles.appSections}>
        <CompanionDialogue
          authenticatedAccountId="00000000-0000-4000-8000-000000000101"
          endpoint="/api/e2e-dialogue"
        />
        <ObservationCapture
          authenticatedAccountId="00000000-0000-4000-8000-000000000101"
          captureEndpoint="/api/e2e-observations"
          historyEndpoint="/api/e2e-observations"
          initialObservations={[]}
        />
      </div>
    </main>
  );
}
