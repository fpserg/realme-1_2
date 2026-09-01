"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/app/_supabase/server";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";

import { resolveAuthCallbackUrl } from "./callback-url";

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
  const configuration = readSupabasePublicConfig();
  if (!configuration) {
    redirect("/login?notice=Authentication+is+not+configured+for+this+build.");
  }
  return configuration;
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
  const configuration = requireConfiguredAuth();
  const input = credentials(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    ...input,
    options: {
      emailRedirectTo: resolveAuthCallbackUrl(
        configuration.environment,
        process.env,
      ),
    },
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
