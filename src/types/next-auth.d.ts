import { DefaultSession } from "next-auth";

// Augmenta os tipos do NextAuth para expor o `id` do usuário na sessão e no JWT.
// Necessário porque os callbacks em src/lib/auth.ts gravam `token.id` e `session.user.id`.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
