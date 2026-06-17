import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");
const readmePath = path.join(repoRoot, "README.md");
const readme = readFileSync(readmePath, "utf8");
const quickstartSection = sectionBetween(
  readme,
  "3. Invoke them in your agent:",
  "## Why These Skills Exist",
);
const referenceSection = sectionBetween(readme, "## Reference", "## License");
const errors = [];

const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const dir of skillDirs) {
  const skillDir = path.join(skillsRoot, dir);
  const skillPath = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) continue;

  const text = readFileSync(skillPath, "utf8");
  const frontmatter = parseFrontmatter(text, skillPath);
  const description = parseDescription(frontmatter, skillPath);

  requireKebabName(frontmatter.name, dir, skillPath);
  requireDescription(description, skillPath);
  requireLineLimit(text, skillPath);
  requireReadmeCoverage(dir, skillPath);
  requireExistingMarkdownReferences(text, skillPath);
}

if (errors.length > 0) {
  console.error(`Skill validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${skillDirs.length} skills.`);

function parseFrontmatter(text, filePath) {
  if (!text.startsWith("---\n")) {
    fail(filePath, "missing frontmatter block");
    return {};
  }

  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    fail(filePath, "frontmatter block is not closed");
    return {};
  }

  const raw = text.slice(4, end);
  const fields = {};
  const lines = raw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    if (value === ">") {
      const folded = [];
      for (index++; index < lines.length; index++) {
        if (/^[A-Za-z0-9_-]+:\s*/.test(lines[index])) {
          index--;
          break;
        }
        folded.push(lines[index].trim());
      }
      fields[key] = folded.join(" ").replace(/\s+/g, " ").trim();
    } else {
      fields[key] = value.replace(/^["']|["']$/g, "").trim();
    }
  }

  return fields;
}

function parseDescription(frontmatter, filePath) {
  if (!frontmatter.description) {
    fail(filePath, "frontmatter is missing description");
    return "";
  }
  return frontmatter.description;
}

function requireKebabName(name, dir, filePath) {
  if (!name) {
    fail(filePath, "frontmatter is missing name");
    return;
  }
  if (name !== dir)
    fail(filePath, `name "${name}" does not match directory "${dir}"`);
  if (name.length > 64) fail(filePath, "name is longer than 64 characters");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
    fail(filePath, "name must be kebab-case");
}

function requireDescription(description, filePath) {
  if (description.length > 1024)
    fail(filePath, "description is longer than 1024 characters");
}

function requireLineLimit(text, filePath) {
  const body = text.endsWith("\n") ? text.slice(0, -1) : text;
  const lineCount = body.length === 0 ? 0 : body.split(/\r?\n/).length;
  if (lineCount > 100)
    fail(filePath, `SKILL.md has ${lineCount} lines, expected 100 or fewer`);
}

function requireReadmeCoverage(dir, filePath) {
  if (!quickstartSection.includes(`/${dir}`))
    fail(filePath, `README quickstart is missing /${dir}`);
  if (!referenceSection.includes(`./skills/${dir}/SKILL.md`)) {
    fail(
      filePath,
      `README reference table is missing ./skills/${dir}/SKILL.md`,
    );
  }
}

function requireExistingMarkdownReferences(text, filePath) {
  const references = new Set();
  const markdownLinks = text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  for (const match of markdownLinks) references.add(match[1]);

  const inlineMarkdownRefs = text.matchAll(/`([^`\n<>]+\.md)`/g);
  for (const match of inlineMarkdownRefs) references.add(match[1]);

  for (const target of references) {
    if (
      target.startsWith("http:") ||
      target.startsWith("https:") ||
      target.startsWith("#")
    )
      continue;

    const cleanTarget = target.split("#")[0];
    if (!cleanTarget) continue;

    const relativeTarget = path.resolve(path.dirname(filePath), cleanTarget);
    const rootTarget = path.join(repoRoot, cleanTarget);
    const resolved = cleanTarget.startsWith("skills/")
      ? rootTarget
      : existsSync(relativeTarget)
        ? relativeTarget
        : rootTarget;

    if (!resolved.startsWith(repoRoot)) continue;
    if (!existsSync(resolved))
      fail(filePath, `referenced file does not exist: ${target}`);
  }
}

function fail(filePath, message) {
  errors.push(`${path.relative(repoRoot, filePath)}: ${message}`);
}

function sectionBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";

  const end = text.indexOf(endMarker, start + startMarker.length);
  return text.slice(start, end === -1 ? undefined : end);
}
