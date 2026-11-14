import { supabase } from "@/integrations/supabase/client";

interface SignUpArgs {
  email: string;
  password: string;
  data: Record<string, unknown>;
}

// Subagent and sub-subagent accounts skip email verification. The account is
// created pre-confirmed on the server, then signed in so the caller gets the
// same { data: { user, session }, error } shape as supabase.auth.signUp.
export async function signUpWithoutVerification({ email, password, data }: SignUpArgs) {
  const { data: result, error: fnError } = await supabase.functions.invoke(
    "register-agent-user",
    { body: { email, password, data } },
  );

  if (fnError) {
    let message = fnError.message;
    try {
      const body = await (fnError as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch {
      // keep the default message
    }
    return { data: { user: null, session: null }, error: new Error(message) };
  }

  if (result?.error) {
    return { data: { user: null, session: null }, error: new Error(result.error) };
  }

  const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { data: { user: null, session: null }, error: signInError };
  }

  return { data: { user: signedIn.user, session: signedIn.session }, error: null };
}
