import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cierre } = await searchParams;
  return <LoginForm porInactividad={cierre === "inactividad"} />;
}
