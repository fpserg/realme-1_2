import { describe, expect, it } from "vitest";

import { importsFrom } from "./import-specifiers.mjs";

describe("importsFrom", () => {
  it("finds every supported module-loading form", () => {
    const source = `
      import value from "ordinary";
      import "side-effect";
      export { value } from "re-export";
      const dynamic = import("dynamic");
      const commonJs = require("common-js");
      import legacy = require("import-equals");
    `;

    expect(importsFrom(source)).toEqual([
      "ordinary",
      "side-effect",
      "re-export",
      "dynamic",
      "common-js",
      "import-equals",
    ]);
  });

  it("ignores module-shaped text in comments and strings", () => {
    const source = `
      // import "comment";
      const text = 'require("string")';
    `;

    expect(importsFrom(source)).toEqual([]);
  });
});
