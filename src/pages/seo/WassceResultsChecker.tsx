import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { GraduationCap, Search, Zap } from "lucide-react";

const faqs = [
  { question: "How do I check my WASSCE results in Ghana?", answer: "Check WASSCE results through the official WAEC Ghana portal at waecgh.org or through DataPlug's results checker. Enter your index number and examination year to view your results. You may also need your exam serial number for some portals." },
  { question: "When are WASSCE results released in Ghana?", answer: "WASSCE results are typically released by WAEC Ghana between 6 and 12 weeks after the examination. Results are usually published between August and October. Follow WAEC Ghana's official channels for the exact release date." },
  { question: "What is a good WASSCE grade in Ghana?", answer: "WASSCE grades range from A1 (Excellent, 80–100%) to F9 (Fail, 0–29%). Grades A1 to C6 are considered pass grades for university and polytechnic entry. Most universities require a minimum of 6 credits (A1–C6) including English and Mathematics." },
  { question: "Can I check WASSCE results on my phone?", answer: "Yes. The DataPlug WASSCE results checker works on any mobile browser. No app is required. Simply visit the site, enter your index number and year, and your results will be displayed instantly." },
  { question: "What if I have a missing subject in my WASSCE results?", answer: "If a subject appears to be missing from your results, first check if it was listed under a slightly different subject name. If still missing, contact WAEC Ghana directly at their Accra office or call their results helpline. Do not assume a missing subject means a fail." },
  { question: "Can I use WASSCE results to apply to university in Ghana?", answer: "Yes. WASSCE results are the primary qualification for university admission in Ghana. Most public universities (UG, KNUST, UCC, etc.) require applicants to have at least six passes (A1–C6) in relevant subjects through the direct admissions system or through the Tertiary Admissions Secretariat (TAS)." },
];

export default function WassceResultsChecker() {
  return (
    <SeoPageLayout
      title="WASSCE Results Checker Ghana 2026 — Check WASSCE Results Online | DataPlug"
      canonicalPath="/wassce-results-checker-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Education Services" },
        { label: "WASSCE Results Checker Ghana" },
      ]}
      headline="WASSCE Results Checker Ghana — Check Your Results Online Instantly"
      subheadline="Check your West African Senior School Certificate Examination (WASSCE) results online in seconds. Available on any device, 24 hours a day — from DataPlug Ghana."
      accentClass="text-primary"
      faqs={faqs}
    >
      <section aria-labelledby="wassce-intro-heading">
        <h2 id="wassce-intro-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          What is the WASSCE and How Do You Check Results?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The West African Senior School Certificate Examination (WASSCE) is written by Senior High School (SHS) students in their final year across West Africa, including Ghana. It is administered by WAEC and is the principal qualification for university and polytechnic entry in Ghana.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          WASSCE covers subjects including English Language, Mathematics, Integrated Science, Social Studies, and elective subjects. Students can check their results online after the official WAEC release using their candidate index number.
        </p>
        <div className="glass rounded-xl border border-border p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" aria-hidden="true" />
            How to Check WASSCE Results Online
          </h3>
          <ol className="space-y-3">
            {[
              "Locate your WASSCE candidate index number (on your examination slip or school records).",
              "Visit DataPlug's WASSCE results checker or the official WAEC Ghana portal.",
              "Enter your index number and select your examination year.",
              "Review your results for all subjects and grades.",
              "Save or print your results for university application purposes.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs" aria-hidden="true">{i + 1}</span>
                <p className="text-sm text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="wassce-grading-heading">
        <h2 id="wassce-grading-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          WASSCE Grading System in Ghana
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Grade</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Mark Range</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { grade: "A1", range: "80 – 100", cls: "Excellent" },
                { grade: "B2", range: "70 – 79", cls: "Very Good" },
                { grade: "B3", range: "60 – 69", cls: "Good" },
                { grade: "C4", range: "55 – 59", cls: "Credit" },
                { grade: "C5", range: "50 – 54", cls: "Credit" },
                { grade: "C6", range: "45 – 49", cls: "Credit" },
                { grade: "D7", range: "40 – 44", cls: "Pass" },
                { grade: "E8", range: "35 – 39", cls: "Pass" },
                { grade: "F9", range: "0 – 34", cls: "Fail" },
              ].map((row) => (
                <tr key={row.grade} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-primary">{row.grade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.range}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.cls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="related-edu-heading" className="glass rounded-xl border border-border p-6">
        <h2 id="related-edu-heading" className="font-display text-lg font-bold text-foreground mb-4">Related Education &amp; Data Services</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { to: "/bece-results-checker-ghana", label: "BECE Results Checker Ghana" },
            { to: "/student-data-bundles-ghana", label: "Student Data Bundles Ghana" },
            { to: "/cheap-data-bundles-ghana", label: "Cheap Data Bundles Ghana" },
            { to: "/packages", label: "Browse All Data Packages" },
          ].map(({ to, label }) => (
            <Link key={to} to={to} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Zap className="h-3 w-3" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </SeoPageLayout>
  );
}
