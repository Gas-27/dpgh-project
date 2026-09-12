import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { GraduationCap, BookOpen, Wifi, Zap, Users, TrendingDown } from "lucide-react";

const studentBenefits = [
  { icon: TrendingDown, title: "Lowest Prices in Ghana", body: "DataPlug's bulk-sourced bundles cost up to 40% less than buying directly from MTN, Telecel, or AirtelTigo." },
  { icon: Wifi, title: "Works on All Student Devices", body: "Our bundles work on smartphones, tablets, laptops with MiFi, and any device that can use a Ghanaian SIM card." },
  { icon: Zap, title: "Instant Delivery", body: "Buy a data bundle during a lecture break and it arrives on your phone in seconds — no waiting, no queuing." },
  { icon: Users, title: "Buy for Friends Too", body: "You can buy data for any number — great for buying a bundle for a classmate or family member." },
  { icon: BookOpen, title: "Perfect for E-Learning", body: "Whether you use Google Classroom, Zoom, or WhatsApp groups, our bundles keep you connected for school." },
  { icon: GraduationCap, title: "Agent Discounts Available", body: "University students can join DataPlug as agents and earn income while buying their own data at wholesale prices." },
];

const faqs = [
  {
    question: "What is the best data bundle for students in Ghana?",
    answer: "For most students in Ghana, a 10 GB or 20 GB monthly bundle is sufficient for browsing, video calls, research, and light streaming. MTN and Telecel offer the widest coverage in university areas. DataPlug has the cheapest prices for both networks.",
  },
  {
    question: "Which network has the best student data bundle in Ghana 2026?",
    answer: "MTN Ghana has the widest coverage and the largest range of student-friendly bundle sizes. Telecel is competitive in major cities like Accra, Kumasi, and Takoradi. DataPlug sells bundles from all networks — compare live prices at /packages.",
  },
  {
    question: "How can students save data in Ghana?",
    answer: "Download lecture notes and materials on Wi-Fi. Use WhatsApp Web on campus Wi-Fi instead of mobile data. Set YouTube to 480p or SD quality. Use data saver mode on your browser. Students can save up to 60% of their data by adopting these habits.",
  },
  {
    question: "How much data does a student need per month in Ghana?",
    answer: "A typical student who uses WhatsApp, researches online, watches some videos, and joins Zoom classes needs approximately 10–15 GB per month. Students who stream heavily or download videos need 20–30 GB. DataPlug offers bundles across all sizes and networks.",
  },
  {
    question: "Can I check my BECE or WASSCE results through DataPlug?",
    answer: "Yes. DataPlug provides a convenient BECE and WASSCE results checker service. Visit /bece-results-checker-ghana or /wassce-results-checker-ghana to check your results without needing to visit a school or office.",
  },
  {
    question: "How do I buy data for my school in Ghana?",
    answer: "Schools, universities, and tutoring centres can purchase bulk data bundles through DataPlug's data API or agent programme. Contact us via WhatsApp or email for institutional pricing and API access.",
  },
];

export default function StudentDataBundles() {
  return (
    <SeoPageLayout
      title="Best Student Data Bundles Ghana 2026 — Cheap Internet for Students | DataPlug"
      canonicalPath="/student-data-bundles-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Data Bundles", href: "/cheap-data-bundles-ghana" },
        { label: "Student Data Bundles Ghana" },
      ]}
      headline="Cheapest Student Data Bundles in Ghana 2026"
      subheadline="Stay connected in class, on campus, and at home with affordable MTN, Telecel, and AirtelTigo student data bundles — starting from as little as GHS 5. Instant delivery, no queues."
      accentClass="text-primary"
      faqs={faqs}
    >
      <section aria-labelledby="student-intro-heading">
        <h2 id="student-intro-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Why Students in Ghana Choose DataPlug
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Being a student in Ghana means balancing tight budgets with the growing need to stay online — for research, e-learning
          platforms, WhatsApp study groups, Google Classroom, and keeping up with the world. DataPlug was built for exactly
          this situation: giving you access to the cheapest data bundles from MTN, Telecel, and AirtelTigo, delivered instantly
          to your phone, 24 hours a day.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Whether you are studying at a university in Accra, Kumasi, Takoradi, Cape Coast, or anywhere else in Ghana,
          DataPlug ensures you always have data when you need it — at prices that fit a student budget.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studentBenefits.map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass rounded-xl border border-border p-5 space-y-2">
              <div className="inline-flex rounded-lg bg-primary/10 p-2.5" aria-hidden="true">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-buy-heading">
        <h2 id="how-buy-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          How to Buy a Student Data Bundle in Ghana
        </h2>
        <ol className="space-y-4">
          {[
            { step: "1", title: "Visit DataPlug", body: "Go to dataplug.store on any browser — works on any smartphone or computer." },
            { step: "2", title: "Choose Your Network", body: "Select MTN, Telecel, or AirtelTigo depending on your SIM card." },
            { step: "3", title: "Pick a Bundle Size", body: "Choose from small daily bundles (1 GB) up to large monthly plans (50 GB+)." },
            { step: "4", title: "Enter Your Number", body: "Type the phone number you want to receive the data — it can be your own or a friend's." },
            { step: "5", title: "Pay Securely", body: "Pay with Mobile Money (MoMo) or card via Paystack — Ghana's most trusted payment gateway." },
            { step: "6", title: "Receive Instantly", body: "Your data arrives on the number within seconds of payment confirmation." },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm" aria-hidden="true">{step}</div>
              <div>
                <p className="font-semibold text-foreground text-sm">{title}</p>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="education-heading">
        <h2 id="education-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          DataPlug Education Services for Students
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Beyond data bundles, DataPlug also helps Ghanaian students with important educational services.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/bece-results-checker-ghana" className="glass rounded-xl border border-border p-5 hover:border-primary/40 transition-colors group">
            <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors mb-1">BECE Results Checker</h3>
            <p className="text-sm text-muted-foreground">Check your BECE results quickly and conveniently online through DataPlug.</p>
          </Link>
          <Link to="/wassce-results-checker-ghana" className="glass rounded-xl border border-border p-5 hover:border-primary/40 transition-colors group">
            <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors mb-1">WASSCE Results Checker</h3>
            <p className="text-sm text-muted-foreground">Check WASSCE results for all subjects and years without going to school.</p>
          </Link>
        </div>
      </section>

      <section aria-labelledby="networks-heading" className="glass rounded-xl border border-border p-6">
        <h2 id="networks-heading" className="font-display text-lg font-bold text-foreground mb-4">
          Browse by Network
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { to: "/mtn-data-bundles", label: "MTN Student Bundles" },
            { to: "/telecel-data-bundles", label: "Telecel Student Bundles" },
            { to: "/airteltigo-data-bundles", label: "AirtelTigo Student Bundles" },
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
