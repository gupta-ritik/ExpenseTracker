import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const folder = join(__dirname);
export type AlertFixture = {
  file: string;
  sender: string;
  expect: string;
  text: string;
};

export function loadAlertFixtures(): AlertFixture[] {
  return readdirSync(folder)
    .filter((name) => name.endsWith(".txt"))
    .flatMap((file) =>
      readFileSync(join(folder, file), "utf8")
        .replace(/\r\n/g, "\n")
        .split(/\n---\n/)
        .map((block) => {
          const [senderLine, expectLine, ...body] = block.trim().split("\n");
          return {
            file,
            sender: senderLine.replace(/^sender:\s*/, ""),
            expect: expectLine.replace(/^expect:\s*/, ""),
            text: body.join("\n"),
          };
        }),
    );
}
