import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Login</h1>
          <p>Sign in with your email and password.</p>
        </div>
      </div>

      <LoginForm />
    </main>
  );
}
