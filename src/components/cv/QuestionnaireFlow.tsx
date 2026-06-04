import { QUESTIONNAIRE_VERSION } from "@/lib/cv-questionnaire";

export default function QuestionnaireFlow() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="CV questionnaire">
      <p className="text-sm font-semibold text-teal-700">Questionnaire {QUESTIONNAIRE_VERSION}</p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">Start with a few simple answers</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        The guided questionnaire flow will collect your CV source details here before draft generation is added in the
        next roadmap slice.
      </p>
    </section>
  );
}
