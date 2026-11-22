// Validate everything under content/. Run: npm run content:validate
import { ContentError, loadContent } from "../src/lib/content/load.ts";

try {
  const c = loadContent(new URL("../content/", import.meta.url).pathname);
  const moduleQs = Object.values(c.moduleQuestions).flat().length;
  const examQs = Object.values(c.examQuestions).flat().length;
  console.log(
    `content OK: ${c.modules.length} modules, ${moduleQs} module questions, ${examQs} exam questions, ` +
      `${c.sets.length} exam sets (release ${c.manifest.label})`,
  );
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
