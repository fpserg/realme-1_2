"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/app/_supabase/server";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";

function credentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    redirect("/login?notice=Enter+a+valid+email+and+at+least+8+characters.");
  }

  return { email: email.trim(), password };
}

function requireConfiguredAuth() {
  if (!readSupabasePublicConfig()) {
    redirect("/login?notice=Authentication+is+not+configured+for+this+build.");
  }
}

export async function login(formData: FormData) {
  requireConfiguredAuth();
  const input = credentials(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(input);

  if (error) redirect("/login?notice=Sign-in+was+not+accepted.");

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  requireConfiguredAuth();
  const input = credentials(formData);
  const supabase = await createSupabaseServerClient();
  const appUrl =
    process.env.DEPLOY_PRIME_URL ??
    process.env.URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://127.0.0.1:3000";
  const { error } = await supabase.auth.signUp({
    ...input,
    options: { emailRedirectTo: new URL("/auth/callback", appUrl).toString() },
  });

  if (error) redirect("/login?notice=Account+creation+was+not+accepted.");

  redirect("/login?notice=Check+your+email+to+confirm+the+new+account.");
}

export async function logout() {
  if (readSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}
