import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { GraduationCap, Search, CheckCircle2, Zap } from "lucide-react";

const faqs = [
  { question: "How do I check my BECE results in Ghana?", answer: "You can check BECE results through the official Ghana Education Service (GES) portal at ges.gov.gh, through the WAEC Ghana website, or through third-party portals like DataPlug. Enter your index number and the year of your examination to access your results." },
  { question: "What is the BECE results checker?", answer: "A BECE results checker is an online tool that allows JHS students in Ghana to check their Basic Education Certificate Examination (BECE) results online. Instead of waiting at school or travelling to a GES office, you can check your results instantly from your phone." },
  { question: "When are BECE results released in Ghana?", answer: "BECE results are typically released by WAEC Ghana between 6 and 8 weeks after the examination. The results are usually published in October or November. Check the WAEC Ghana website for the official release date each year." },
  { question: "What index number do I need to check BECE results?", answer: "You need your BECE candidate index number, which was assigned to you when you registered for the examination. This number is on your examination slip. If you have lost your index number, contact your school's headmaster or the GES district office." },
  { question: "Can I check BECE results on my phone in Ghana?", answer: "Yes. The DataPlug BECE results checker is fully mobile-optimised. You can check your results on any smartphone, tablet, or computer. No app download is required — just visit the website." },
  { question: "What if my BECE results are not yet available?", answer: "If your results are not yet available, it means WAEC Ghana has not yet released them. Results are usually released all at once. Keep checking back or follow WAEC Ghana's social media pages for the official release announcement." },
];

export default function BeceResultsChecker() {
  return (
    <SeoPageLayout
      title="BECE Results Checker Ghana 2026 — Check BECE Results Online | DataPlug"
      canonicalPath="/bece-results-checker-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Education Services" },
        { label: "BECE Results Checker Ghana" },
      ]}
      headline="BECE Results Checker Ghana — Check Your Results Online"
      subheadline="Check your Basic Education Certificate Examination (BECE) results online in seconds. Fast, reliable, and available on any device — from DataPlug Ghana."
      accentClass="text-primary"
      faqs={faqs}
    >
      <section aria-labelledby="bece-intro-heading">
        <h2 id="bece-intro-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          What is the BECE and How Do I Check My Results?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The Basic Education Certificate Examination (BECE) is written by Junior High School (JHS) students in Ghana at the end of Form 3. It is administered by the West African Examinations Council (WAEC) and is the key qualification for entry into Senior High School (SHS) in Ghana.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          After the results are released by WAEC Ghana, students can check their results online using their candidate index number and year of examination. DataPlug provides a convenient results checker service so students, parents, and teachers can access results quickly from any device.
        </p>
        <div className="glass rounded-xl border border-border p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" aria-hidden="true" />
            How to Check BECE Results Online
          </h3>
          <ol className="space-y-3">
            {[
              "Have your BECE candidate index number ready (found on your exam slip).",
              "Visit the DataPlug BECE results checker or the official WAEC Ghana portal at waecgh.org.",
              "Enter your index number and select the year of your examination.",
              "Click 'Check Results' and your results will display immediately.",
              "Screenshot or print your results for your records.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs" aria-hidden="true">{i + 1}</span>
                <p className="text-sm text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="bece-grading-heading">
        <h2 id="bece-grading-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          BECE Grading System in Ghana
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Grade</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Mark Range</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { grade: "1", range: "80 – 100", interp: "Excellent" },
                { grade: "2", range: "70 – 79", interp: "Very Good" },
                { grade: "3", range: "60 – 69", interp: "Good" },
                { grade: "4", range: "50 – 59", interp: "Credit" },
                { grade: "5", range: "40 – 49", interp: "Pass" },
                { grade: "6", range: "30 – 39", interp: "Pass" },
                { grade: "7", range: "20 – 29", interp: "Fail" },
                { grade: "8", range: "0 – 19", interp: "Fail" },
              ].map((row) => (
                <tr key={row.grade} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-primary">{row.grade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.range}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.interp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="stay-connected-heading">
        <h2 id="stay-connected-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Stay Connected While Waiting for Results
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          While you wait for BECE results, make sure you have a reliable data connection. DataPlug offers the cheapest
          student data bundles in Ghana — perfect for checking results, researching SHS placements, and staying in
          touch with family via WhatsApp and social media.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/student-data-bundles-ghana" className="glass rounded-xl border border-border p-4 hover:border-primary/40 transition-colors group">
            <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Student Data Bundles Ghana</h3>
            <p className="text-xs text-muted-foreground mt-1">Affordable bundles for students from all networks.</p>
          </Link>
          <Link to="/wassce-results-checker-ghana" className="glass rounded-xl border border-border p-4 hover:border-primary/40 transition-colors group">
            <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">WASSCE Results Checker Ghana</h3>
            <p className="text-xs text-muted-foreground mt-1">Check WASSCE results online — also available on DataPlug.</p>
          </Link>
        </div>
      </section>
    </SeoPageLayout>
  );
}
