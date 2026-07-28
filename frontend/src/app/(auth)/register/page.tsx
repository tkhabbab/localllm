"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await register(username, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-xl">
        <div className="flex flex-col items-center justify-center mb-6">
          <img src="/robi.svg" alt="AI Logo" className="w-16 h-16 mb-2 rounded-xl object-contain" />
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-dark-100">
            Create Account
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-dark-300 mb-1.5 font-medium">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg outline-none focus:border-[#E21E26] text-gray-950 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500"
              placeholder="Choose a username"
              minLength={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-dark-300 mb-1.5 font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg outline-none focus:border-[#E21E26] text-gray-950 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500"
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-dark-300 mb-1.5 font-medium">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg outline-none focus:border-[#E21E26] text-gray-950 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500"
              placeholder="Repeat password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-650 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#E21E26] hover:bg-[#c3131b] disabled:opacity-50 text-white rounded-lg font-medium transition-colors shadow-md shadow-red-500/10"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 dark:text-dark-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#E21E26] dark:text-[#ff4d52] hover:underline font-semibold transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
