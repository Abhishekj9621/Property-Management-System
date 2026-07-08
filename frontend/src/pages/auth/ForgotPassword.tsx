import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Hotel, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { authApi } from "../../api/auth.api";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await authApi.forgotPassword(values.email);
      // Backend deliberately never reveals whether the account exists,
      // so we always show the same success state regardless of outcome.
      setSent(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Hotel className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-500">We'll email you a reset link</p>
        </div>

        {sent ? (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <MailCheck className="mx-auto h-10 w-10 text-brand-600" />
            <p className="text-sm text-gray-700">
              If an account exists for that email, a password reset link is on its way. Check your inbox (and spam
              folder).
            </p>
            <Link to="/login" className="inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="you@novastay.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </button>

            <p className="text-center text-xs text-gray-400">
              <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
