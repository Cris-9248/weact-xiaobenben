import { redirect } from "next/navigation";

/**
 * The activity list is the app's home. Once auth exists this becomes a
 * session check: signed in → `/activities`, otherwise → `/login`.
 */
export default function Home() {
  redirect("/activities");
}
