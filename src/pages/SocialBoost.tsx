import { ArrowUpRight, CheckCircle2, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const benefits = [
  { icon: TrendingUp, title: "Grow faster", text: "Put your brand in front of more people with campaigns built for social platforms." },
  { icon: Users, title: "Reach real audiences", text: "Promote content across popular channels and connect with customers who matter." },
  { icon: Zap, title: "Simple ordering", text: "Choose a service, share your details, and let our team handle the boost." },
];

const channels = ["TikTok", "Instagram", "Snapchat", "Facebook", "WhatsApp", "X"];

export default function SocialBoost() {
  return (
    <main className="min-h-screen bg-[#071426] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-white">
          <ArrowUpRight className="h-4 w-4 rotate-[225deg]" aria-hidden="true" /> Back to home
        </Link>
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/40 bg-gradient-to-br from-blue-600 via-indigo-600 to-fuchsia-600 p-6 shadow-2xl sm:p-10">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-sm font-bold backdrop-blur">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Social Boost
            </div>
            <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl">Make your social presence impossible to miss.</h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-white/85 sm:text-xl">Boost your TikTok, Instagram, Snapchat, Facebook, WhatsApp, and X presence with simple, affordable social growth services.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {channels.map((channel) => <span key={channel} className="rounded-full border border-white/25 bg-black/15 px-4 py-2 text-sm font-semibold">{channel}</span>)}
            </div>
          </div>
          <div className="pointer-events-none absolute -right-12 -top-12 hidden h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl sm:block" aria-hidden="true" />
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Social Boost benefits">
          {benefits.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-white/10 bg-[#102442] p-6"><Icon className="mb-5 h-8 w-8 text-cyan-300" aria-hidden="true" /><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 leading-7 text-white/65">{text}</p></article>)}
        </section>
        <section className="mt-8 rounded-2xl border border-fuchsia-400/30 bg-[#121d38] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-300">Ready to get noticed?</p><h2 className="mt-2 text-2xl font-black">Choose your social boost service</h2><p className="mt-2 max-w-xl leading-7 text-white/65">Browse available services and place your order from the Social Boost catalogue.</p></div><Link to="/packages" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-indigo-700 transition hover:bg-cyan-100">Open catalogue <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{["Campaign-ready options", "Fast, simple ordering", "Support when you need it", "Affordable social growth"].map((item) => <div key={item} className="flex items-center gap-2 text-sm font-semibold text-white/80"><CheckCircle2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />{item}</div>)}</div>
        </section>
      </div>
    </main>
  );
}
