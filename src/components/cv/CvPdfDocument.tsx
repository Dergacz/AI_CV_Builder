import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Type-only import keeps zod (pulled in by cv-draft's runtime exports) out of this client island.
import type { GeneratedCvDraft } from "@/lib/cv-draft";
import { cvEditorCopy } from "@/lib/cv-editor-copy";

/**
 * PDF rendering of a generated CV draft (S-07).
 *
 * A parallel renderer over the same `GeneratedCvDraft` contract that `CvTemplate.tsx`
 * renders to the DOM — `@react-pdf/renderer` uses its own primitives, so this mirrors the
 * five sections, their heading composition, and the empty-state branches rather than reusing
 * the HTML. Bundled Noto Sans (Latin/Latin-Ext/Cyrillic) is registered so en/pl/ru text
 * renders correctly instead of the default Helvetica's missing glyphs. Module is only ever
 * dynamically imported (by `useCvExport`) to stay out of the SSR/Worker bundle.
 */

Font.register({
  family: "Noto Sans",
  fonts: [{ src: "/fonts/NotoSans-Regular.ttf" }, { src: "/fonts/NotoSans-Bold.ttf", fontWeight: "bold" }],
});

type Sections = GeneratedCvDraft["sections"];

const styles = StyleSheet.create({
  page: {
    fontFamily: "Noto Sans",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#0f172a",
    paddingVertical: 40,
    paddingHorizontal: 48,
  },
  header: {
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
  },
  name: { fontSize: 22, fontWeight: "bold", color: "#0f172a" },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 3,
  },
  headline: { fontWeight: "bold", color: "#0f172a", marginBottom: 2 },
  body: { color: "#334155" },
  item: { marginBottom: 8 },
  itemHeading: { fontWeight: "bold", color: "#0f172a" },
  itemMeta: { fontSize: 8, color: "#64748b", marginBottom: 2 },
  highlight: { color: "#334155", marginLeft: 8 },
  skillGroup: { marginBottom: 3 },
  skillLabel: { fontWeight: "bold", color: "#0f172a" },
  language: { marginBottom: 2 },
  languageName: { fontWeight: "bold", color: "#0f172a" },
  empty: { color: "#94a3b8" },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function formatExperienceDates(item: Sections["experience"][number]): string {
  const end = item.endDate ?? (item.isCurrent ? cvEditorCopy.labels.present : undefined);
  if (item.startDate && end) return `${item.startDate} – ${end}`;
  return item.startDate ?? end ?? "";
}

export default function CvPdfDocument({ draft, fullName }: { draft: GeneratedCvDraft; fullName?: string }) {
  const { summary, experience, education, skills, languages } = draft.sections;
  const name = fullName?.trim();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {name ? (
          <View style={styles.header}>
            <Text style={styles.name}>{name}</Text>
          </View>
        ) : null}

        <Section title={cvEditorCopy.sections.summary}>
          {summary.headline ? <Text style={styles.headline}>{summary.headline}</Text> : null}
          <Text style={styles.body}>{summary.body}</Text>
        </Section>

        <Section title={cvEditorCopy.sections.experience}>
          {experience.length === 0 ? (
            <Text style={styles.empty}>{cvEditorCopy.emptyStates.experience}</Text>
          ) : (
            experience.map((item, index) => {
              const heading = [item.role, item.organization].filter(Boolean).join(" · ");
              const meta = [item.location, formatExperienceDates(item)].filter(Boolean).join(" · ");
              return (
                <View key={index} style={styles.item}>
                  <Text style={styles.itemHeading}>{heading || cvEditorCopy.labels.experienceItemFallback}</Text>
                  {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                  <Text style={styles.body}>{item.description}</Text>
                  {item.highlights.map((highlight, highlightIndex) => (
                    <Text key={highlightIndex} style={styles.highlight}>
                      • {highlight}
                    </Text>
                  ))}
                </View>
              );
            })
          )}
        </Section>

        <Section title={cvEditorCopy.sections.education}>
          {education.length === 0 ? (
            <Text style={styles.empty}>{cvEditorCopy.emptyStates.education}</Text>
          ) : (
            education.map((item, index) => {
              const heading = [item.program, item.institution].filter(Boolean).join(" · ");
              const meta = [item.location, item.startDate, item.endDate].filter(Boolean).join(" · ");
              return (
                <View key={index} style={styles.item}>
                  <Text style={styles.itemHeading}>{heading || cvEditorCopy.labels.educationItemFallback}</Text>
                  {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                  {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
                </View>
              );
            })
          )}
        </Section>

        <Section title={cvEditorCopy.sections.skills}>
          {skills.length === 0 ? (
            <Text style={styles.empty}>{cvEditorCopy.emptyStates.skills}</Text>
          ) : (
            skills.map((group, index) => (
              <Text key={`${group.label}-${index}`} style={styles.skillGroup}>
                <Text style={styles.skillLabel}>{group.label}: </Text>
                {group.items.join(", ")}
              </Text>
            ))
          )}
        </Section>

        <Section title={cvEditorCopy.sections.languages}>
          {languages.length === 0 ? (
            <Text style={styles.empty}>{cvEditorCopy.emptyStates.languages}</Text>
          ) : (
            languages.map((language, index) => (
              <Text key={`${language.name}-${index}`} style={styles.language}>
                <Text style={styles.languageName}>{language.name}</Text>
                {language.proficiency ? ` — ${language.proficiency}` : ""}
              </Text>
            ))
          )}
        </Section>
      </Page>
    </Document>
  );
}
