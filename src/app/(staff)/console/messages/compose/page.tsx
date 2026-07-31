import { ComposeForm } from "@/components/compose-form";
import { createClient } from "@/lib/supabase/server";

export default async function ComposeMessagePage() {
  const supabase = await createClient();
  const [{ data: classSections }, { data: students }, { data: groups }] = await Promise.all([
    supabase.from("class_sections").select("*").order("grade", { ascending: true }),
    supabase.from("students").select("id, first_name, last_name, roll_no").order("first_name"),
    supabase.from("custom_groups").select("id, name").order("name"),
  ]);

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    label: `${s.first_name} ${s.last_name}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Messaging</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Compose message</h1>
      </div>

      <ComposeForm
        classSections={classSections ?? []}
        students={studentOptions}
        groups={groups ?? []}
      />
    </div>
  );
}
