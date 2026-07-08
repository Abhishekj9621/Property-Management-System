import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-gray-500">Page not found</p>
      <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
