const zlib = require("zlib");

/**
 * Pure Node.js Resume Parsing Service
 * Supports PDF, DOCX, and Plain Text resumes with zero external binary dependencies
 */

// Helper to extract text from DOCX (PKZip containing word/document.xml)
function extractTextFromDocx(buffer) {
  try {
    let offset = 0;
    while (offset < buffer.length - 4) {
      // Look for ZIP Local File Header signature: 0x04034b50 ("PK\x03\x04")
      if (
        buffer[offset] === 0x50 &&
        buffer[offset + 1] === 0x4b &&
        buffer[offset + 2] === 0x03 &&
        buffer[offset + 3] === 0x04
      ) {
        const compressionMethod = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const fileNameLength = buffer.readUInt16LE(offset + 26);
        const extraFieldLength = buffer.readUInt16LE(offset + 28);

        const fileNameStart = offset + 30;
        const fileNameEnd = fileNameStart + fileNameLength;
        const fileName = buffer.slice(fileNameStart, fileNameEnd).toString("utf-8");

        const dataStart = fileNameEnd + extraFieldLength;
        const dataEnd = dataStart + compressedSize;

        if (fileName === "word/document.xml" && dataEnd <= buffer.length) {
          const compressedData = buffer.slice(dataStart, dataEnd);
          let xmlContent = "";
          if (compressionMethod === 8) {
            xmlContent = zlib.inflateRawSync(compressedData).toString("utf-8");
          } else {
            xmlContent = compressedData.toString("utf-8");
          }

          // Strip XML tags and extract text within <w:t> tags
          const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          const text = textMatches
            .map(m => m.replace(/<[^>]+>/g, ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          if (text) return text;
        }

        offset = dataStart + (compressedSize > 0 ? compressedSize : 1);
      } else {
        offset++;
      }
    }
  } catch (err) {
    console.warn("[Resume Parser] DOCX parsing warning:", err.message);
  }
  return "";
}

// Helper to extract text streams from PDF
function extractTextFromPdf(buffer) {
  try {
    const raw = buffer.toString("binary");
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;
    let extractedText = "";

    while ((match = streamRegex.exec(raw)) !== null) {
      const streamBytes = Buffer.from(match[1], "binary");
      let textChunk = "";

      // Try inflating flate-compressed stream
      try {
        const inflated = zlib.inflateSync(streamBytes);
        textChunk = inflated.toString("latin1");
      } catch (_) {
        // Uncompressed stream or raw text
        textChunk = streamBytes.toString("latin1");
      }

      // Parse text operators: (string) Tj or [(str1)(str2)] TJ
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(textChunk)) !== null) {
        extractedText += tjMatch[1] + " ";
      }

      const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
      let arrayMatch;
      while ((arrayMatch = tjArrayRegex.exec(textChunk)) !== null) {
        const inner = arrayMatch[1];
        const innerStrs = inner.match(/\(([^)]+)\)/g) || [];
        extractedText += innerStrs.map(s => s.slice(1, -1)).join("") + " ";
      }
    }

    // Clean up escaped PDF characters
    extractedText = extractedText
      .replace(/\\([()\\])/g, "$1")
      .replace(/\\[0-7]{1,3}/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (extractedText.length > 50) {
      return extractedText;
    }

    // Fallback: search for printable ASCII strings in PDF body
    const asciiStrings = raw.match(/[A-Za-z0-9,.:;'"\-/\s]{4,}/g) || [];
    return asciiStrings.join(" ").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.warn("[Resume Parser] PDF parsing warning:", err.message);
    return "";
  }
}

// Master parser based on file type or buffer
function parseResumeBuffer(buffer, filename = "resume.pdf") {
  const lower = filename.toLowerCase();
  let extractedText = "";

  if (lower.endsWith(".docx")) {
    extractedText = extractTextFromDocx(buffer);
  } else if (lower.endsWith(".pdf")) {
    extractedText = extractTextFromPdf(buffer);
  } else {
    // Treat as UTF-8 text / markdown
    extractedText = buffer.toString("utf-8");
  }

  // If extraction yielded very little, attempt UTF-8 fallback
  if (!extractedText || extractedText.length < 20) {
    const rawUtf8 = buffer.toString("utf-8");
    if (rawUtf8 && rawUtf8.length > 30) {
      extractedText = rawUtf8;
    }
  }

  return structuredAnalyze(extractedText, filename);
}

// Extract structured intelligence from resume text
function structuredAnalyze(text, filename) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();

  // 1. Skill Extraction
  const knownSkills = [
    // Web
    "HTML", "HTML5", "CSS", "CSS3", "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular",
    "Node.js", "Express", "REST API", "Tailwind CSS", "Bootstrap",
    // Backend & Languages
    "Python", "Java", "C++", "C", "C#", "PHP", "Go", "Golang", "Rust",
    // Data & Databases
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Firebase",
    // Tools & Concepts
    "Git", "GitHub", "OOP", "Object-Oriented Programming", "Data Structures", "Algorithms",
    "Docker", "Linux", "VS Code", "Postman", "Figma", "Machine Learning"
  ];

  const matchedSkills = [];
  for (const skill of knownSkills) {
    const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(clean) && !matchedSkills.includes(skill)) {
      matchedSkills.push(skill);
    }
  }

  // 2. Education Extraction
  const educationItems = [];
  const eduKeywords = [
    /b\.?tech\b/i, /bachelor of technology/i, /b\.?e\b/i, /bachelor of engineering/i,
    /computer science/i, /information technology/i, /electronics/i, /first year/i, /semester/i,
    /cgpa\s*[:=]?\s*([0-9.]+)/i, /gpa\s*[:=]?\s*([0-9.]+)/i, /cbse/i, /icse/i
  ];
  for (const regex of eduKeywords) {
    const m = clean.match(regex);
    if (m && !educationItems.includes(m[0])) {
      educationItems.push(m[0]);
    }
  }

  // 3. Project Extraction
  const projectItems = [];
  const projectSnippets = clean.split(/(?:Projects?|Key Projects?|Academic Projects?|Work Experience|Education)/i);
  if (projectSnippets.length > 1) {
    // Look into the project section
    const projSection = projectSnippets[1].slice(0, 800);
    const bullets = projSection.split(/[•\n\r\-–]/).map(b => b.trim()).filter(b => b.length > 15 && b.length < 250);
    projectItems.push(...bullets.slice(0, 4));
  }

  if (projectItems.length === 0 && matchedSkills.length > 0) {
    // Generate context snippet from skill mentions
    const topSkills = matchedSkills.slice(0, 3).join(", ");
    projectItems.push(`Hands-on experience with ${topSkills} applied in college coursework.`);
  }

  return {
    filename,
    raw_text: clean.slice(0, 5000), // Cap for prompt safety
    word_count: clean ? clean.split(/\s+/).length : 0,
    parsed_skills: matchedSkills,
    parsed_education: educationItems,
    parsed_projects: projectItems,
    summary: `Parsed resume with ${matchedSkills.length} verified technical skills and ${projectItems.length} project highlights.`
  };
}

module.exports = {
  parseResumeBuffer,
  structuredAnalyze
};
