import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

const opts = { extensions: [gfm()], htmlExtensions: [gfmHtml()] };

function normalizeMarkdown(s) {
  // Some upstream streams escape newlines (a literal backslash-n) instead of
  // emitting real line breaks, which collapses tables/lists onto one line.
  const real = (s.match(/\n/g) ?? []).length;
  const escaped = (s.match(/\\r\\n|\\n|\\r/g) ?? []).length;
  if (escaped > real) {
    return s.replace(/\\r\\n|\\n|\\r/g, "\n");
  }
  return s;
}

const bs = "\\"; // one backslash
const broken = "Comparison:" + bs + "n| Item | Value |" + bs + "n| --- | --- |" + bs + "n| a | 1 |";
console.log("broken input:", JSON.stringify(broken));
const fixed = normalizeMarkdown(broken);
console.log("normalized:", JSON.stringify(fixed));
console.log("broken -> table:", micromark(fixed, opts).includes("<table>"));

const normal = "Comparison:\n\n| Item | Value |\n| --- | --- |\n| a | 1 |";
console.log("normal -> table:", micromark(normalizeMarkdown(normal), opts).includes("<table>"));
console.log("normal untouched:", normalizeMarkdown(normal) === normal);
