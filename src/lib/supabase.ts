import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  "https://ybfujpmfyqfbljmjawgk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnVqcG1meXFmYmxqbWphd2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTM0NTYsImV4cCI6MjEwMTA4OTQ1Nn0.1qvwftAOzTv0IXquK4SaESZ1gRBacix82lGT-QqjfqA",
  {
    cookieOptions: {
      domain: ".richfromanywhere.com",
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
    },
    auth: {
      storageKey: "sb-ybfujpmfyqfbljmjawgk-auth-token",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
