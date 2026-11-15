// Extracts the visible copy of index.html (one sentence per line) to prove a redesign kept the content.
// Usage: node content-baseline.mjs <file.html> > out.txt
import { readFileSync } from "node:fs";
let t = readFileSync(process.argv[2], "utf8");
t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head[\s\S]*?<\/head>|<svg[\s\S]*?<\/svg>/g, " ");
t = t.replace(/<(?:br|\/p|\/h[1-6]|\/li|\/summary|\/a|\/span|\/b|\/small|\/div|\/label|\/button|\/output)[^>]*>/g, "\n").replace(/<[^>]+>/g, " ");
t = t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const lines = t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 1);
console.log([...new Set(lines)].sort().join("\n"));
