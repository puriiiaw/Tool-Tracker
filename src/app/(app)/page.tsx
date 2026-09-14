import { requireUser } from "@/lib/auth";

export default async function Home() {
  const user = await requireUser();
  return (
    <p className="text-zinc-600">
      Signed in as {user.name}. Dashboard comes in step 4.
    </p>
  );
}
